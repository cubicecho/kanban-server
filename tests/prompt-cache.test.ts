import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { replyWith } from "./fixtures/sse.ts";
import { stop } from "./fixtures/teardown.ts";

// Everything under server/ builds against the live tables, so the database needs a home first.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kanban-server-prompt-cache-"));
process.env.KANBAN_SERVER_DATA_DIR = dir;

interface ChatRequest {
  messages: { role: string; content: string | null }[];
  tools?: { function: { name: string } }[];
  stream?: boolean;
  stream_options?: { include_usage?: boolean };
}

interface Step {
  content?: string;
  calls?: { name: string; args: Record<string, unknown> }[];
}

/** What the fake model answers, one step per request; the last one repeats. */
let script: Step[] = [];
let sent: ChatRequest[] = [];
let server: http.Server;
let baseUrl = "";

let db: typeof import("../server/db/client.ts").db;
let tables: typeof import("../server/db/schema.ts");
let mcp: typeof import("../server/runner/mcp.ts").mcp;
let runner: typeof import("../server/runner/run.ts");

const ECHO = "echo-1";
const FILES = "files-1";
const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

beforeAll(async () => {
  server = http.createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      const parsed = JSON.parse(body) as ChatRequest;
      sent.push(parsed);
      const step = script[Math.min(sent.length - 1, script.length - 1)];
      replyWith(
        response,
        {
          id: "chatcmpl-test",
          model: "fake",
          choices: [
            {
              message: {
                content: step.content ?? null,
                tool_calls: step.calls?.map((call, index) => ({
                  id: `call-${sent.length}-${index}`,
                  function: { name: call.name, arguments: JSON.stringify(call.args) },
                })),
              },
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        },
        parsed,
      );
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
  runner = await import("../server/runner/run.ts");

  await db.insert(tables.mcpServers).values([
    {
      id: ECHO,
      slug: "echo",
      label: "Echo",
      transport: "stdio",
      command: process.execPath,
      args: [fixture("mcp-echo.mjs")],
    },
    {
      id: FILES,
      slug: "fs",
      label: "Files",
      transport: "stdio",
      command: process.execPath,
      args: [fixture("mcp-files.mjs")],
    },
  ]);
  await mcp.sync();
});

afterAll(async () => {
  await mcp.shutdown();
  await stop(server);
  fs.rmSync(dir, { recursive: true, force: true });
});

/** A board, an agent on both servers, and a lane of cards for that agent to work. */
async function board(name: string, toolDiscovery: "eager" | "ondemand") {
  const [agent] = await db
    .insert(tables.agents)
    .values({ name, baseUrl, model: "fake", toolDiscovery })
    .returning();
  await db.insert(tables.agentServers).values([
    { agentId: agent.id, serverId: ECHO },
    { agentId: agent.id, serverId: FILES },
  ]);
  // Through the API rather than an insert, because the write hook is what seeds the lanes.
  const { graphql } = await import("graphql");
  const { schema } = await import("../server/graphql/schema.ts");
  const created = await graphql({
    schema,
    source: `mutation Create($name: String!) { createProject(values: { name: $name }) { id } }`,
    variableValues: { name },
    contextValue: { caller: "operator" },
  });
  expect(created.errors).toBeUndefined();
  const projectId = (created.data as { createProject: { id: string } }).createProject.id;
  const lanes = await db
    .select()
    .from(tables.lanes)
    .where(eq(tables.lanes.projectId, projectId))
    .orderBy(tables.lanes.position);
  const project = { id: projectId };
  const doing = lanes[2];

  /** Works a fresh card in that lane and hands back every request the run sent. */
  const work = async (title: string, steps: Step[]) => {
    const [card] = await db
      .insert(tables.cards)
      .values({ projectId: project.id, laneId: doing.id, title, body: `do ${title}` })
      .returning();
    sent = [];
    script = steps;
    const run = await runner.runCard(card.id, agent.id);
    expect(run.status).toBe("ok");
    return sent;
  };
  return { work };
}

/**
 * An edit that changes nothing about the connection, so the pool keeps the child and rereads the
 * table. Made to whichever server is listed first, since that is the one an unordered read moves.
 */
async function touch(serverId: string) {
  await db
    .update(tables.mcpServers)
    .set({ callTimeoutMs: 30_000 + Math.floor(Math.random() * 1000) })
    .where(eq(tables.mcpServers.id, serverId));
  await mcp.sync();
}

const namesOf = (request: ChatRequest) => (request.tools ?? []).map((tool) => tool.function.name);
const systemOf = (request: ChatRequest) => request.messages[0].content;

/** A prompt cache keeps a prefix, so the prefix is what has to hold still. */
describe("what a run sends ahead of the card", () => {
  test("two cards in one lane open with the same system prompt and the same tools", async () => {
    const { work } = await board("same lane", "eager");
    const [first] = await work("indent the file", [{ content: "done" }]);
    const [second] = await work("rename the variable", [{ content: "done" }]);

    expect(systemOf(second)).toBe(systemOf(first));
    expect(namesOf(second)).toEqual(namesOf(first));
    expect(namesOf(first)).toEqual(expect.arrayContaining(["echo__ping", "fs__write_file"]));
    // The card is the part that differs, and it is on the user message.
    expect(first.messages[1].content).not.toBe(second.messages[1].content);
  });

  test("a turn only ever adds to the conversation, and the tools do not move under it", async () => {
    const { work } = await board("one run", "eager");
    const requests = await work("ping twice", [
      { calls: [{ name: "echo__ping", args: {} }] },
      { calls: [{ name: "echo__ping", args: {} }] },
      { content: "pinged" },
    ]);

    expect(requests).toHaveLength(3);
    for (let index = 1; index < requests.length; index++) {
      const before = requests[index - 1];
      const after = requests[index];
      expect(namesOf(after)).toEqual(namesOf(before));
      expect(after.messages.slice(0, before.messages.length)).toEqual(before.messages);
    }
  });

  test("editing a server does not reorder the tools every lane is sent", async () => {
    const { work } = await board("edited eager", "eager");
    const [before] = await work("before", [{ content: "done" }]);

    // An update writes a new tuple, and a table read with no order hands it back last.
    await touch(mcp.catalog()[0].id);
    const [after] = await work("after", [{ content: "done" }]);

    expect(namesOf(after)).toEqual(namesOf(before));
  });

  test("nor the catalogue an on-demand lane reads in its system prompt", async () => {
    const { work } = await board("edited ondemand", "ondemand");
    // The first request is the preselector's; the second is the run's first real step.
    const [, before] = await work("before", [{ content: "[]" }, { content: "done" }]);
    await touch(mcp.catalog()[0].id);
    const [, after] = await work("after", [{ content: "[]" }, { content: "done" }]);

    expect(systemOf(before)).toContain("# Tool catalogue");
    expect(systemOf(after)).toBe(systemOf(before));
    expect(namesOf(after)).toEqual(namesOf(before));
  });
});
