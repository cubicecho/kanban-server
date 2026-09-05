import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { type GraphQLSchema, graphql } from "graphql";
import { afterAll, beforeAll, expect, test } from "vitest";
import { forPicker, idOrNone } from "../web/lib/picker.ts";

// The schema is built from the live Drizzle tables at import time, so the database has to be
// pointed somewhere disposable before anything under server/ is loaded.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kanban-server-test-"));
process.env.KANBAN_SERVER_DATA_DIR = dir;

const ANY = "__any__";

let schema: GraphQLSchema;

beforeAll(async () => {
  const { ensureSchema } = await import("../server/db/migrate.ts");
  await ensureSchema();
  schema = (await import("../server/graphql/schema.ts")).schema;
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const save = (refineAgentId: string | null) =>
  graphql({
    schema,
    source: `mutation Save($id: String) {
      updateSetting(where: { id: { eq: "default" } }, set: { refineAgentId: $id }) { id }
    }`,
    variableValues: { id: refineAgentId },
  });

test("a picker holding nothing crosses to null, whichever nothing it holds", () => {
  expect(idOrNone(ANY, ANY)).toBe(null);
  expect(idOrNone("", ANY)).toBe(null);
  expect(idOrNone("__archive__", "__none__", "__archive__")).toBe(null);
  expect(idOrNone("agent-1", ANY)).toBe("agent-1");
});

test("a column holding nothing crosses to the sentinel, however it says nothing", () => {
  expect(forPicker(null, ANY)).toBe(ANY);
  expect(forPicker(undefined, ANY)).toBe(ANY);
  expect(forPicker("", ANY)).toBe(ANY);
  expect(forPicker("agent-1", ANY)).toBe("agent-1");
});

// Why `||` and not `??`: an empty string reaching the column is a foreign key with nothing to
// point at, and what comes back is an internal error naming a constraint rather than a field.
test("an empty id is refused by the column the sentinel stands for", async () => {
  const empty = await save("");
  expect(empty.errors?.[0]?.message).toBe("Internal server error");

  const crossed = await save(idOrNone("", ANY));
  expect(crossed.errors).toBeUndefined();
});
