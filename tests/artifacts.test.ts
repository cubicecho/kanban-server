import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { type GraphQLSchema, graphql } from "graphql";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  declaredArtifact,
  detectArtifact,
  mediaTypeFor,
  splitToolName,
} from "../server/runner/artifacts.ts";
import { replyWith } from "./fixtures/sse.ts";
import { stop } from "./fixtures/teardown.ts";

// Everything under server/ builds against the live tables, so the database needs a home first.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kanban-server-artifacts-"));
process.env.KANBAN_SERVER_DATA_DIR = dir;

interface ChatRequest {
  messages: { role: string; content: string }[];
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
let schema: GraphQLSchema;

const SERVER_ID = "files-1";

const asOperator = (source: string, variableValues?: Record<string, unknown>) =>
  graphql({ schema, source, variableValues, contextValue: { caller: "operator" } });
const asAgent = (source: string, variableValues?: Record<string, unknown>) =>
  graphql({ schema, source, variableValues, contextValue: { caller: "agent" } });

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
  schema = (await import("../server/graphql/schema.ts")).schema;

  await db.insert(tables.mcpServers).values({
    id: SERVER_ID,
    slug: "fs",
    label: "NAS docs",
    transport: "stdio",
    command: process.execPath,
    args: [fileURLToPath(new URL("./fixtures/mcp-files.mjs", import.meta.url))],
  });
  await mcp.sync();
});

afterAll(async () => {
  await mcp.shutdown();
  await stop(server);
  fs.rmSync(dir, { recursive: true, force: true });
});

async function newCard(name: string) {
  const created = await asOperator(
    `mutation Create($name: String!) { createProject(values: { name: $name }) { id } }`,
    { name },
  );
  expect(created.errors).toBeUndefined();
  const projectId = (created.data as { createProject: { id: string } }).createProject.id;
  const board = await db
    .select()
    .from(tables.lanes)
    .where(eq(tables.lanes.projectId, projectId))
    .orderBy(tables.lanes.position);
  const [card] = await db
    .insert(tables.cards)
    .values({ projectId, laneId: board[2].id, title: "write the notes" })
    .returning();
  return { projectId, card };
}

const artifactsOf = (cardId: string) =>
  db.select().from(tables.artifacts).where(eq(tables.artifacts.cardId, cardId));

describe("recognising a write", () => {
  test("a filesystem write is an artifact, and where it went is the location", () => {
    expect(
      detectArtifact("fs__write_file", { path: "docs/notes.md", content: "# héllo" }, true),
    ).toEqual({
      location: "docs/notes.md",
      source: "detected",
      action: "created",
      serverSlug: "fs",
      tool: "write_file",
      mediaType: "text/markdown",
      sizeBytes: 8,
    });
    expect(detectArtifact("fs__edit_file", { path: "a.txt", edits: [] }, true)?.action).toBe(
      "updated",
    );
    const moved = detectArtifact("fs__move_file", { source: "a.md", destination: "b.md" }, true);
    expect(moved).toMatchObject({ location: "b.md", action: "moved", sizeBytes: null });
    expect(detectArtifact("s3__put_object", { key: "reports/q3.pdf" }, true)).toMatchObject({
      location: "reports/q3.pdf",
      mediaType: "application/pdf",
    });
  });

  test("a failed call, a read, a directory and a write with no location are not", () => {
    expect(detectArtifact("fs__write_file", { path: "a.md" }, false)).toBeNull();
    expect(detectArtifact("fs__read_file", { path: "a.md" }, true)).toBeNull();
    expect(detectArtifact("fs__create_directory", { path: "docs" }, true)).toBeNull();
    expect(detectArtifact("fs__write_file", { content: "orphan" }, true)).toBeNull();
    expect(detectArtifact("fs__rewrite_history", { path: "a.md" }, true)).toBeNull();
  });

  test("the pieces it is built from", () => {
    expect(splitToolName("fs__write_file")).toEqual({ serverSlug: "fs", tool: "write_file" });
    expect(splitToolName("write_file")).toEqual({ serverSlug: "", tool: "write_file" });
    expect(mediaTypeFor("smb://nas/share/plan.MD?v=2")).toBe("text/markdown");
    expect(mediaTypeFor(".env")).toBeNull();
    expect(declaredArtifact({ title: "no location" })).toBeNull();
    expect(declaredArtifact({ location: " s3://b/k.json ", server: "s3" })).toMatchObject({
      location: "s3://b/k.json",
      serverSlug: "s3",
      mediaType: "application/json",
    });
  });
});

