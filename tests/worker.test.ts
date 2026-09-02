import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { replyWith } from "./fixtures/sse.ts";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kanban-server-worker-"));
process.env.KANBAN_SERVER_DATA_DIR = dir;

let server: http.Server;
let baseUrl = "";
/** Held requests, so a run can be kept in flight while the worker is asked to tick again. */
let waiting: (() => void)[] = [];
let gated = false;

let db: typeof import("../server/db/client.ts").db;
let tables: typeof import("../server/db/schema.ts");
let worker: typeof import("../server/worker/loop.ts");

const completion = {
  id: "chatcmpl-test",
  model: "fake",
  choices: [{ message: { content: "done" } }],
  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
};

beforeAll(async () => {
  server = http.createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      const answer = () => replyWith(response, completion, JSON.parse(body));
      if (gated) waiting.push(answer);
      else answer();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/v1`;

  const { ensureSchema } = await import("../server/db/migrate.ts");
  await ensureSchema();
  db = (await import("../server/db/client.ts")).db;
  tables = await import("../server/db/schema.ts");
  worker = await import("../server/worker/loop.ts");
});

afterAll(async () => {
  worker.stop();
  for (const answer of waiting.splice(0)) answer();
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dir, { recursive: true, force: true });
});

/** Waits for something to become true, so no test sleeps for a fixed length of time. */
async function until(predicate: () => Promise<boolean>, what: string) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`timed out waiting for ${what}`);
}

async function seedBoard(name: string, autoRun: boolean) {
  const { graphql } = await import("graphql");
  const { schema } = await import("../server/graphql/schema.ts");
  const result = await graphql({
    schema,
    source: `mutation Create($name: String!, $autoRun: Boolean!) {
      createProject(values: { name: $name, autoRun: $autoRun }) { id }
    }`,
    variableValues: { name, autoRun },
  });
  expect(result.errors).toBeUndefined();
  const projectId = (result.data as { createProject: { id: string } }).createProject.id;
  const board = await db
    .select()
    .from(tables.lanes)
    .where(eq(tables.lanes.projectId, projectId))
    .orderBy(tables.lanes.position);
  return { projectId, doing: board[1], review: board[2], done: board[3] };
}

const addCards = (projectId: string, laneId: string, titles: string[]) =>
  db
    .insert(tables.cards)
    .values(titles.map((title, position) => ({ projectId, laneId, title, position })));

beforeEach(async () => {
  gated = false;
  waiting = [];
  await db.delete(tables.runs);
  await db.delete(tables.cards);
  await db.delete(tables.lanes);
  await db.delete(tables.projects);
  await db.delete(tables.agents);
  const roles = await db.select().from(tables.roles);
  for (const name of ["executor", "reviewer"] as const) {
    const role = roles.find((row) => row.name === name);
    if (!role) throw new Error(`the ${name} role was not seeded`);
    await db.insert(tables.agents).values({ name, roleId: role.id, baseUrl, model: "fake" });
  }
});

test("a board that is not on auto is left alone", async () => {
  const { projectId, doing } = await seedBoard("manual", false);
  await addCards(projectId, doing.id, ["one", "two"]);

  expect(await worker.tick()).toBe(0);
  expect(await db.select().from(tables.runs)).toHaveLength(0);
});

test("a lane starts as many cards as its WIP limit allows, and no more", async () => {
  const { projectId, doing, review, done } = await seedBoard("auto", true);
  await db.update(tables.lanes).set({ wipLimit: 2 }).where(eq(tables.lanes.id, doing.id));
  await addCards(projectId, doing.id, ["one", "two", "three"]);

  gated = true;
  expect(await worker.tick()).toBe(2);
  await until(async () => waiting.length === 2, "both runs to reach the model");

  // Nothing more goes out while those two are in flight, however often the worker looks.
  expect(await worker.tick()).toBe(0);

  gated = false;
  for (const answer of waiting.splice(0)) answer();
  await until(
    async () =>
      (await db.select().from(tables.cards).where(eq(tables.cards.laneId, review.id))).length === 2,
    "the two worked cards to reach Review",
  );

  // Left to itself, the board drains: the third card is picked up as soon as there is room,
  // and Review is a station like any other, so what lands there is worked and passed on.
  await until(async () => {
    await worker.tick();
    const rows = await db.select().from(tables.cards).where(eq(tables.cards.projectId, projectId));
    return rows.every((card) => card.laneId === done.id && card.status === "done");
  }, "the board to drain itself into Done");
});

test("a card the reviewer rejected is not picked up again on its own", async () => {
  const { projectId, doing } = await seedBoard("rejected", true);
  await addCards(projectId, doing.id, ["rejected"]);
  await db.update(tables.cards).set({ status: "error", error: "no" });

  expect(await worker.tick()).toBe(0);
  expect(await db.select().from(tables.runs)).toHaveLength(0);
});
