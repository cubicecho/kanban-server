import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import type { Resolved } from "../server/runner/llm.ts";
import { sseFrom } from "./fixtures/sse.ts";
import { stop } from "./fixtures/teardown.ts";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kanban-server-resilience-"));
process.env.KANBAN_SERVER_DATA_DIR = dir;

/** What the fake model server does with the next request, in order. */
type Reply =
  | { kind: "ok"; content: string }
  | { kind: "status"; code: number }
  /** Headers, some tokens, then nothing at all — the endpoint that stops mid-answer. */
  | { kind: "stall"; after: string }
  /** Accepted, then silent. Nothing is ever produced, so it is safe to retry. */
  | { kind: "silent" }
  /** A 400 naming a field of the body, which is how a model refuses one. */
  | { kind: "refuse"; message: string };

let replies: Reply[] = [];
let requests = 0;
/** Every body the fake endpoint was sent, so a downgrade can be read off the next one. */
let sent: Record<string, unknown>[] = [];
let server: http.Server;
let baseUrl = "";
const open: http.ServerResponse[] = [];

const completion = (content: string) => ({
  id: "chatcmpl-test",
  model: "fake",
  choices: [{ message: { content } }],
  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
});

beforeAll(async () => {
  server = http.createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      requests++;
      if (body) sent.push(JSON.parse(body) as Record<string, unknown>);
      const reply = replies.shift() ?? { kind: "ok", content: "done" };
      if (reply.kind === "refuse") {
        response.writeHead(400, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: { message: reply.message } }));
        return;
      }
      if (reply.kind === "status") {
        response.writeHead(reply.code, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: { message: `fake ${reply.code}` } }));
        return;
      }
      response.writeHead(200, { "content-type": "text/event-stream" });
      if (reply.kind === "ok") {
        response.end(sseFrom(completion(reply.content), false));
        return;
      }
      // Held open and never ended: the socket is closed in afterEach.
      open.push(response);
      if (reply.kind === "stall") {
        response.write(
          `data: ${JSON.stringify({
            id: "x",
            object: "chat.completion.chunk",
            created: 0,
            model: "fake",
            choices: [{ index: 0, delta: { content: reply.after }, finish_reason: null }],
          })}\n\n`,
        );
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/v1`;
});

beforeEach(() => {
  replies = [];
  requests = 0;
  sent = [];
  while (open.length) open.pop()?.destroy();
});

afterAll(async () => {
  while (open.length) open.pop()?.destroy();
  await stop(server);
  fs.rmSync(dir, { recursive: true, force: true });
});

const config = (over: Partial<Resolved> = {}): Resolved => ({
  agentId: "agent-1",
  name: "tester",
  baseUrl,
  apiKey: "",
  model: "fake",
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

const run = async (over: Partial<Resolved> = {}) => {
  const { runAgent } = await import("../server/runner/agent.ts");
  return runAgent({ config: config(over), systemPrompt: "", prompt: "go" });
};

test("a busy endpoint is waited out and the run still finishes", async () => {
  replies = [
    { kind: "status", code: 503 },
    { kind: "status", code: 429 },
    { kind: "ok", content: "recovered" },
  ];

  const result = await run({ maxRetries: 2 });
  expect(result.output).toBe("recovered");
  expect(requests).toBe(3);
});

test("retries are bounded, and the last failure is what the run reports", async () => {
  replies = [
    { kind: "status", code: 500 },
    { kind: "status", code: 500 },
    { kind: "status", code: 500 },
    { kind: "status", code: 500 },
  ];

  await expect(run({ maxRetries: 1 })).rejects.toThrow(/500/);
  // The first attempt plus one retry, and no more.
  expect(requests).toBe(2);
});

test("a complaint about the request itself is not retried", async () => {
  replies = [
    { kind: "status", code: 400 },
    { kind: "ok", content: "never reached" },
  ];

  await expect(run({ maxRetries: 3 })).rejects.toThrow();
  expect(requests).toBe(1);
});

test("an endpoint that accepts and then says nothing times out, and is retried", async () => {
  replies = [{ kind: "silent" }, { kind: "ok", content: "second time" }];

  const result = await run({ requestTimeoutSeconds: 1, maxRetries: 1 });
  expect(result.output).toBe("second time");
  expect(requests).toBe(2);
});

test("an endpoint that stalls mid-answer gives up rather than repeating itself", async () => {
  replies = [
    { kind: "stall", after: "half a th" },
    { kind: "ok", content: "unreachable" },
  ];

  // Tokens are already out and on their way to whoever is watching. Replaying the turn would
  // say them twice, so the timeout is fatal here where it was retryable above.
  await expect(run({ requestTimeoutSeconds: 1, maxRetries: 3 })).rejects.toThrow(/sent nothing/);
  expect(requests).toBe(1);
});

// Model-level negotiation. The endpoint's own refusals latch against the base URL; these latch
// against one model on it, so each test names its own rather than resetting a module's memory —
// which is the distinction being tested. See `modelCapabilitiesFor` in `@cubicecho/agent-core`.

test("a model that spells its ceiling the other way is answered, not failed", async () => {
  replies = [
    {
      kind: "refuse",
      message:
        "Unsupported parameter: 'max_tokens' is not supported with this model. " +
        "Use 'max_completion_tokens' instead.",
    },
    { kind: "ok", content: "second time" },
  ];

  const result = await run({ model: "ceiling-model" });

  expect(result.output).toBe("second time");
  expect(requests).toBe(2);
  expect(sent[0]).toMatchObject({ max_tokens: 256 });
  expect(sent[0]).not.toHaveProperty("max_completion_tokens");
  expect(sent[1]).toMatchObject({ max_completion_tokens: 256 });
  expect(sent[1]).not.toHaveProperty("max_tokens");
});

test("a model that will not take our temperature is sent none", async () => {
  replies = [
    {
      kind: "refuse",
      message:
        "'temperature' does not support 0.7 with this model. Only the default (1) is supported.",
    },
    { kind: "ok", content: "second time" },
  ];

  const result = await run({ model: "temperature-model", temperature: 0.7 });

  expect(result.output).toBe("second time");
  expect(sent[0]).toMatchObject({ temperature: 0.7 });
  // Dropped rather than set to 1: the agent's own figure is what the settings page shows, and
  // sending a different one back as though it were the operator's would make that a lie.
  expect(sent[1]).not.toHaveProperty("temperature");
});

test("both refusals from one model are answered, and neither costs a retry", async () => {
  replies = [
    {
      kind: "refuse",
      message: "Unsupported parameter: 'max_tokens'. Use 'max_completion_tokens' instead.",
    },
    {
      kind: "refuse",
      message:
        "'temperature' does not support 0.7 with this model. Only the default (1) is supported.",
    },
    { kind: "ok", content: "third time" },
  ];

  // maxRetries is zero: a downgrade is a different request rather than the same one again, so
  // neither of these may spend an attempt.
  const result = await run({ model: "reasoning-model", temperature: 0.7, maxRetries: 0 });

  expect(result.output).toBe("third time");
  expect(requests).toBe(3);
  expect(sent[2]).toMatchObject({ max_completion_tokens: 256 });
  expect(sent[2]).not.toHaveProperty("temperature");
});

test("what one model refused is not held against the next", async () => {
  replies = [
    {
      kind: "refuse",
      message: "Unsupported parameter: 'max_tokens'. Use 'max_completion_tokens' instead.",
    },
    { kind: "ok", content: "downgraded" },
    { kind: "ok", content: "untouched" },
  ];

  await run({ model: "picky-model" });
  await run({ model: "easygoing-model" });

  // One API key reaches every model a provider offers. A flag on the endpoint would have the
  // first of these stop the second ever being sent a `max_tokens` it takes perfectly well.
  expect(sent[1]).toMatchObject({ max_completion_tokens: 256 });
  expect(sent[2]).toMatchObject({ max_tokens: 256 });
});