test("a card run records what it wrote and what it said it made, once each", async () => {
  const [agent] = await db
    .insert(tables.agents)
    .values({ name: "writer", baseUrl, model: "fake", toolDiscovery: "eager" })
    .returning();
  await db.insert(tables.agentServers).values({ agentId: agent.id, serverId: SERVER_ID });
  const { projectId, card } = await newCard("artifacts");

  sent = [];
  script = [
    {
      calls: [
        { name: "fs__create_directory", args: { path: "docs" } },
        { name: "fs__write_file", args: { path: "docs/notes.md", content: "draft" } },
      ],
    },
    {
      calls: [
        { name: "fs__write_file", args: { path: "docs/notes.md", content: "final text" } },
        {
          name: "record_artifact",
          args: { location: "docs/notes.md", title: "Notes", description: "The summary." },
        },
        { name: "record_artifact", args: { location: "https://wiki/page", server: "wiki" } },
      ],
    },
    { content: "wrote docs/notes.md" },
  ];
  const runner = await import("../server/runner/run.ts");
  const run = await runner.runCard(card.id, agent.id);
  expect(run.status).toBe("ok");
  expect(sent[0].tools?.map((tool) => tool.function.name)).toContain("record_artifact");

  const rows = await artifactsOf(card.id);
  expect(rows).toHaveLength(2);
  const notes = rows.find((row) => row.location === "docs/notes.md");
  // Two writes and a declaration are one thing made: the second write moved the size on, the
  // declaration named it, and the server it went through is remembered as it was.
  expect(notes).toMatchObject({
    projectId,
    runId: run.id,
    source: "declared",
    action: "created",
    title: "Notes",
    description: "The summary.",
    serverId: SERVER_ID,
    serverSlug: "fs",
    serverLabel: "NAS docs",
    transport: "stdio",
    tool: "write_file",
    mediaType: "text/markdown",
    sizeBytes: 10,
  });
  // A server this board has never heard of is still recorded as the agent named it.
  expect(rows.find((row) => row.location === "https://wiki/page")).toMatchObject({
    serverSlug: "wiki",
    serverId: null,
    transport: "",
  });

  // Rework is a second pass, and a second pass is a second record.
  sent = [];
  script = [
    { calls: [{ name: "fs__write_file", args: { path: "docs/notes.md", content: "v2" } }] },
    { content: "again" },
  ];
  await db.update(tables.cards).set({ status: "idle" }).where(eq(tables.cards.id, card.id));
  const again = await runner.runCard(card.id, agent.id);
  const after = await artifactsOf(card.id);
  expect(after).toHaveLength(3);
  expect(after.find((row) => row.runId === again.id)).toMatchObject({
    source: "detected",
    title: "",
    sizeBytes: 2,
  });
});

test("an agent with nothing to store with is not offered record_artifact", async () => {
  const [agent] = await db
    .insert(tables.agents)
    .values({ name: "toolless", baseUrl, model: "fake", toolDiscovery: "eager" })
    .returning();
  const { card } = await newCard("bare");
  sent = [];
  script = [{ content: "thought about it" }];
  const runner = await import("../server/runner/run.ts");
  await runner.runCard(card.id, agent.id);
  expect(sent[0].tools ?? []).toEqual([]);
  expect(await artifactsOf(card.id)).toEqual([]);
});

test("an outside client records through the one door, and cannot forge the other kinds", async () => {
  const { card } = await newCard("client");
  const record = `mutation R($cardId: String!, $location: String!, $server: String) {
    recordArtifact(cardId: $cardId, location: $location, title: "Plan", server: $server) {
      id source serverSlug serverLabel transport location
    }
  }`;
  const first = await asAgent(record, {
    cardId: card.id,
    location: "smb://nas/plan.md",
    server: "fs",
  });
  expect(first.errors).toBeUndefined();
  expect((first.data as { recordArtifact: unknown }).recordArtifact).toMatchObject({
    source: "client",
    serverSlug: "fs",
    serverLabel: "NAS docs",
    transport: "stdio",
  });
  // Recording it again is the same record.
  await asAgent(record, { cardId: card.id, location: "smb://nas/plan.md", server: "fs" });
  expect(await artifactsOf(card.id)).toHaveLength(1);

  const empty = await asAgent(record, { cardId: card.id, location: "  " });
  expect(empty.errors?.[0].extensions?.code).toBe("EMPTY_LOCATION");

  // No generated writes: a row saying a runner detected a file is the runner's to write.
  for (const call of [asAgent, asOperator]) {
    const forged = await call(
      `mutation { insertIntoArtifacts(values: [{ projectId: "x", location: "y" }]) { id } }`,
    );
    expect(forged.errors?.[0].message).toMatch(/Cannot query field|insertIntoArtifacts/);
  }

  const read = await asAgent(
    `query Q($cardId: String!) { artifacts(where: { cardId: { eq: $cardId } }) { location card { title } } }`,
    { cardId: card.id },
  );
  expect(read.errors).toBeUndefined();
  expect(read.data).toEqual({
    artifacts: [{ location: "smb://nas/plan.md", card: { title: "write the notes" } }],
  });
});
