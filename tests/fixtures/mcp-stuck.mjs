import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

/**
 * A stdio MCP server that connects, lists its one tool, and then never answers a call to it.
 *
 * The `mcp-silent.mjs` of tool calls: it stands in for the case `callTimeoutMs` is for, a tool
 * wedged on something, so the only thing that ends the call is the bound the pool was given.
 */
const server = new Server({ name: "stuck", version: "0.0.1" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: [
    { name: "wait", description: "never returns", inputSchema: { type: "object", properties: {} } },
  ],
}));
server.setRequestHandler(CallToolRequestSchema, () => new Promise(() => {}));

await server.connect(new StdioServerTransport());
