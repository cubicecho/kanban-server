import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { sseFrom } from "./fixtures/sse.ts";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kanban-server-context-"));
process.env.KANBAN_SERVER_DATA_DIR = dir;

const { runAgent } = await import("../server/runner/agent.ts");
const { contextLimitFor } = await import("../server/runner/llm.ts");
type Resolved = import("../server/runner/llm.ts").Resolved;

/**
 * A model listing, in the shape a server that reports its window uses. `no-window` is the
 * OpenAI listing exactly as specified — which says nothing about context at all, and is what
 * every hosted endpoint answers with.
 */
const LISTING = {
  object: "list",
  data: [
    { id: "roomy", object: "model", context_length: 262144 },
    { id: "cramped", object: "model", n_ctx: 16384 },
    { id: "no-window", object: "model" },
  ],
};

/** How the endpoint answers the next chat request. */
let refuse = "";
let chatRequests = 0;
let listings = 0;
let server: http.Server;
let baseUrl = "";

beforeAll(async () => {
  server = http.createServer((request, response) => {
    request.resume();
    request.on("end", () => {
      if (request.url?.endsWith("/models")) {
        listings++;
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify(LISTING));
        return;
      }
      chatRequests++;
      if (refuse) {
        response.writeHead(400, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: { message: refuse } }));
        return;
      }
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.end(
        sseFrom({ id: "x", model: "fake", choices: [{ message: { content: "done" } }] }, false),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/v1`;
});

beforeEach(() => {
  refuse = "";
  chatRequests = 0;
  listings = 0;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dir, { recursive: true, force: true });
});

const config = (over: Partial<Resolved> = {}): Resolved => ({
  agentId: "agent-1",
  name: "tester",
  baseUrl,
  apiKey: "",
  model: "roomy",
  systemPrompt: "",
  maxTokens: 256,
  contextLength: 0,
  temperature: 0,
  maxToolIterations: 3,
  toolDiscovery: "eager",
  toolSelectModel: "",
  requestTimeoutSeconds: 0,
  maxRetries: 0,
  serverIds: [],
  ...over,
});

test("reads the window off the listing, whichever key the server spells it with", async () => {
  expect(await contextLimitFor(config({ model: "roomy" }))).toBe(262144);
  expect(await contextLimitFor(config({ model: "cramped" }))).toBe(16384);
});

test("a model the listing says nothing about has no window", async () => {
  expect(await contextLimitFor(config({ model: "no-window" }))).toBe(0);
  expect(await contextLimitFor(config({ model: "absent" }))).toBe(0);
});

test("the agent's own figure wins over the listing", async () => {
  // The case this field exists for: a model built for 262k, served in a fraction of it, and
  // listed as 262k regardless. Believing the endpoint here is how the run fails.
  expect(await contextLimitFor(config({ model: "roomy", contextLength: 16384 }))).toBe(16384);
});

test("an endpoint that will not list models leaves the window unknown rather than failing", async () => {
  expect(await contextLimitFor(config({ baseUrl: "http://127.0.0.1:1/v1" }))).toBe(0);
});

test("a prompt that cannot fit is refused before it is sent", async () => {
  const prompt = "x".repeat(200_000);
  await expect(runAgent({ config: config({ model: "cramped" }), prompt })).rejects.toThrow(
    /50.0k tokens and the model reads 16.4k/,
  );
  expect(chatRequests).toBe(0);
});

test("a prompt that fits is sent, and never asks what it was measured against", async () => {
  // The guard has to be free on the runs that did not need it: a card whose whole request is a
  // few thousand tokens fits anything anyone serves, and confirming that on every run of every
  // card would spend a round trip per run to learn nothing.
  await expect(
    runAgent({ config: config({ model: "cramped" }), prompt: "hello" }),
  ).resolves.toMatchObject({ output: "done" });
  expect(chatRequests).toBe(1);
  expect(listings).toBe(0);
});

test("the endpoint's own refusal keeps its words and gains the window we were working to", async () => {
  refuse = "the request exceeds the available context size. try increasing the context size";
  await expect(
    runAgent({ config: config({ model: "roomy", contextLength: 16384 }), prompt: "hello" }),
  ).rejects.toThrow(/available context size.*working to 16.4k tokens/s);
});

test("an overflow is not retried — the same request would be refused again", async () => {
  refuse = "This model's maximum context length is 16384 tokens. Please reduce the length";
  await expect(runAgent({ config: config({ maxRetries: 3 }), prompt: "hello" })).rejects.toThrow(
    /maximum context length/,
  );
  expect(chatRequests).toBe(1);
});
