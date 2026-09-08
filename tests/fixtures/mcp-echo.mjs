import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

/** A stdio MCP server with five trivial tools, for the runner tests to connect to. */
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
  {
    // Same argument as `whoami`: where a child was started is only visible from inside it, and a
    // test that read the row back would be asking the database what it just wrote.
    name: "pwd",
    description: "reports the working directory it was started in",
    inputSchema: { type: "object", properties: {} },
  },
];

const server = new Server({ name: "echo", version: "0.0.1" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, () => ({ tools }));
server.setRequestHandler(CallToolRequestSchema, (request) => ({
  content: [
    {
      type: "text",
      text: reply(request.params.name, request.params.arguments ?? {}),
    },
  ],
}));

function reply(name, args) {
  if (name === "whoami") return JSON.stringify(server.getClientVersion() ?? null);
  if (name === "pwd") return process.cwd();
  return `${name}(${JSON.stringify(args)})`;
}

await server.connect(new StdioServerTransport());
