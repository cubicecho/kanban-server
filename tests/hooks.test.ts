import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, test } from "vitest";
import { replyWith } from "./fixtures/sse.ts";
import { stop } from "./fixtures/teardown.ts";

// Everything under server/ builds against the live tables, so the database needs a home first.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kanban-server-hooks-"));
process.env.KANBAN_SERVER_DATA_DIR = dir;

interface ChatRequest {
  messages: { role: string; content: string }[];
  tools?: { function: { name: string } }[];
  stream?: boolean;
  stream_options?: { include_usage?: boolean };
}

/** Every request the fake model was sent, so a test can read the prompt the hooks built. */
let sent: ChatRequest[] = [];
let server: http.Server;
let baseUrl = "";

let db: typeof import("../server/db/client.ts").db;
let tables: typeof import("../server/db/schema.ts");
let mcp: typeof import("../server/runner/mcp.ts").mcp;

const SERVER_ID = "memory-1";

const completion = (content: string) => ({
  id: "chatcmpl-test",
  model: "fake",
  choices: [{ message: { content } }],
  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
});

async function gql(source: string, variableValues?: Record<string, unknown>) {
  const { graphql } = await import("graphql");
  const { schema } = await import("../server/graphql/schema.ts");
  return graphql({ schema, source, variableValues });
}

/** What the memory server has been asked so far, through the pool's own door for hidden tools. */
const memoryCalls = async () =>
  JSON.parse(await mcp.call("memory__calls", {}, { servers: [SERVER_ID], hidden: true })) as {
    name: string;
    args: Record<string, unknown>;
  }[];

