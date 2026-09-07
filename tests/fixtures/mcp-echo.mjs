import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

/** A stdio MCP server with four trivial tools, for the runner tests to connect to. */
const tools = [
  { name: "ping", description: "replies pong", inputSchema: { type: "object", properties: {} } },
  {
    name: "echo",
    description: "echoes the text back",
    // A union type, so the tests see a real schema go through the sanitizer.
    inputSchema: { type: "object", properties: { text: { type: ["string", "null"] } } },
  },
  {
    name: "add",
    description: "adds two numbers",
    inputSchema: {
      type: "object",
      properties: { a: { type: "number" }, b: { type: "number" } },
      required: ["a", "b"],
    },
  },
  {
    // `clientInfo` is the whole of what a dialled server learns about its caller, and the only
    // side that can report it is this one. It is a tool rather than a log line so a test can
    // read it back through the pool that sent it.
    name: "whoami",
    description: "reports the clientInfo it was handed in the handshake",
    inputSchema: { type: "object", properties: {} },
  },
];

const server = new Server({ name: "echo", version: "0.0.1" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, () => ({ tools }));
server.setRequestHandler(CallToolRequestSchema, (request) => ({
  content: [
    {
      type: "text",
      text:
        request.params.name === "whoami"
          ? JSON.stringify(server.getClientVersion() ?? null)
          : `${request.params.name}(${JSON.stringify(request.params.arguments ?? {})})`,
    },
  ],
}));

await server.connect(new StdioServerTransport());
