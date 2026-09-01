import fs from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import { afterAll, beforeAll, expect, test } from "vitest";

// The endpoint serves the real schema, which is built against the live tables.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kanban-server-mcp-"));
process.env.KANBAN_SERVER_DATA_DIR = dir;

let events: typeof import("../server/runner/events.ts");
let server: Server;
let endpoint: URL;
let client: Client;

beforeAll(async () => {
  const { ensureSchema } = await import("../server/db/migrate.ts");
  await ensureSchema();
  events = await import("../server/runner/events.ts");
  const { mountMcp } = await import("../server/mcp-endpoint.ts");

  // The same mount the server uses, so what a client meets here is what it meets in production.
  const app = express();
  mountMcp(app);
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  endpoint = new URL(`http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`);

  client = new Client({ name: "test-client", version: "0.0.0" });
  await client.connect(new StreamableHTTPClientTransport(endpoint));
});

afterAll(async () => {
  await client.close();
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dir, { recursive: true, force: true });
});

/** Tools answer with the GraphQL envelope as JSON text; this is the `data` half of it. */
async function call(name: string, args: Record<string, unknown> = {}) {
  const { text } = await raw(name, args);
  // Not every failure arrives as an envelope: an argument the driver rejects comes back as a
  // bare `MCP error -32602: …` string, and parsing that blind reports a `SyntaxError` about a
  // stray `M`, which says nothing about the call that actually went wrong.
  let envelope: { data?: Record<string, unknown>; errors?: unknown };
  try {
    envelope = JSON.parse(text);
  } catch {
    throw new Error(`${name} did not answer with an envelope: ${text}`);
  }
  if (envelope.errors) throw new Error(`${name}: ${JSON.stringify(envelope.errors)}`);
  return envelope.data ?? {};
}

/** The result as the client meets it, for the calls that are meant to fail. */
async function raw(name: string, args: Record<string, unknown> = {}) {
  const result = (await client.callTool({ name, arguments: args })) as CallToolResult;
  const [content] = result.content;
  if (content?.type !== "text") throw new Error(`no text in the result of ${name}`);
  return { isError: result.isError === true, text: content.text };
}

test("offers the board tools, and only those", async () => {
  const { tools } = await client.listTools();
  const names = tools.map((tool) => tool.name).sort();

  // snake_case: the driver renames after it filters, so `include` names the GraphQL field and
  // this names the tool.
  expect(names).toEqual([
    "accept_task",
    "agents",
    "cards",
    "create_card",
    "create_project",
    "create_task",
    "decompose_task",
    "delete_card_single",
    "delete_task_single",
    "lanes",
    "move_card",
    "projects",
    "refine_task",
    "retry_card",
    "run_card",
    "run_events",
    "runs",
    "stop_card",
    "stop_task",
    "submit_task",
    "tasks",
    "update_card_single",
    "update_project_single",
  ]);

  // The settings row holds the API key; agents hold their own. Neither is a visitor's to
  // rewrite, and a bulk delete with no `where` empties a table in one call.
  expect(names).not.toContain("set_api_key");
  expect(names).not.toContain("settings");
  expect(names).not.toContain("update_agent_single");
  expect(names).not.toContain("mcp_servers");
  expect(names).not.toContain("delete_card");
  expect(names).not.toContain("delete_project_single");
});

test("advertises tools small enough for a client to read", async () => {
  const { tools } = await client.listTools();

  // Every tool definition a client is handed before it can call anything, and the reason this
  // is asserted: the generated `where` reaches through relations — a project filtered by its
  // cards, each card filtered back by its project — and a driver that rebuilds those types per
  // route rather than emitting a `$ref` writes the recursion out at every level. That is a
  // difference of orders of magnitude, and it lands before a single call can be made.
  const sizes = tools.map((tool) => [tool.name, JSON.stringify(tool).length] as const);
  for (const [name, size] of sizes) {
    expect(size, `${name} is ${(size / 1024).toFixed(0)} kB`).toBeLessThan(150_000);
  }
  expect(sizes.reduce((total, [, size]) => total + size, 0)).toBeLessThan(1_200_000);
});

