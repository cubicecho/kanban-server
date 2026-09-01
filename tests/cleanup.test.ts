import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kanban-server-cleanup-"));
process.env.KANBAN_SERVER_DATA_DIR = dir;

let db: typeof import("../server/db/client.ts").db;
let tables: typeof import("../server/db/schema.ts");
let prune: typeof import("../server/scheduler/cleanup.ts").prune;
let projectId: string;
let cardId: string;

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

beforeAll(async () => {
  const { ensureSchema } = await import("../server/db/migrate.ts");
  await ensureSchema();
  db = (await import("../server/db/client.ts")).db;
  tables = await import("../server/db/schema.ts");
  prune = (await import("../server/scheduler/cleanup.ts")).prune;
});

beforeEach(async () => {
  await db.delete(tables.runs);
  await db.delete(tables.cards);
  await db.delete(tables.lanes);
  await db.delete(tables.projects);
  const [project] = await db.insert(tables.projects).values({ name: "p" }).returning();
  projectId = project.id;
  const [lane] = await db
    .insert(tables.lanes)
    .values({ projectId, name: "Doing", position: 0 })
    .returning();
  const [card] = await db
    .insert(tables.cards)
    .values({ projectId, laneId: lane.id, title: "c" })
    .returning();
  cardId = card.id;
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const retention = (days: number) =>
  db
    .update(tables.settings)
    .set({ runRetentionDays: days })
    .where(eq(tables.settings.id, "default"));

const run = (age: number, status: "ok" | "running" = "ok") =>
  db
    .insert(tables.runs)
    .values({ projectId, cardId, kind: "card", status, startedAt: daysAgo(age) });

const remaining = async () => (await db.select().from(tables.runs)).length;

test("zero keeps everything, however old", async () => {
  await retention(0);
  await run(3650);

  expect(await prune()).toBe(0);
  expect(await remaining()).toBe(1);
});

test("runs past the window go and runs inside it stay", async () => {
  await retention(7);
  await run(30);
  await run(8);
  await run(6);
  await run(0);

  expect(await prune()).toBe(2);
  expect(await remaining()).toBe(2);
});

test("a run still going is never pruned, however old it looks", async () => {
  await retention(1);
  await run(90, "running");

  expect(await prune()).toBe(0);
  expect(await remaining()).toBe(1);
});

test("pruning a run leaves the card it worked on where it is", async () => {
  await retention(1);
  await run(5);

  expect(await prune()).toBe(1);
  // The history is disposable; the board is not. A card outliving its runs is the normal case.
  expect((await db.select().from(tables.cards)).length).toBe(1);
});
