import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, expect, test } from "vitest";
import type { McpServerRow } from "../server/db/schema.ts";

// Loading the runner pulls in the database module, so give it somewhere disposable first.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kanban-server-mcp-"));
process.env.KANBAN_SERVER_DATA_DIR = dir;

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

const row = (over: Partial<McpServerRow> & Pick<McpServerRow, "id" | "slug">): McpServerRow => ({
  label: "",
  enabled: true,
  transport: "stdio",
  command: process.execPath,
  args: [fixture("mcp-echo.mjs")],
  env: null,
  url: "",
  headers: null,
  cwd: null,
  connectTimeoutMs: null,
  callTimeoutMs: null,
  ...over,
});

afterAll(async () => {
  const { mcp } = await import("../server/runner/mcp.ts");
  await mcp.shutdown();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a stdio child is started where the row says, not where this process is", async () => {
  const { mcp } = await import("../server/runner/mcp.ts");
  // Resolved, because macOS hands out `/var/…` for a temp directory and the child reports the
  // `/private/var/…` it really is — the test is about which directory, not about which spelling.
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "mcp-cwd-")));

  await mcp.sync([
    row({ id: "here", slug: "here" }),
    row({ id: "there", slug: "there", cwd: home }),
  ]);

  expect(await mcp.call("here__pwd", {}, ["here"])).toBe(fs.realpathSync(process.cwd()));
  expect(await mcp.call("there__pwd", {}, ["there"])).toBe(home);

  fs.rmSync(home, { recursive: true, force: true });
});

test("a server that never answers is given up on at the row's own bound", async () => {
  const { mcp } = await import("../server/runner/mcp.ts");

  // The pool here is constructed with no `connectTimeoutMs` of its own, so without the column
  // this waits on the SDK's own minute. What the elapsed time asserts is that the row's number
  // is the one that was used, which no amount of reading the error back would show.
  const started = Date.now();
  const [state] = await mcp
    .sync([
      row({
        id: "slow",
        slug: "slow",
        args: [fixture("mcp-silent.mjs")],
        connectTimeoutMs: 400,
      }),
    ])
    .then(() => mcp.state());

  expect(state.status).toBe("error");
  expect(Date.now() - started).toBeLessThan(15_000);
});

test("a tool that never answers is given up on at the row's own bound", async () => {
  const { mcp } = await import("../server/runner/mcp.ts");
  await mcp.sync([
    row({ id: "stuck", slug: "stuck", args: [fixture("mcp-stuck.mjs")], callTimeoutMs: 300 }),
  ]);

  // As above: the pool has no `callTimeoutMs` of its own, so without the column this call waits
  // out the SDK's minute, and the elapsed time is what says the row's number was the one used.
  const started = Date.now();
  await expect(mcp.call("stuck__wait", {}, ["stuck"])).rejects.toThrow();
  expect(Date.now() - started).toBeLessThan(15_000);
});
