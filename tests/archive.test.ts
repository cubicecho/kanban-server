import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { type GraphQLSchema, graphql } from "graphql";
import { afterAll, beforeAll, expect, test } from "vitest";

// The schema is built from the live Drizzle tables at import time, so the database has to be
// pointed somewhere disposable before anything under server/ is loaded.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kanban-server-archive-"));
process.env.KANBAN_SERVER_DATA_DIR = dir;

let schema: GraphQLSchema;
let runner: typeof import("../server/runner/run.ts");

beforeAll(async () => {
  const { ensureSchema } = await import("../server/db/migrate.ts");
  await ensureSchema();
  schema = (await import("../server/graphql/schema.ts")).schema;
  runner = await import("../server/runner/run.ts");
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

async function run(source: string, variableValues?: Record<string, unknown>) {
  const result = await graphql({ schema, source, variableValues });
  expect(result.errors).toBeUndefined();
  // biome-ignore lint/suspicious/noExplicitAny: assertions walk arbitrary GraphQL payloads.
  return result.data as Record<string, any>;
}

const fails = async (source: string, variableValues?: Record<string, unknown>) => {
  const result = await graphql({ schema, source, variableValues });
  return result.errors?.map((error) => error.message).join("\n") ?? "";
};

/** A board with its four seeded lanes, and however many cards in the first of them. */
async function board(name: string, titles: string[]) {
  const { createProject } = await run(
    `mutation Create($name: String!) { createProject(values: { name: $name }) { id } }`,
    { name },
  );
  const projectId = createProject.id as string;
  const { lanes } = await run(
    `query Lanes($projectId: String!) {
       lanes(where: { projectId: { eq: $projectId } }, orderBy: { position: { direction: asc, priority: 1 } }) { id }
     }`,
    { projectId },
  );
  const laneIds = (lanes as { id: string }[]).map((lane) => lane.id);

  const ids: Record<string, string> = {};
  for (const title of titles) {
    const { createCard } = await run(
      `mutation Add($projectId: String!, $laneId: String!, $title: String!) {
         createCard(values: { projectId: $projectId, laneId: $laneId, title: $title }) { id }
       }`,
      { projectId, laneId: laneIds[0], title },
    );
    ids[title] = createCard.id as string;
  }
  return { projectId, laneIds, ids };
}

/** What the board draws: the cards that have not been put away. */
const onBoard = async (projectId: string) => {
  const { cards } = await run(
    `query Board($projectId: String!) {
       cards(
         where: { projectId: { eq: $projectId }, archivedAt: { isNull: true } }
         orderBy: { position: { direction: asc, priority: 1 } }
       ) { id title laneId position status }
     }`,
    { projectId },
  );
  return cards as { id: string; title: string; laneId: string; position: number; status: string }[];
};

test("an archived card leaves the board with everything it had, and comes back at the end", async () => {
  const { projectId, laneIds, ids } = await board("archived", ["A", "B", "C"]);

  // A card that failed, so restoring has an outcome to preserve rather than a blank one.
  await run(
    `mutation Fail($id: String!) {
       updateCardSingle(where: { id: { eq: $id } }, set: { status: error, error: "rejected" }) { id }
     }`,
    { id: ids.A },
  );

  const { archiveCard } = await run(
    `mutation Archive($cardId: String!) { archiveCard(cardId: $cardId) { id archivedAt } }`,
    { cardId: ids.A },
  );
  expect(archiveCard.archivedAt).toBeTruthy();

  expect((await onBoard(projectId)).map((card) => card.title)).toEqual(["B", "C"]);

  // The archive itself: still in its lane, still carrying what happened to it.
  const { cards } = await run(
    `query Archive($projectId: String!) {
       cards(where: { projectId: { eq: $projectId }, archivedAt: { isNotNull: true } }) {
         id title laneId status error
       }
     }`,
    { projectId },
  );
  expect(cards).toHaveLength(1);
  expect(cards[0]).toMatchObject({
    id: ids.A,
    laneId: laneIds[0],
    status: "error",
    error: "rejected",
  });

  // Archiving twice is the same archive — the time it was put away is not rewritten.
  const again = await run(
    `mutation Archive($cardId: String!) { archiveCard(cardId: $cardId) { archivedAt } }`,
    { cardId: ids.A },
  );
  expect(again.archiveCard.archivedAt).toEqual(archiveCard.archivedAt);

  await run(`mutation Restore($cardId: String!) { restoreCard(cardId: $cardId) { id } }`, {
    cardId: ids.A,
  });

  // Back in its own lane, at the end of it: the position it had belongs to somebody else now.
  const back = await onBoard(projectId);
  expect(back.map((card) => card.title)).toEqual(["B", "C", "A"]);
  // And still failed. What a card was is usually why it was put away.
  expect(back.find((card) => card.id === ids.A)?.status).toBe("error");

  // The whole of it is in the ledger, in order: made, put away, brought back. Going off the
  // board is a move like any other, and the only one with nowhere to move to.
  const { cardEvents } = await run(
    `query History($cardId: String!) {
       cardEvents(
         where: { cardId: { eq: $cardId } }
         orderBy: { createdAt: { direction: asc, priority: 1 } }
       ) { fromLaneId toLaneId actor }
     }`,
    { cardId: ids.A },
  );
  expect(cardEvents).toEqual([
    { fromLaneId: null, toLaneId: laneIds[0], actor: "user" },
    { fromLaneId: laneIds[0], toLaneId: null, actor: "user" },
    { fromLaneId: null, toLaneId: laneIds[0], actor: "user" },
  ]);
});

test("an archived card is not run, not moved, and not waited on", async () => {
  const { projectId, laneIds, ids } = await board("skipped", ["first", "second"]);

  await run(
    `mutation Deps($cardId: String!, $on: [String!]!) { setCardDeps(cardId: $cardId, dependsOn: $on) }`,
    {
      cardId: ids.second,
      on: [ids.first],
    },
  );
  expect((await runner.blockers(ids.second)).map((card) => card.title)).toEqual(["first"]);

  await run(`mutation Archive($cardId: String!) { archiveCard(cardId: $cardId) { id } }`, {
    cardId: ids.first,
  });

  // A dependency that is no longer on the board is not in the way. Left blocking, the dependent
  // would wait forever on a card nobody can find.
  expect(await runner.blockers(ids.second)).toEqual([]);

  // Nor is it picked up by its own lane's agent.
  expect((await runner.readyCards(laneIds[0])).map((card) => card.title)).toEqual(["second"]);

  expect(
    await fails(
      `mutation Move($cardId: String!, $laneId: String!) { moveCard(cardId: $cardId, laneId: $laneId) { id } }`,
      {
        cardId: ids.first,
        laneId: laneIds[1],
      },
    ),
  ).toContain("archived");

  // Nor is its error cleared while it is out of sight: a card comes back as what went in.
  expect(
    await fails(`mutation Retry($cardId: String!) { retryCard(cardId: $cardId) { id } }`, {
      cardId: ids.first,
    }),
  ).toContain("archived");

  await expect(runner.runCard(ids.first)).rejects.toThrow(/archived/);

  // The board is untouched by any of it.
  expect((await onBoard(projectId)).map((card) => card.title)).toEqual(["second"]);
});

test("a lane will not be deleted out from under the archive", async () => {
  const { laneIds, ids } = await board("cascade", ["only"]);

  await run(`mutation Archive($cardId: String!) { archiveCard(cardId: $cardId) { id } }`, {
    cardId: ids.only,
  });

  // The lane looks empty — that is exactly the problem, and why the guard is on the server.
  const message = await fails(
    `mutation Drop($id: String!) { deleteLaneSingle(where: { id: { eq: $id } }) { id } }`,
    { id: laneIds[0] },
  );
  expect(message).toContain("archived cards");

  await run(`mutation Restore($cardId: String!) { restoreCard(cardId: $cardId) { id } }`, {
    cardId: ids.only,
  });
  // Restored, it is an ordinary card in an ordinary lane, and the ordinary guard applies.
  expect(
    await fails(
      `mutation Drop($id: String!) { deleteLaneSingle(where: { id: { eq: $id } }) { id } }`,
      {
        id: laneIds[0],
      },
    ),
  ).not.toContain("archived cards");
});