/** An unawaited hook lands when it lands; this waits for it rather than for a guessed interval. */
async function eventually<T>(read: () => Promise<T>, done: (value: T) => boolean) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const value = await read();
    if (done(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("timed out waiting");
}

beforeAll(async () => {
  server = http.createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      const parsed = JSON.parse(body) as ChatRequest;
      sent.push(parsed);
      replyWith(response, completion("done it"), parsed);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/v1`;

  const { ensureSchema } = await import("../server/db/migrate.ts");
  await ensureSchema();
  db = (await import("../server/db/client.ts")).db;
  tables = await import("../server/db/schema.ts");
  mcp = (await import("../server/runner/mcp.ts")).mcp;

  await db.insert(tables.mcpServers).values({
    id: SERVER_ID,
    slug: "memory",
    transport: "stdio",
    command: process.execPath,
    args: [fileURLToPath(new URL("./fixtures/mcp-memory.mjs", import.meta.url))],
    hiddenTools: ["remember", "forget", "calls"],
    hooks: [
      {
        id: "recall",
        on: "beforeTurn",
        tool: "recall",
        args: { query: "{{prompt}}", session: "{{session.id}}" },
        inject: true,
      },
      {
        id: "remember",
        on: "afterTurn",
        tool: "remember",
        args: { session: "{{session.id}}", reply: "{{reply}}", project: "{{vars.projectId}}" },
      },
      { id: "ended", on: "sessionEnd", tool: "remember", args: { status: "{{status}}" } },
      { id: "forget", on: "sessionDelete", tool: "forget", args: { session: "{{session.id}}" } },
    ],
  });
  await mcp.sync();
});

afterAll(async () => {
  await mcp.shutdown();
  await stop(server);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the web's copy of the template variables is the pool's", async () => {
  const { hookVars } = await import("@cubicecho/agent-mcp-pool");
  const { COMMON_HOOK_VARS, HOOK_EVENTS, HOOK_VARS } = await import("../shared/hooks.ts");
  for (const event of Object.keys(HOOK_EVENTS) as (keyof typeof HOOK_VARS)[])
    expect([...COMMON_HOOK_VARS, ...HOOK_VARS[event]]).toEqual(hookVars(event));
});

test("a row's hooks are checked before they are written, and the refusal names the hook", async () => {
  const { hookProblems } = await import("../server/runner/hooks.ts");
  expect(hookProblems({ hiddenTools: ["a"], hooks: [] })).toEqual([]);
  expect(hookProblems({ hiddenTools: "remember" })).toEqual([
    "hiddenTools must be a list of tool names",
  ]);
  expect(hookProblems({ hooks: [42] })).toEqual(["hook 1: must be an object"]);

  const result = await gql(
    `mutation Set($id: String!, $hooks: JSON!) {
      updateMcpServer(where: { id: { eq: $id } }, set: { hooks: $hooks }) { id }
    }`,
    { id: SERVER_ID, hooks: [{ id: "late", on: "afterTurn", tool: "recall", inject: true }] },
  );
  expect(result.errors?.[0].extensions?.code).toBe("BAD_HOOKS");
  expect(result.errors?.[0].message).toMatch(/only sessionStart and beforeTurn can inject/);
  const [row] = await db
    .select({ hooks: tables.mcpServers.hooks })
    .from(tables.mcpServers)
    .where(eq(tables.mcpServers.id, SERVER_ID));
  expect(row.hooks).toHaveLength(4);
});

test("a hidden tool is never offered, and is refused to anyone but a hook", async () => {
  const names = mcp
    .tools({ servers: [SERVER_ID] })
    .flatMap((tool) => (tool.type === "function" ? [tool.function.name] : []));
  expect(names).toEqual(["memory__recall"]);
  await expect(mcp.call("memory__remember", {}, [SERVER_ID])).rejects.toThrow();
});

test("a card's run is handed what the hooks recall, and remembered once it is done", async () => {
  const [agent] = await db
    .insert(tables.agents)
    .values({
      name: "worker",
      baseUrl,
      model: "fake",
      toolDiscovery: "eager",
      systemPrompt: "You are the careful one.",
    })
    .returning();
  await db.insert(tables.agentServers).values({ agentId: agent.id, serverId: SERVER_ID });
  const created = await gql(
    `mutation Create($name: String!) { createProject(values: { name: $name }) { id } }`,
    { name: "hooked" },
  );
  expect(created.errors).toBeUndefined();
  const projectId = (created.data as { createProject: { id: string } }).createProject.id;
  const board = await db
    .select()
    .from(tables.lanes)
    .where(eq(tables.lanes.projectId, projectId))
    .orderBy(tables.lanes.position);
  const doing = board[2];
  await db
    .update(tables.lanes)
    .set({ prompt: "This board keeps a changelog." })
    .where(eq(tables.lanes.id, doing.id));
  const [card] = await db
    .insert(tables.cards)
    .values({ projectId, laneId: doing.id, title: "indent the file", body: "use the house style" })
    .returning();

  const runner = await import("../server/runner/run.ts");
  sent = [];
  const run = await runner.runCard(card.id, agent.id);
  expect(run.status).toBe("ok");

  // The recall went ahead of the card's own prompt, and the model was never offered the rest.
  const user = sent[0].messages.find((message) => message.role === "user")?.content ?? "";
  expect(user).toContain(`The owner prefers tabs. (session ${card.id})`);
  expect(user.indexOf("prefers tabs")).toBeLessThan(user.indexOf("indent the file"));
  // Added to, never instead of: the card's prompt arrives whole after the context, and the system
  // prompt is every layer it would have been with no hooks at all and not a word of the recall.
  expect(user.endsWith("Card: indent the file\n\nuse the house style")).toBe(true);
  const { EXECUTE_SYSTEM } = await import("../server/runner/prompts.ts");
  for (const request of sent) {
    const system = request.messages.filter((message) => message.role === "system");
    expect(system).toHaveLength(1);
    expect(request.messages[0]).toEqual({
      role: "system",
      content: [
        "Project: hooked",
        "You are the careful one.",
        EXECUTE_SYSTEM,
        "This board keeps a changelog.",
      ].join("\n\n"),
    });
  }
  // `record_artifact` is the runner's own, offered to any card run that has tools to store with.
  expect((sent[0].tools ?? []).map((tool) => tool.function.name)).toEqual([
    "memory__recall",
    "record_artifact",
  ]);
  expect(run.hooks).toEqual([
    expect.objectContaining({ event: "beforeTurn", hookId: "recall", tokens: expect.any(Number) }),
  ]);

  // A watcher sees what was recalled while the run is going, not only that something was.
  const { history } = await import("@cubicecho/agent-core");
  // The run's own hooks, that is: the ones that remember it may already be noting themselves.
  const hookEvents = history(run.id).filter(
    (event) => event.name === "hook" && event.text?.includes("(beforeTurn)"),
  );
  expect(hookEvents).toEqual([
    expect.objectContaining({
      kind: "notice",
      ok: true,
      text: expect.stringMatching(
        /^memory\/recall \(beforeTurn\) added ~\d+ tokens of context\n\n/,
      ),
    }),
  ]);
  expect(hookEvents[0].text).toContain(`The owner prefers tabs. (session ${card.id})`);

  await runner.hooksSettled();
  const calls = await memoryCalls();
  expect(calls.map((call) => call.name)).toEqual(["recall", "remember", "remember"]);
  expect(calls[1].args).toEqual({ session: card.id, reply: "done it", project: projectId });
  expect(calls[2].args).toEqual({ status: "ok" });

  // The run keeps what it was opened with, exactly as sent — hook context inside the user message,
  // the system prompt untouched — and a watcher is shown the same thing live.
  const [opened] = await db
    .select({ prompt: tables.runs.prompt })
    .from(tables.runs)
    .where(eq(tables.runs.id, run.id));
  expect(opened.prompt).toEqual({ system: sent[0].messages[0].content, user });
  const { PROMPT_EVENT, readRunPrompt } = await import("../shared/run-prompt.ts");
  const promptEvents = history(run.id).filter((event) => event.name === PROMPT_EVENT);
  expect(promptEvents).toHaveLength(1);
  expect(readRunPrompt(promptEvents[0].text)).toEqual(opened.prompt);

  // A hook that files something and adds nothing is still on the row, so a person can tell a
  // memory server that remembered from one that was never asked.
  const [stored] = await db.select().from(tables.runs).where(eq(tables.runs.id, run.id));
  expect(stored.hooks).toEqual([
    expect.objectContaining({ event: "beforeTurn", hookId: "recall" }),
    expect.objectContaining({ event: "afterTurn", hookId: "remember" }),
    expect.objectContaining({ event: "sessionEnd", hookId: "ended" }),
  ]);
  const { hookSummary } = await import("../shared/hooks.ts");
  expect(hookSummary(stored.hooks[1])).toMatch(/^memory\/remember \(afterTurn\) ran/);

  const deleted = await gql(
    `mutation Delete($id: String!) { deleteCard(where: { id: { eq: $id } }) { id } }`,
    { id: card.id },
  );
  expect(deleted.errors).toBeUndefined();
  const forgotten = await eventually(memoryCalls, (list) =>
    list.some((call) => call.name === "forget"),
  );
  expect(forgotten.at(-1)).toEqual({ name: "forget", args: { session: card.id } });
});
