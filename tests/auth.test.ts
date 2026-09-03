import fs from "node:fs";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import express from "express";
import { afterAll, beforeAll, expect, test, vi } from "vitest";

// The MCP endpoint builds against the live tables, so the database needs a home first.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kanban-server-auth-"));
process.env.KANBAN_SERVER_DATA_DIR = dir;
// Read once, at import: the locked server is a server started with this set.
process.env.KANBAN_SERVER_TOKEN = "the-right-token";

interface Running {
  url: string;
  close: () => Promise<void>;
}

const listen = async (app: express.Application): Promise<Running> => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
};

let locked: Running;
let mcpClose: () => Promise<void>;

beforeAll(async () => {
  const { ensureSchema } = await import("../server/db/migrate.ts");
  await ensureSchema();
  const auth = await import("../server/auth.ts");
  const { mountMcp, mcpHandler } = await import("../server/mcp-endpoint.ts");
  mcpClose = () => mcpHandler.close();

  // The same wiring as `server/index.ts`: the login routes in front of the lock, the API behind
  // it. The GraphQL handler is a stand-in — what is under test is what gets to reach it.
  const app = express();
  auth.mountAuth(app);
  app.use("/graphql", auth.requireAuth, (_req, res) => {
    res.json({ data: { projects: [] } });
  });
  mountMcp(app);
  locked = await listen(app);
});

afterAll(async () => {
  await mcpClose?.();
  await locked?.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const listTools = { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} };

test("a locked server refuses what does not carry the token, and says nothing else", async () => {
  const graphql = await fetch(`${locked.url}/graphql`, { method: "POST" });
  expect(graphql.status).toBe(401);
  // Nothing about what is here, what the token looks like, or how close a guess was.
  expect(await graphql.text()).toBe("Unauthorized");

  // The MCP endpoint is the one that can spend the operator's API key, and it is locked too.
  const mcp = await fetch(`${locked.url}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify(listTools),
  });
  expect(mcp.status).toBe(401);
});

test("a bearer token gets in; a wrong one does not, whatever length it is", async () => {
  const ok = await fetch(`${locked.url}/graphql`, {
    method: "POST",
    headers: { authorization: "Bearer the-right-token" },
  });
  expect(ok.status).toBe(200);

  for (const wrong of ["the-wrong-token", "x", "the-right-token-and-then-some", ""]) {
    const refused = await fetch(`${locked.url}/graphql`, {
      method: "POST",
      headers: { authorization: `Bearer ${wrong}` },
    });
    // A length mismatch is a refusal like any other — never a 500 that leaks how long it is.
    expect(refused.status).toBe(401);
  }
});

test("the web app trades the token for a cookie, which is what an EventSource can carry", async () => {
  const refused = await fetch(`${locked.url}/api/auth`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: "not it" }),
  });
  expect(refused.status).toBe(401);
  expect(refused.headers.get("set-cookie")).toBeNull();

  const accepted = await fetch(`${locked.url}/api/auth`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: "the-right-token" }),
  });
  expect(accepted.status).toBe(200);
  const cookie = accepted.headers.get("set-cookie") ?? "";
  // Away from any script on the page, and not attached to another site's requests.
  expect(cookie).toMatch(/HttpOnly/i);
  expect(cookie).toMatch(/SameSite=Strict/i);

  const session = cookie.split(";")[0];
  const withCookie = await fetch(`${locked.url}/graphql`, {
    method: "POST",
    headers: { cookie: session },
  });
  expect(withCookie.status).toBe(200);

  const asked = await fetch(`${locked.url}/api/auth`, { headers: { cookie: session } });
  expect(await asked.json()).toEqual({ required: true, ok: true });
  // Asking is not itself behind the lock, or there would be no way to know to log in.
  expect(await (await fetch(`${locked.url}/api/auth`)).json()).toEqual({
    required: true,
    ok: false,
  });
});

test("a server started without a token is the server as it was before there were any", async () => {
  vi.resetModules();
  delete process.env.KANBAN_SERVER_TOKEN;
  const auth = await import("../server/auth.ts");

  const app = express();
  auth.mountAuth(app);
  app.use("/graphql", auth.requireAuth, (_req, res) => {
    res.json({ data: { projects: [] } });
  });
  const open = await listen(app);
  try {
    expect(auth.authRequired()).toBe(false);
    const anonymous = await fetch(`${open.url}/graphql`, { method: "POST" });
    expect(anonymous.status).toBe(200);
    expect(await (await fetch(`${open.url}/api/auth`)).json()).toEqual({
      required: false,
      ok: true,
    });

    // There is nothing to log into, so the form is never shown and the route says no.
    const login = await fetch(`${open.url}/api/auth`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "anything" }),
    });
    expect(login.status).toBe(401);
  } finally {
    await open.close();
  }
});
