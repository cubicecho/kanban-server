import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { type GraphQLSchema, graphql } from "graphql";
import { afterAll, beforeAll, expect, test } from "vitest";
import { CardsStatusEnum } from "../src/gql/graphql.ts";
import { cardHealth, type DepStatus } from "../src/lib/cards.ts";

// The schema is built from the live Drizzle tables at import time, so the database has to be
// pointed somewhere disposable before anything under server/ is loaded.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kanban-server-test-"));
process.env.KANBAN_SERVER_DATA_DIR = dir;

let schema: GraphQLSchema;
let blockers: (cardId: string) => Promise<{ id: string }[]>;

beforeAll(async () => {
  const { ensureSchema } = await import("../server/db/migrate.ts");
  await ensureSchema();
  schema = (await import("../server/graphql/schema.ts")).schema;
  blockers = (await import("../server/runner/run.ts")).blockers;
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

async function run(source: string, variableValues?: Record<string, unknown>) {
  const result = await graphql({ schema, source, variableValues });
  expect(result.errors).toBeUndefined();
  // biome-ignore lint/suspicious/noExplicitAny: assertions walk arbitrary GraphQL payloads.
  return result.data as Record<string, any>;
}

/** A lane that names both halves, which is the only kind a card is ever picked up from. */
const STATION = { roleId: "role", agentId: "agent" };

const card = (status: CardsStatusEnum, dependsOn: string[] = []) => ({
  status,
  deps: dependsOn.map((dependsOnCardId) => ({ dependsOnCardId })),
});

test("a stopped card wants a person, whichever way it stopped", () => {
  const alone: DepStatus[] = [];
  expect(cardHealth(card(CardsStatusEnum.Error), STATION, alone)).toBe("attention");
  expect(cardHealth(card(CardsStatusEnum.Rejected), STATION, alone)).toBe("attention");
  expect(cardHealth(card(CardsStatusEnum.Running), STATION, alone)).toBe("running");
  expect(cardHealth(card(CardsStatusEnum.Done), STATION, alone)).toBe("done");
  expect(cardHealth(card(CardsStatusEnum.Idle), STATION, alone)).toBe("waiting");
});

test("an idle card in a lane that is not a station is parked, not queued", () => {
  const alone: DepStatus[] = [];
  const idle = card(CardsStatusEnum.Idle);
  expect(cardHealth(idle, { roleId: "role", agentId: null }, alone)).toBe("parked");
  expect(cardHealth(idle, { roleId: null, agentId: "agent" }, alone)).toBe("parked");
  expect(cardHealth(idle, { roleId: null, agentId: null }, alone)).toBe("parked");
  expect(cardHealth(idle, undefined, alone)).toBe("parked");
  // A stopped card is stopped wherever it is standing: the lane is only asked about once the
  // status has nothing left to say.
  expect(cardHealth(card(CardsStatusEnum.Error), { roleId: null, agentId: null }, alone)).toBe(
    "attention",
  );
});

test("blocked means what the server means by it, archived dependencies and all", async () => {
  const { createProject } = await run(
    `mutation { createProject(values: { name: "health" }) { id } }`,
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
  for (const title of ["done", "archived", "outstanding", "waiter"]) {
    const { createCard } = await run(
      `mutation Add($projectId: String!, $laneId: String!, $title: String!) {
         createCard(values: { projectId: $projectId, laneId: $laneId, title: $title }) { id }
       }`,
      { projectId, laneId, title },
    );
    ids.set(title, createCard.id as string);
  }
  const id = (title: string) => ids.get(title) ?? "";

  await run(
    `mutation Wait($cardId: String!, $dependsOn: [String!]!) {
       setCardDeps(cardId: $cardId, dependsOn: $dependsOn)
     }`,
    { cardId: id("waiter"), dependsOn: [id("done"), id("archived"), id("outstanding")] },
  );

  await run(
    `mutation Finish($id: String!) {
       updateCardSingle(where: { id: { eq: $id } }, set: { status: done }) { id }
     }`,
    { id: id("done") },
  );
  await run(`mutation Off($id: String!) { archiveCard(cardId: $id) { id } }`, {
    id: id("archived"),
  });

  /** The board as the page has it: archived cards are not on it, which is the whole bargain. */
  const onBoard = async () => {
    const { cards } = await run(
      `query Board($projectId: String!) {
         cards(where: { projectId: { eq: $projectId }, archivedAt: { isNull: true } }) { id title status }
       }`,
      { projectId },
    );
    return cards as DepStatus[];
  };

  const waiting = card(CardsStatusEnum.Idle, [id("done"), id("archived"), id("outstanding")]);

  // One dependency finished, one taken off the board, one still to happen: the server says the
  // third is in the way, and so does the page, off rows that do not carry the second at all.
  expect((await blockers(id("waiter"))).map((row) => row.id)).toEqual([id("outstanding")]);
  expect(cardHealth(waiting, STATION, await onBoard())).toBe("blocked");

  await run(
    `mutation Finish($id: String!) {
       updateCardSingle(where: { id: { eq: $id } }, set: { status: done }) { id }
     }`,
    { id: id("outstanding") },
  );

  expect(await blockers(id("waiter"))).toEqual([]);
  expect(cardHealth(waiting, STATION, await onBoard())).toBe("waiting");
});
