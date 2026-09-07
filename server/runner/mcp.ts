import { McpPool } from "@cubicecho/agent-mcp-pool";
import { db } from "../db/client.ts";
import { mcpServers } from "../db/schema.ts";

/**
 * The MCP connections this server holds, shared by every agent on it.
 *
 * The pool itself is `@cubicecho/agent-mcp-pool` — connection management, tool naming and the
 * per-run scope check are the same problem on every server that drives an agent loop, and the
 * copy that used to live here had drifted from the one in `task_server`. What is left is the
 * seam: where the rows come from. `mcp_servers` is a table here, and `load` is how the pool
 * asks for it again after a write.
 */
export const mcp = new McpPool({
  load: () => db.select().from(mcpServers),
  clientName: "kanban-server",
});
