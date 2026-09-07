import { McpPool } from "@cubicecho/agent-mcp-pool";
import { db } from "../db/client.ts";
import { mcpServers } from "../db/schema.ts";

export type {
  McpConnection,
  McpProbe,
  McpServerState,
  McpStatus,
} from "@cubicecho/agent-mcp-pool";
export { probe } from "@cubicecho/agent-mcp-pool";

/**
 * This server's one pool of MCP connections.
 *
 * The pool itself is `@cubicecho/agent-mcp-pool`; what is left here is the seam it asks for — where
 * the rows come from, and what to call ourselves when we dial. It used to `import { db }`
 * itself, which is exactly why it could not be shared: the connection management is the same
 * everywhere and the table it reads is not.
 *
 * A module-level instance because there is one set of servers on this process and everything
 * from the agent loop to `mcpStatus` reaches for the same one.
 */
export const mcp = new McpPool({
  load: () => db.select().from(mcpServers),
  clientName: "kanban-server",
});
