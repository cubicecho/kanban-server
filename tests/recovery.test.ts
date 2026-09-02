import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kanban-server-recovery-"));
process.env.KANBAN_SERVER_DATA_DIR = dir;

let db: typeof import("../server/db/client.ts").db;
let tables: typeof import("../server/db/schema.ts");
let reconcile: typeof import("../server/runner/run.ts").reconcile;
let projectId: string;
let laneId: string;

beforeAll(async () => {
  const { ensureSchema } = await import("../server/db/migrate.ts");
  await ensureSchema();
  db = (await import("../server/db/client.ts")).db;
  tables = await import("../server/db/schema.ts");
  reconcile = (await import("../server/runner/run.ts")).reconcile;
});

beforeEach(async () => {
  await db.delete(tables.runs);
  await db.delete(tables.cards);
  await db.delete(tables.tasks);
  await db.delete(tables.lanes);
  await db.delete(tables.projects);
  const [project] = await db.insert(tables.projects).values({ name: "p" }).returning();
  projectId = project.id;
  const [lane] = await db
    .insert(tables.lanes)
    .values({ projectId, name: "Doing", position: 0 })
    .returning();
  laneId = lane.id;
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const card = async (status: "idle" | "running" | "done") =>
  (
    await db
      .insert(tables.cards)
      .values({ projectId, laneId, title: "c", status, attempts: 2 })
      .returning()
  )[0];

const run = async (status: "running" | "ok", cardId?: string) =>
  (
    await db
      .insert(tables.runs)
      .values({ projectId, cardId: cardId ?? null, kind: "card", status })
      .returning()
  )[0];

test("a run the process died in is closed, and its card comes back to the queue", async () => {
  const working = await card("running");
  const started = await run("running", working.id);

  expect(await reconcile()).toEqual({ runs: 1, cards: 1, tasks: 0 });

  const [after] = await db.select().from(tables.runs).where(eq(tables.runs.id, started.id));
  // `error`, not `stopped`: nobody called this off, and a run with no outcome at all would be
  // skipped by `prune` and counted by `spend` for as long as the row lasted.
  expect(after.status).toBe("error");
  expect(after.error).toMatch(/restart/i);
  expect(after.finishedAt).toBeInstanceOf(Date);

  const [back] = await db.select().from(tables.cards).where(eq(tables.cards.id, working.id));
  // Idle rather than error: nothing judged this card, so it is where it was before it was
  // picked up — which on an auto-run board is picked up again, and the WIP limit is free.
  expect(back.status).toBe("idle");
  expect(back.error).toMatch(/restart/i);
  // And it costs the card nothing: a restart is not a failed attempt at the work.
  expect(back.attempts).toBe(2);
});

test("a task caught mid-decomposition is left to be asked for again", async () => {
  const [task] = await db
    .insert(tables.tasks)
    .values({ projectId, title: "t", brief: "b", status: "decomposing" })
    .returning();

  expect((await reconcile()).tasks).toBe(1);

  const [after] = await db.select().from(tables.tasks).where(eq(tables.tasks.id, task.id));
  expect(after.status).toBe("error");
  expect(after.error).toMatch(/restart/i);
});

test("what was not running is not touched", async () => {
  const idle = await card("idle");
  const finished = await card("done");
  const ok = await run("ok");
  const [ready] = await db
    .insert(tables.tasks)
    .values({ projectId, title: "t", brief: "b", status: "ready" })
    .returning();

  expect(await reconcile()).toEqual({ runs: 0, cards: 0, tasks: 0 });

  expect((await db.select().from(tables.cards).where(eq(tables.cards.id, idle.id)))[0].status).toBe(
    "idle",
  );
  expect(
    (await db.select().from(tables.cards).where(eq(tables.cards.id, finished.id)))[0].status,
  ).toBe("done");
  expect((await db.select().from(tables.runs).where(eq(tables.runs.id, ok.id)))[0].status).toBe(
    "ok",
  );
  expect(
    (await db.select().from(tables.tasks).where(eq(tables.tasks.id, ready.id)))[0].status,
  ).toBe("ready");
});
