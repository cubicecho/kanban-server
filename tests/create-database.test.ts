import { expect, test } from "vitest";

// `memory://` from vitest.config.ts, so importing this claims no directory and starts no
// postgres server — the URL arithmetic is pure and `ensureDatabase` has nothing to do.
const { adminTargets, ensureDatabase, quoteIdent } = await import("../server/db/client.ts");

test("the database a URL names is the one that would be created", () => {
  expect(adminTargets("postgres://kanban:kanban@db:5432/kanban").name).toBe("kanban");
});

test("the maintenance databases are tried postgres first, then template1", () => {
  expect(adminTargets("postgres://kanban@db:5432/boards").urls).toEqual([
    "postgres://kanban@db:5432/postgres",
    "postgres://kanban@db:5432/template1",
  ]);
});

// The admin URL is the same connection with a different database on the end of it: a password,
// a port and an `sslmode` are all part of reaching that server at all.
test("credentials and connection parameters survive the rewrite", () => {
  const { urls } = adminTargets(
    "postgresql://kanban:p%40ss@db.example:6432/kanban?sslmode=require",
  );
  expect(urls[0]).toBe("postgresql://kanban:p%40ss@db.example:6432/postgres?sslmode=require");
});

test("a percent-encoded database name is decoded before it is quoted", () => {
  expect(adminTargets("postgres://db/my%20boards").name).toBe("my boards");
});

// libpq falls back to the role name when the URL names no database, and a fallback is not a
// name anybody asked us to create — the caller reports the missing database instead.
test("a URL with no database names nothing", () => {
  expect(adminTargets("postgres://kanban@db:5432").name).toBe("");
});

// `CREATE DATABASE` takes no bind parameters, so the name goes into the statement as text and
// the quoting is the only thing between a URL and arbitrary SQL.
test("a quote in the name is doubled rather than closing the identifier", () => {
  expect(quoteIdent('odd"name')).toBe('"odd""name"');
  expect(quoteIdent("kanban")).toBe('"kanban"');
});

test("there is nothing to create on PGlite", async () => {
  await expect(ensureDatabase()).resolves.toBeUndefined();
});
