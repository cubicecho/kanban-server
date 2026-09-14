import { McpPool } from "@cubicecho/agent-mcp-pool";
import pkg from "../../package.json" with { type: "json" };
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
 *
 * `clientInfo` is the whole of what a dialled server learns about who called it, and both
 * halves of it are ours to say: the same name and the same version `/mcp` introduces itself
 * with, so a server this board reaches and a client reaching this board read alike.
 *
 * `load` is ordered because the pool keeps its servers in the order it is handed them, and that
 * order is the order of every agent's tool array and of the catalogue in an on-demand system
 * prompt. A table read with no `ORDER BY` has none: an update writes a new tuple, so editing one
 * server's timeout moved its tools to the end of every request and threw away the prompt cache of
 * every lane on the server. The slug is unique and already in every tool's name.
 */
export const mcp = new McpPool({
  load: () => db.select().from(mcpServers).orderBy(mcpServers.slug),
  clientName: "kanban-server",
  clientVersion: pkg.version,
});
