import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { type GraphQLSchema, graphql } from "graphql";
import { afterAll, beforeAll, expect, test } from "vitest";
import { blockingDeps, cyclingCards, type DepGraph } from "../src/lib/cards.ts";

// The schema is built from the live Drizzle tables at import time, so the database has to be
// pointed somewhere disposable before anything under server/ is loaded.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kanban-server-test-"));
process.env.KANBAN_SERVER_DATA_DIR = dir;

let schema: GraphQLSchema;

beforeAll(async () => {
  const { ensureSchema } = await import("../server/db/migrate.ts");
  await ensureSchema();
  schema = (await import("../server/graphql/schema.ts")).schema;
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

async function run(source: string, variableValues?: Record<string, unknown>) {
  const result = await graphql({ schema, source, variableValues });
  expect(result.errors).toBeUndefined();
  // biome-ignore lint/suspicious/noExplicitAny: assertions walk arbitrary GraphQL payloads.
  return result.data as Record<string, any>;
}

const SET = `mutation Set($cardId: String!, $dependsOn: [String!]!) {
  setCardDeps(cardId: $cardId, dependsOn: $dependsOn)
}`;

/** Whether the server refuses the ordering as a loop, and nothing else. */
async function refused(cardId: string, dependsOn: string[]) {
  const result = await graphql({ schema, source: SET, variableValues: { cardId, dependsOn } });
  const cycle = result.errors?.some((error) => error.message.includes("cycle")) ?? false;
  if (!cycle) expect(result.errors, `setting deps on ${cardId}`).toBeUndefined();
  return cycle;
}

test("the picker disables exactly the rows the server would refuse", async () => {
  const { createProject } = await run(
    `mutation { createProject(values: { name: "waiting" }) { id } }`,
  );
  const projectId = createProject.id as string;
  const { lanes } = await run(
    `query Lanes($projectId: String!) {
       lanes(where: { projectId: { eq: $projectId } }, orderBy: { position: { direction: asc, priority: 1 } }) { id }
     }`,
    { projectId },
  );
  const laneId = (lanes as { id: string }[])[0].id;

  const ids = new Map<string, string>();
  for (const title of ["A", "B", "C", "D", "E"]) {
    const { createCard } = await run(
      `mutation Add($projectId: String!, $laneId: String!, $title: String!) {
         createCard(values: { projectId: $projectId, laneId: $laneId, title: $title }) { id }
       }`,
      { projectId, laneId, title },
    );
    ids.set(title, createCard.id as string);
  }
  const id = (title: string) => ids.get(title) ?? "";
  const titleOf = (found: string) => [...ids].find(([, held]) => held === found)?.[0] ?? found;

  // A chain A ← B ← C ← D, and a diamond on top of it: E waits on C and D both. Every one of
  // the four leads back to A, so waiting on any of them would close a loop.
  const wiring: [string, string[]][] = [
    ["B", ["A"]],
    ["C", ["B"]],
    ["D", ["C"]],
    ["E", ["C", "D"]],
  ];
  for (const [card, deps] of wiring) {
    await run(SET, { cardId: id(card), dependsOn: deps.map(id) });
  }

  const graph: DepGraph = wiring.flatMap(([card, deps]) =>
    deps.map((dep) => ({ cardId: id(card), dependsOnCardId: id(dep) })),
  );

  // The diamond is why the walk is memoised: C is reached down two paths from E, and a walk
  // that did not remember its answer would agree anyway — but only by doing the work twice.
  const looping = cyclingCards(id("A"), graph);
  expect([...looping].map(titleOf).sort()).toEqual(["B", "C", "D", "E"]);

  // And the bargain itself: every card on the board, asked of both, agreeing card for card.
  for (const title of ["B", "C", "D", "E"]) {
    expect(await refused(id("A"), [id(title)]), `A waiting on ${title}`).toBe(
      looping.has(id(title)),
    );
  }

  // Nothing waits on E, so E's own picker disables nothing — and the server agrees, which is
  // the direction that matters: a row drawn live that the save then refuses is the bug.
  expect(cyclingCards(id("E"), graph).size).toBe(0);
  expect(await refused(id("E"), [id("A"), id("B"), id("C"), id("D")])).toBe(false);
});

test("the card's hint names exactly the cards the server is still waiting on", async () => {
  const { createProject } = await run(
    `mutation { createProject(values: { name: "blocked" }) { id } }`,
  );
  const projectId = createProject.id as string;
  const { lanes } = await run(
    `query Lanes($projectId: String!) {
       lanes(where: { projectId: { eq: $projectId } }, orderBy: { position: { direction: asc, priority: 1 } }) { id }
     }`,
    { projectId },
  );
  const laneId = (lanes as { id: string }[])[0].id;

  const ids = new Map<string, string>();
  for (const title of ["subject", "finished", "waiting", "put away"]) {
    const { createCard } = await run(
      `mutation Add($projectId: String!, $laneId: String!, $title: String!) {
         createCard(values: { projectId: $projectId, laneId: $laneId, title: $title }) { id }
       }`,
      { projectId, laneId, title },
    );
    ids.set(title, createCard.id as string);
  }
  const id = (title: string) => ids.get(title) ?? "";

  await run(SET, {
    cardId: id("subject"),
    dependsOn: [id("finished"), id("waiting"), id("put away")],
  });

  // The three ways a dependency can stand: done, still going, and taken off the board. Only
  // the middle one is in the way, and the board draws that hint from what it already has in
  // hand rather than asking.
  await run(
    `mutation Done($id: String!) { updateCard(where: { id: { eq: $id } }, set: { status: done }) { id } }`,
    { id: id("finished") },
  );
  await run(`mutation Away($cardId: String!) { archiveCard(cardId: $cardId) { id } }`, {
    cardId: id("put away"),
  });

  const { blockers } = await run(
    `query Blockers($cardId: String!) { blockers(cardId: $cardId) { title } }`,
    { cardId: id("subject") },
  );
  expect((blockers as { title: string }[]).map((card) => card.title)).toEqual(["waiting"]);

  // The board's half of the same answer: it filters archived cards out of what it draws, so a
  // dependency it cannot find is one that is no longer in the way — which is the server's rule
  // arrived at from the other side.
  const { cards } = await run(
    `query Board($projectId: String!) {
       cards(where: { projectId: { eq: $projectId }, archivedAt: { isNull: true } }) { id title status }
     }`,
    { projectId },
  );
  const deps = [id("finished"), id("waiting"), id("put away")].map((dependsOnCardId) => ({
    dependsOnCardId,
  }));
  expect(blockingDeps(deps, cards)).toEqual(["waiting"]);
});
