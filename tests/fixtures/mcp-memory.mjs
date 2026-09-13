import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

/**
 * A stdio MCP server shaped like a memory server, for the hook tests: `recall` is what a hook
 * injects, `remember` and `forget` are what hooks call after the fact, and `calls` reports every
 * call this child has had — a hook that fires unawaited leaves nothing else a test could read.
 */
const open = { type: "object", additionalProperties: true };
const tools = [
  { name: "recall", description: "what is remembered about a session", inputSchema: open },
  { name: "remember", description: "files something under a session", inputSchema: open },
  { name: "forget", description: "drops a session", inputSchema: open },
  { name: "calls", description: "every call so far, as JSON", inputSchema: open },
];

const calls = [];
const server = new Server({ name: "memory", version: "0.0.1" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, () => ({ tools }));
server.setRequestHandler(CallToolRequestSchema, (request) => {
  const { name, arguments: args = {} } = request.params;
  if (name !== "calls") calls.push({ name, args });
  const text =
    name === "calls"
      ? JSON.stringify(calls)
      : name === "recall"
        ? `The owner prefers tabs. (session ${args.session})`
        : "ok";
  return { content: [{ type: "text", text }] };
});

await server.connect(new StdioServerTransport());
