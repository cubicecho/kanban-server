import fs from "node:fs";
import path from "node:path";
import express from "express";
import { createYoga } from "graphql-yoga";
import { authRequired, mountAuth, requireAuth } from "./auth.ts";
import { ensureSchema } from "./db/migrate.ts";
import { schema } from "./graphql/schema.ts";
import { mcpHandler, mountMcp } from "./mcp-endpoint.ts";
import { PORT, ROOT } from "./paths.ts";
import { mcp } from "./runner/mcp.ts";
import * as cleanup from "./scheduler/cleanup.ts";
import * as worker from "./worker/loop.ts";

await ensureSchema();

// The GraphQL schema comes from the tables, so a column added upstairs changes the API here.
// In dev that is regenerated into `schema.graphql` and `src/gql/graphql.ts` on boot; the
// production image has neither codegen nor sources to write. See `dev/codegen.ts`.
if (process.env.NODE_ENV !== "production") {
  await import("./dev/codegen.ts")
    .then((dev) => dev.runCodegen())
    .catch((error: unknown) => console.warn("[kanban-server] codegen skipped:", error));
}

const app = express();

// The login routes come before the lock, since asking whether a token is wanted cannot itself
// need one. Everything else the browser loads is the static SPA, which is a login form until
// the API answers.
mountAuth(app);

const yoga = createYoga({ schema, graphqlEndpoint: "/graphql" });
app.use(yoga.graphqlEndpoint, requireAuth, yoga);

// The same schema, offered to other clients as MCP tools, beside GraphQL rather than
// replacing it. What it exposes and why is in `mcp-endpoint.ts`.
mountMcp(app);

// In production the built client is served from the same origin.
const dist = path.join(ROOT, "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/(graphql|mcp)$).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.use(
  (error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(error);
    res.status(500).json({ error: error.message });
  },
);

const server = app.listen(PORT, () => {
  console.log(`[kanban-server] http://localhost:${PORT}/graphql`);
  console.log(`[kanban-server] mcp: http://localhost:${PORT}/mcp`);
  if (authRequired()) console.log("[kanban-server] auth: bearer token required");
});

await mcp.sync();
// Boards on `autoRun` start moving as soon as the server is up; the rest wait to be asked.
worker.start();
cleanup.start();

const shutdown = async () => {
  worker.stop();
  cleanup.stop();
  await mcpHandler.close();
  await mcp.shutdown();
  server.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
