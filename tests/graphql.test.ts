import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { type GraphQLSchema, graphql } from "graphql";
import { afterAll, beforeAll, expect, test } from "vitest";

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

/** The same call, kept when the point of the test is the message that comes back. */
const fails = async (source: string, variableValues?: Record<string, unknown>) => {
  const result = await graphql({ schema, source, variableValues });
  return result.errors?.map((error) => error.message).join("\n") ?? "";
};

const newProject = async (name: string) => {
  const { createProject } = await run(
    `mutation Create($name: String!) { createProject(values: { name: $name }) { id name } }`,
    { name },
  );
  return createProject as { id: string; name: string };
};

const board = async (projectId: string) => {
  const { lanes } = await run(
    `query Board($projectId: String!) {
       lanes(where: { projectId: { eq: $projectId } }, orderBy: { position: { direction: asc, priority: 1 } }) {
         id name position intake wipLimit onSuccessLaneId onFailureLaneId agentId
       }
     }`,
    { projectId },
  );
  return lanes as {
    id: string;
    name: string;
    position: number;
    intake: boolean;
    onSuccessLaneId: string | null;
    onFailureLaneId: string | null;
    agentId: string | null;
  }[];
};

test("a new project comes with a board already wired up", async () => {
  const project = await newProject("wired");
  const lanes = await board(project.id);

  expect(lanes.map((lane) => lane.name)).toEqual(["Backlog", "Doing", "Review", "Done"]);
  const [backlog, doing, review, done] = lanes;

  // Cards land in the backlog and nothing runs there — that is what a backlog is.
  expect(backlog.intake).toBe(true);
  expect(backlog.agentId).toBeNull();

  // Work flows Doing → Review → Done, and a rejected card goes back to Doing.
  expect(doing.onSuccessLaneId).toBe(review.id);
  expect(review.onSuccessLaneId).toBe(done.id);
  expect(review.onFailureLaneId).toBe(doing.id);
  expect(done.onSuccessLaneId).toBeNull();
});

test("the lanes are seeded per project, not shared between them", async () => {
  const first = await newProject("one");
  const second = await newProject("two");
  const [a, b] = [await board(first.id), await board(second.id)];
  expect(a).toHaveLength(4);
  expect(b).toHaveLength(4);
  expect(a.map((lane) => lane.id)).not.toEqual(b.map((lane) => lane.id));
});

test("moveCard renumbers the lane it lands in and puts the card back to idle", async () => {
  const project = await newProject("moving");
  const [backlog, doing] = await board(project.id);

  const make = async (title: string, laneId: string, position: number) =>
    (
      await run(
        `mutation Make($values: CreateCardInput!) { createCard(values: $values) { id title position } }`,
        { values: { projectId: project.id, laneId, title, position } },
      )
    ).createCard as { id: string; position: number };

  const first = await make("first", doing.id, 0);
  const second = await make("second", doing.id, 7);
  const stray = await make("stray", backlog.id, 0);

  const { moveCard } = await run(
    `mutation Move($cardId: String!, $laneId: String!) {
       moveCard(cardId: $cardId, laneId: $laneId) { id laneId position status }
     }`,
    { cardId: stray.id, laneId: doing.id },
  );
  expect(moveCard.laneId).toBe(doing.id);
  expect(moveCard.status).toBe("idle");

  const { cards } = await run(
    `query Cards($laneId: String!) {
       cards(where: { laneId: { eq: $laneId } }, orderBy: { position: { direction: asc, priority: 1 } }) {
         id title position
       }
     }`,
    { laneId: doing.id },
  );
  // Whatever the positions were before, the lane is 0..n-1 afterwards — nothing else can be
  // ordered against a lane that keeps a gap at 7.
  expect(cards.map((card: { title: string }) => card.title)).toEqual(["first", "second", "stray"]);
  expect(cards.map((card: { position: number }) => card.position)).toEqual([0, 1, 2]);
  expect([first.id, second.id]).toContain(cards[0].id);
});

test("retryCard puts a rejected card back in play where it stands", async () => {
  const project = await newProject("retrying");
  const [, doing] = await board(project.id);

  const { createCard } = await run(
    `mutation Make($values: CreateCardInput!) { createCard(values: $values) { id } }`,
    { values: { projectId: project.id, laneId: doing.id, title: "rejected", position: 0 } },
  );
  // What a reviewer's FAIL leaves behind: back in Doing, holding the reason, and in a status
  // the worker will not pick up.
  await run(
    `mutation Fail($id: String!) {
       updateCardSingle(where: { id: { eq: $id } }, set: { status: error, error: "no test" }) { id }
     }`,
    { id: createCard.id },
  );

  const { retryCard } = await run(
    `mutation Retry($cardId: String!) { retryCard(cardId: $cardId) { id laneId status error } }`,
    { cardId: createCard.id },
  );
  expect(retryCard).toMatchObject({
    id: createCard.id,
    laneId: doing.id,
    status: "idle",
    error: "",
  });

  expect(await fails(`mutation { retryCard(cardId: "nope") { id } }`)).toMatch(/no card with id/);
});

test("the API never hands back a stored key", async () => {
  expect(await run(`mutation { setApiKey(apiKey: "sk-secret") }`)).toEqual({ setApiKey: true });
  // The write goes through; the column is not in the schema at all, so nothing can read it back
  // — not the UI, not an agent that got as far as this server's own MCP endpoint.
  expect(await fails(`{ settings { apiKey } }`)).toMatch(/apiKey/);
  expect(await fails(`{ agents { apiKey } }`)).toMatch(/apiKey/);
});

test("runs are the server's own record: nothing outside it may write one", async () => {
  expect(await fails(`mutation { createRun(values: { kind: card }) { id } }`)).toMatch(
    /Cannot query field "createRun"|Unknown/,
  );
  expect(await fails(`mutation { updateRun(set: { status: ok }) { id } }`)).toMatch(
    /Cannot query field "updateRun"|Unknown/,
  );
});

test("submitting a task with no decomposer says so rather than leaving a task in limbo", async () => {
  const project = await newProject("no agents");
  const { submitTask } = await run(
    `mutation Submit($projectId: String!) {
       submitTask(projectId: $projectId, title: "ship it", brief: "make the thing") {
         id status error
       }
     }`,
    { projectId: project.id },
  );
  // Kept, not thrown away: the task is there to retry once an agent exists, and it says why.
  expect(submitTask.status).toBe("error");
  expect(submitTask.error).toMatch(/decompose/i);
});
