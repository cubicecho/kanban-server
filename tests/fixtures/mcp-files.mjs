import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

/**
 * A stdio MCP server shaped like a filesystem server, for the artifact tests. It writes nothing:
 * what is under test is whether the runner recognises a write from its name and arguments, and a
 * real file on disk would only be asserting that this fixture works.
 */
const path = { type: "object", properties: { path: { type: "string" } }, required: ["path"] };
const tools = [
  {
    name: "write_file",
    description: "writes a file",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" }, content: { type: "string" } },
      required: ["path", "content"],
    },
  },
  { name: "create_directory", description: "makes a directory", inputSchema: path },
  { name: "read_file", description: "reads a file", inputSchema: path },
];

const server = new Server({ name: "files", version: "0.0.1" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, () => ({ tools }));
server.setRequestHandler(CallToolRequestSchema, (request) => ({
  content: [{ type: "text", text: `ok ${request.params.name}` }],
}));

await server.connect(new StdioServerTransport());