test("makes a project, hands it a task, and reads the board back", async () => {
  const created = (await call("create_project", {
    values: { name: "from mcp", context: "a board made over MCP" },
  })) as { createProject: { id: string; name: string } };
  const projectId = created.createProject.id;
  expect(created.createProject.name).toBe("from mcp");

  // The seeded lanes are the point: a project made over MCP is as ready for work as one made
  // in the UI, without the caller knowing a board has columns at all.
  const board = (await call("lanes", { where: { projectId: { eq: projectId } } })) as {
    lanes: { name: string; intake: boolean }[];
  };
  expect(board.lanes.map((lane) => lane.name).sort()).toEqual([
    "Backlog",
    "Doing",
    "Done",
    "Review",
  ]);

  const task = (await call("create_task", {
    values: { projectId, title: "written elsewhere", brief: "do the thing" },
  })) as { createTask: { id: string; status: string } };
  expect(task.createTask.status).toBe("draft");

  const listed = (await call("tasks", { where: { projectId: { eq: projectId } } })) as {
    tasks: { id: string; brief: string }[];
  };
  expect(listed.tasks).toHaveLength(1);
  expect(listed.tasks[0].brief).toBe("do the thing");

  // Nothing has run, so this is empty for the project rather than missing.
  expect(await call("runs", { where: { projectId: { eq: projectId } } })).toEqual({ runs: [] });

  await call("delete_task_single", { where: { id: { eq: task.createTask.id } } });
  expect(await call("tasks", { where: { projectId: { eq: projectId } } })).toEqual({ tasks: [] });
});

test("puts a single card on a board, with no task behind it", async () => {
  const created = (await call("create_project", { values: { name: "by hand" } })) as {
    createProject: { id: string };
  };
  const projectId = created.createProject.id;
  const board = (await call("lanes", { where: { projectId: { eq: projectId } } })) as {
    lanes: { id: string; name: string; intake: boolean }[];
  };
  const backlog = board.lanes.find((lane) => lane.intake);
  if (!backlog) throw new Error("the seeded board has no intake lane");

  const card = (await call("create_card", {
    values: {
      projectId,
      laneId: backlog.id,
      title: "rotate the signing key",
      acceptance: "the old key is revoked and nothing 401s",
    },
  })) as { createCard: { id: string; status: string; laneId: string } };
  expect(card.createCard).toMatchObject({ laneId: backlog.id, status: "idle" });

  // No task behind it, and that is the record: this is work someone knew the shape of, not
  // work a decomposer produced.
  const listed = (await call("cards", { where: { projectId: { eq: projectId } } })) as {
    cards: { title: string; taskId: string | null; acceptance: string }[];
  };
  expect(listed.cards).toHaveLength(1);
  expect(listed.cards[0].taskId).toBeNull();
  expect(listed.cards[0].acceptance).toBe("the old key is revoked and nothing 401s");

  // The lane is not optional, and the failure says so rather than inventing one.
  const missing = await raw("create_card", { values: { projectId, title: "nowhere" } });
  expect(missing.isError).toBe(true);
  expect(missing.text).toMatch(/laneId/i);
});

test("hands a run's progress to a client that polls for it", async () => {
  events.reset();
  events.emit("run-mcp", { kind: "notice", text: 'working "write it"' });
  for (const piece of ["think", "ing ", "out ", "loud"]) {
    events.emit("run-mcp", { kind: "thinking", text: piece });
  }
  events.emit("run-mcp", { kind: "tool-call", name: "echo__ping", text: "{}" });

  const first = (await call("run_events", { runId: "run-mcp" })) as {
    runEvents: { seq: number; kind: string; text: string }[];
  };
  // Four thinking deltas are one thought: a client reading in snapshots gets prose, not tokens.
  expect(first.runEvents.map((event) => event.kind)).toEqual(["notice", "thinking", "tool-call"]);
  expect(first.runEvents[1].text).toBe("thinking out loud");

  const last = first.runEvents[first.runEvents.length - 1].seq;
  events.emit("run-mcp", { kind: "done", ok: true, text: "finished" });
  const next = (await call("run_events", { runId: "run-mcp", afterSeq: last })) as {
    runEvents: { kind: string; text: string }[];
  };
  // Resuming from the last `seq` reads what came after it, and nothing twice.
  expect(next.runEvents).toEqual([expect.objectContaining({ kind: "done", text: "finished" })]);
});

