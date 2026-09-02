import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { replyWith } from "./fixtures/sse.ts";

// Everything under server/ builds against the live tables, so the database needs a home first.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kanban-server-board-"));
process.env.KANBAN_SERVER_DATA_DIR = dir;

/** What the fake model says next, one per request, in order. */
let replies: string[] = [];
/** Set by a test that cares what was actually sent rather than only what came back. */
let bodies: ((body: { messages: { role: string; content: string }[] }) => void) | undefined;
let server: http.Server;
let baseUrl = "";

let db: typeof import("../server/db/client.ts").db;
let tables: typeof import("../server/db/schema.ts");
let runner: typeof import("../server/runner/run.ts");

const completion = (content: string) => ({
  id: "chatcmpl-test",
  model: "fake",
  choices: [{ message: { content } }],
  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
});

beforeAll(async () => {
  server = http.createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      const sent = JSON.parse(body);
      bodies?.(sent);
      replyWith(response, completion(replies.shift() ?? "ok"), sent);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/v1`;

  const { ensureSchema } = await import("../server/db/migrate.ts");
  await ensureSchema();
  db = (await import("../server/db/client.ts")).db;
  tables = await import("../server/db/schema.ts");
  runner = await import("../server/runner/run.ts");
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dir, { recursive: true, force: true });
});

/** The three agents a board needs, each filling a seeded role and pointed at the fake model. */
const seedAgents = async () => {
  const roles = await db.select().from(tables.roles);
  for (const name of ["decomposer", "executor", "reviewer"] as const) {
    const role = roles.find((row) => row.name === name);
    if (!role) throw new Error(`the ${name} role was not seeded`);
    await db.insert(tables.agents).values({ name, roleId: role.id, baseUrl, model: "fake" });
  }
};

/** A project with the seeded board, which the GraphQL layer writes rather than the tables. */
async function seedProject(name: string) {
  const { graphql } = await import("graphql");
  const { schema } = await import("../server/graphql/schema.ts");
  const result = await graphql({
    schema,
    source: `mutation Create($name: String!) { createProject(values: { name: $name }) { id } }`,
    variableValues: { name },
  });
  expect(result.errors).toBeUndefined();
  const projectId = (result.data as { createProject: { id: string } }).createProject.id;
  const board = await db
    .select()
    .from(tables.lanes)
    .where(eq(tables.lanes.projectId, projectId))
    .orderBy(tables.lanes.position);
  return { projectId, backlog: board[0], doing: board[1], review: board[2], done: board[3] };
}

const cardById = async (id: string) => {
  const [card] = await db.select().from(tables.cards).where(eq(tables.cards.id, id)).limit(1);
  return card;
};

beforeEach(async () => {
  replies = [];
  await db.delete(tables.runs);
  await db.delete(tables.cardDeps);
  await db.delete(tables.cards);
  await db.delete(tables.tasks);
  await db.delete(tables.lanes);
  await db.delete(tables.projects);
  await db.delete(tables.agents);
  await seedAgents();
});

test("a decomposition puts the cards in the intake lane, in the order it gave them", async () => {
  const { projectId, backlog } = await seedProject("shipping");
  const [task] = await db
    .insert(tables.tasks)
    .values({ projectId, title: "ship", brief: "make the thing", status: "ready" })
    .returning();

  replies = [
    JSON.stringify([
      { title: "write it", body: "the code", acceptance: "it compiles" },
      { title: "test it", dependsOn: ["write it"] },
      { title: "ship it", dependsOn: ["test it", "a card nobody proposed"] },
    ]),
  ];

  const run = await runner.decomposeTask(task.id);
  expect(run.status).toBe("ok");

  const written = await db
    .select()
    .from(tables.cards)
    .where(eq(tables.cards.projectId, projectId))
    .orderBy(tables.cards.position);
  expect(written.map((card) => card.title)).toEqual(["write it", "test it", "ship it"]);
  expect(written.every((card) => card.laneId === backlog.id)).toBe(true);
  expect(written[0].acceptance).toBe("it compiles");

  // Two links, not three: the dependency naming a card that was never proposed is dropped
  // rather than failing a decomposition that was otherwise fine.
  const deps = await db.select().from(tables.cardDeps);
  expect(deps).toHaveLength(2);

  const [after] = await db.select().from(tables.tasks).where(eq(tables.tasks.id, task.id));
  expect(after.status).toBe("decomposed");
});

test("a decomposition that produces nothing readable is an error on the task", async () => {
  const { projectId } = await seedProject("mumbling");
  const [task] = await db
    .insert(tables.tasks)
    .values({ projectId, title: "vague", brief: "do something", status: "ready" })
    .returning();

  replies = ["I would rather not."];
  const run = await runner.decomposeTask(task.id);

  expect(run.status).toBe("error");
  const [after] = await db.select().from(tables.tasks).where(eq(tables.tasks.id, task.id));
  expect(after.status).toBe("error");
  expect(after.error).toMatch(/no cards/i);
  expect(await db.select().from(tables.cards)).toHaveLength(0);
});

test("a worked card moves to the review lane and waits there rather than counting as done", async () => {
  const { projectId, doing, review } = await seedProject("pipeline");
  const [card] = await db
    .insert(tables.cards)
    .values({ projectId, laneId: doing.id, title: "write it" })
    .returning();

  replies = ["wrote it"];
  const run = await runner.runCard(card.id);
  expect(run.status).toBe("ok");

  const after = await cardById(card.id);
  expect(after.laneId).toBe(review.id);
  expect(after.result).toBe("wrote it");
  // Idle, because Review has an agent of its own: a card marked done would never be picked up.
  expect(after.status).toBe("idle");
});

test("a reviewer that says FAIL sends the card back, and one that rambles does not", async () => {
  const { projectId, doing, review, done } = await seedProject("reviewing");
  const make = async () =>
    (
      await db
        .insert(tables.cards)
        .values({ projectId, laneId: review.id, title: "check it" })
        .returning()
    )[0];

  const rejected = await make();
  replies = ["FAIL: the tests do not run"];
  await runner.runCard(rejected.id);
  const back = await cardById(rejected.id);
  expect(back.laneId).toBe(doing.id);
  // Left in error rather than idle on purpose: the failure arm of a review is a loop, and a
  // card that goes round it on its own would be worked and rejected forever.
  expect(back.status).toBe("error");
  expect(back.error).toMatch(/tests do not run/);

  const passed = await make();
  replies = ["Looks fine to me, though the naming is a bit off."];
  await runner.runCard(passed.id);
  const forward = await cardById(passed.id);
  expect(forward.laneId).toBe(done.id);
  // Done has no agent, so nothing more will happen to this card and it says so.
  expect(forward.status).toBe("done");
});

test("the verdict is the lane's to read, not the agent's to declare", async () => {
  const { projectId, doing, review, done } = await seedProject("stations");
  // The same reviewing agent in both lanes. Only Review is set to read what it says as a
  // ruling, so the identical answer means two different things depending on where it lands.
  const [reviewer] = await db
    .select()
    .from(tables.agents)
    .where(eq(tables.agents.name, "reviewer"))
    .limit(1);
  await db.update(tables.lanes).set({ agentId: reviewer.id }).where(eq(tables.lanes.id, doing.id));

  const worked = (
    await db
      .insert(tables.cards)
      .values({ projectId, laneId: doing.id, title: "worked, not judged" })
      .returning()
  )[0];
  replies = ["FAIL: this is prose, not a verdict"];
  await runner.runCard(worked.id);
  const forward = await cardById(worked.id);
  // Doing does not read verdicts, so a leading FAIL is just the first word of a report.
  expect(forward.laneId).toBe(review.id);
  expect(forward.status).toBe("idle");
  expect(forward.error).toBe("");

  const judged = (
    await db
      .insert(tables.cards)
      .values({ projectId, laneId: review.id, title: "judged" })
      .returning()
  )[0];
  replies = ["FAIL: this is a verdict"];
  await runner.runCard(judged.id);
  const back = await cardById(judged.id);
  expect(back.laneId).toBe(doing.id);
  expect(back.status).toBe("error");
  expect(done).toBeDefined();
});

test("an agent with no prompt of its own is told its role's", async () => {
  const { projectId, doing } = await seedProject("inherited prompts");
  const sent: string[] = [];
  const listener = (body: { messages: { role: string; content: string }[] }) => {
    sent.push(body.messages[0].content);
  };
  bodies = listener;

  const [card] = await db
    .insert(tables.cards)
    .values({ projectId, laneId: doing.id, title: "anything" })
    .returning();
  replies = ["done"];
  await runner.runCard(card.id);
  expect(sent[0]).toContain("You carry out one card of work");

  // And an agent that writes its own overrides the role rather than appending to it.
  await db
    .update(tables.agents)
    .set({ systemPrompt: "You are terse." })
    .where(eq(tables.agents.name, "executor"));
  const [second] = await db
    .insert(tables.cards)
    .values({ projectId, laneId: doing.id, title: "again" })
    .returning();
  replies = ["done"];
  await runner.runCard(second.id);
  expect(sent[1]).toBe("You are terse.");
  bodies = undefined;
});

test("a card waiting on an unfinished one does not run", async () => {
  const { projectId, doing } = await seedProject("ordering");
  const [first] = await db
    .insert(tables.cards)
    .values({ projectId, laneId: doing.id, title: "first", position: 0 })
    .returning();
  const [second] = await db
    .insert(tables.cards)
    .values({ projectId, laneId: doing.id, title: "second", position: 1 })
    .returning();
  await db.insert(tables.cardDeps).values({ cardId: second.id, dependsOnCardId: first.id });

  await expect(runner.runCard(second.id)).rejects.toThrow(/waiting on/);
  expect((await cardById(second.id)).status).toBe("blocked");

  // Only the one that can be worked is offered, and no run was started for the other.
  expect((await runner.readyCards(doing.id)).map((card) => card.title)).toEqual(["first"]);
  expect(await db.select().from(tables.runs)).toHaveLength(0);

  await db.update(tables.cards).set({ status: "done" }).where(eq(tables.cards.id, first.id));
  expect((await runner.readyCards(doing.id)).map((card) => card.title)).toEqual(["second"]);
});

test("a station with attempts to spend puts a rejected card back in play, then stops", async () => {
  const { projectId, doing, review } = await seedProject("rework");
  // One attempt: Review will send a card back once, and the second FAIL is where the board
  // stops guessing and waits for a person.
  await db.update(tables.lanes).set({ maxAttempts: 1 }).where(eq(tables.lanes.id, review.id));

  const [card] = await db
    .insert(tables.cards)
    .values({ projectId, laneId: review.id, title: "check it" })
    .returning();

  replies = ["FAIL: the tests do not run"];
  await runner.runCard(card.id);
  const first = await cardById(card.id);
  // Back in Doing and idle rather than error: the lane still had an attempt to spend, so the
  // worker picks this up and has another go without anybody being asked.
  expect(first.laneId).toBe(doing.id);
  expect(first.status).toBe("idle");
  expect(first.attempts).toBe(1);
  expect(first.error).toMatch(/tests do not run/);

  // Round it goes: worked again, and offered up for review again. A pass does not hand the
  // attempt back — a budget that refilled every time it was used would never run out.
  replies = ["fixed the tests"];
  await runner.runCard(first.id);
  const second = await cardById(card.id);
  expect(second.laneId).toBe(review.id);
  expect(second.status).toBe("idle");
  expect(second.attempts).toBe(1);

  replies = ["FAIL: still no"];
  await runner.runCard(second.id);
  const third = await cardById(card.id);
  expect(third.laneId).toBe(doing.id);
  expect(third.status).toBe("error");
  expect(third.attempts).toBe(2);
});

test("a lane retries its own failures in place, up to its budget", async () => {
  const { projectId, doing } = await seedProject("flaky");
  // No failure arm, so a card that fails here stays here — which is a retry when the lane has
  // an attempt for it, and where the card stops when it does not.
  await db
    .update(tables.lanes)
    .set({ maxAttempts: 1, onFailureLaneId: null })
    .where(eq(tables.lanes.id, doing.id));

  const [card] = await db
    .insert(tables.cards)
    .values({ projectId, laneId: doing.id, title: "flaky work" })
    .returning();

  // The endpoint is gone, so the run fails before the model says anything.
  const [executor] = await db
    .select()
    .from(tables.agents)
    .where(eq(tables.agents.name, "executor"))
    .limit(1);
  await db
    .update(tables.agents)
    .set({ baseUrl: "http://127.0.0.1:1/v1", maxRetries: 0 })
    .where(eq(tables.agents.id, executor.id));

  const run = await runner.runCard(card.id);
  expect(run.status).toBe("error");
  const once = await cardById(card.id);
  expect(once.laneId).toBe(doing.id);
  expect(once.status).toBe("idle");
  expect(once.attempts).toBe(1);

  await runner.runCard(card.id);
  const twice = await cardById(card.id);
  expect(twice.status).toBe("error");
  expect(twice.attempts).toBe(2);

  await db
    .update(tables.agents)
    .set({ baseUrl, maxRetries: -1 })
    .where(eq(tables.agents.id, executor.id));
});

test("a verdict is not an account of the work, and does not overwrite one", async () => {
  const { projectId, doing, review } = await seedProject("reports");
  await db.update(tables.lanes).set({ maxAttempts: 1 }).where(eq(tables.lanes.id, review.id));
  const sent: string[] = [];
  bodies = (body) => sent.push(body.messages[body.messages.length - 1].content);

  const [card] = await db
    .insert(tables.cards)
    .values({ projectId, laneId: doing.id, title: "write it" })
    .returning();

  replies = ["wrote it, in src/thing.ts"];
  await runner.runCard(card.id);
  replies = ["FAIL: nothing covers the empty case"];
  await runner.runCard(card.id);

  const back = await cardById(card.id);
  expect(back.laneId).toBe(doing.id);
  // The reviewer said what it thought of the work, not what the work was. Losing the executor's
  // own report here would leave the next attempt starting from nothing.
  expect(back.result).toBe("wrote it, in src/thing.ts");
  expect(back.error).toMatch(/empty case/);

  replies = ["covered it"];
  await runner.runCard(back.id);
  // And the agent having another go is told both halves: what was done, and why it came back.
  expect(sent[2]).toContain("wrote it, in src/thing.ts");
  expect(sent[2]).toContain("Why this came back");
  expect(sent[2]).toContain("empty case");
  bodies = undefined;
});

test("a lane with no agent runs nothing", async () => {
  const { projectId, backlog } = await seedProject("backlogged");
  const [card] = await db
    .insert(tables.cards)
    .values({ projectId, laneId: backlog.id, title: "someday" })
    .returning();

  await expect(runner.runCard(card.id)).rejects.toThrow(/no agent/);
});