test("answers the whole transport, not just the calls", async () => {
  // A client that opens the notification stream, or asks to end its session, must meet the
  // transport rather than Express's 404 — which would read as "wrong URL" instead of "nothing
  // to say". Nothing is ever sent on this stream: the endpoint is stateless.
  const opened = await fetch(endpoint, { headers: { accept: "text/event-stream" } });
  expect(opened.status).toBe(200);
  expect(opened.headers.get("content-type")).toContain("text/event-stream");
  // Cancelled rather than aborted: aborting the request rejects the body stream nobody is
  // reading, and an unhandled rejection there takes the whole vitest worker down with it.
  await opened.body?.cancel();

  expect((await fetch(endpoint, { method: "DELETE" })).status).toBe(200);

  // And it says what is wrong in JSON-RPC, which is what a client knows how to read.
  const wrong = await fetch(endpoint);
  expect(wrong.status).toBe(406);
  expect(await wrong.json()).toMatchObject({ jsonrpc: "2.0", error: { code: -32000 } });
});

test("rejects an argument it does not recognise instead of dropping it", async () => {
  const misspelled = await raw("cards", { wehre: { id: { eq: "x" } } });
  expect(misspelled.isError).toBe(true);
  expect(misspelled.text).toContain("wehre");

  const badType = await raw("cards", { limit: "ten" });
  expect(badType.isError).toBe(true);
  expect(badType.text).toContain("limit");
});

test("marks only the tools that actually destroy something", async () => {
  const { tools } = await client.listTools();
  const flagged = (hint: "destructiveHint" | "idempotentHint") =>
    tools
      .filter((tool) => tool.annotations?.[hint])
      .map((tool) => tool.name)
      .sort();

  // The updates rewrite a row, the deletes are the real thing, and stopping a run throws away
  // what it had done. Starting an agent is none of those — a client that gates on this hint
  // should be spending the operator's attention on the deletes.
  expect(flagged("destructiveHint")).toEqual([
    "delete_card_single",
    "delete_task_single",
    "stop_card",
    "stop_task",
    "update_card_single",
    "update_project_single",
  ]);

  // Landing the same way twice. Every read is one, so the interesting half is the writes:
  // the deletes, and the three that describe a state rather than an action. Decomposing a task
  // twice makes two sets of cards, and refining it twice is two turns, so neither is among them.
  const writes = new Set([
    "accept_task",
    "create_card",
    "create_project",
    "create_task",
    "decompose_task",
    "delete_card_single",
    "delete_task_single",
    "move_card",
    "refine_task",
    "retry_card",
    "run_card",
    "stop_card",
    "stop_task",
    "submit_task",
    "update_card_single",
    "update_project_single",
  ]);
  expect(flagged("idempotentHint").filter((name) => writes.has(name))).toEqual([
    "accept_task",
    "delete_card_single",
    "delete_task_single",
    "move_card",
    "retry_card",
    "stop_card",
    "stop_task",
  ]);
  // And every read is marked as one, which is what lets a client re-ask without asking anyone.
  expect(flagged("idempotentHint").filter((name) => !writes.has(name))).toEqual([
    "agents",
    "cards",
    "lanes",
    "projects",
    "run_events",
    "runs",
    "tasks",
  ]);
});

test("says what a card is, for a client that has only ever seen a task", async () => {
  const { tools } = await client.listTools();
  const described = (name: string) => tools.find((tool) => tool.name === name)?.description ?? "";

  // The generated tools describe themselves as "the `cards` query" and nothing more, which
  // leaves a visiting agent no way to learn the one distinction the whole server turns on.
  expect(described("cards")).toMatch(/units of work/i);
  expect(described("tasks")).toMatch(/decomposed/i);
  expect(described("submit_task")).toMatch(/brief/i);
  // A client that has only ever made tasks needs telling that this one lands nowhere by itself.
  expect(described("create_card")).toMatch(/laneId/);
});
