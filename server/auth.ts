import crypto from "node:crypto";
import express from "express";

/**
 * The optional lock on the door.
 *
 * Unset — the default, and what a laptop wants — nothing here does anything: the server
 * behaves exactly as it did before this existed. Set, `/graphql` and `/mcp` both want the
 * token, and everything else about the server is unchanged.
 *
 * It is one shared token rather than accounts, because this is a tool one person points at
 * their own board, and the thing worth protecting is not identity but the operator's API key:
 * anyone who can reach `/mcp` can spend it.
 */
const TOKEN = process.env.KANBAN_SERVER_TOKEN ?? "";

/** Whether anything is locked at all. False means every function here is a no-op. */
export const authRequired = () => TOKEN.length > 0;

/**
 * Compares in constant time, so a wrong guess takes as long as a nearly-right one.
 *
 * Hashed first because `timingSafeEqual` throws on a length mismatch, and throwing on it would
 * leak the length of the token to anyone who can tell an error from a refusal.
 */
export function tokenMatches(candidate: string): boolean {
  if (!TOKEN) return true;
  const digest = (value: string) => crypto.createHash("sha256").update(value).digest();
  return crypto.timingSafeEqual(digest(candidate), digest(TOKEN));
}

/** The cookie the browser gets, so a page reload does not ask for the token again. */
const COOKIE = "kanban_session";

/**
 * The token, from wherever this request carries it.
 *
 * Two ways in, for two kinds of client. An agent sends `Authorization: Bearer` — that is what
 * every MCP client already does. A browser cannot: the run stream is an `EventSource`, and
 * `EventSource` sends no headers of its own. So the web app posts the token once and is given
 * a cookie, which the browser then attaches to the subscription as readily as to a query.
 */
function presented(req: express.Request): string | null {
  const header = req.headers.authorization ?? "";
  if (header.startsWith("Bearer ")) return header.slice("Bearer ".length);
  const cookies = req.headers.cookie ?? "";
  for (const part of cookies.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/** Whether this request may proceed. Always true when no token is configured. */
export const authorized = (req: express.Request): boolean => {
  if (!authRequired()) return true;
  const value = presented(req);
  return value !== null && tokenMatches(value);
};

/**
 * Refuses what is not authorized, and says nothing else.
 *
 * The 401 carries no detail on purpose: whether this server has projects, which endpoints it
 * serves, and whether the token was close are all things an unauthenticated caller learns
 * nothing about here.
 */
export function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  if (authorized(req)) return next();
  res.status(401).set("WWW-Authenticate", "Bearer").type("text/plain").send("Unauthorized");
}

/**
 * The three routes the web app needs: whether to ask, how to hand it over, and how to stop.
 *
 * The cookie holds the token itself rather than a session id, because a session id would be a
 * table of live sessions to keep, expire and lose on restart — for a single shared secret that
 * is already the whole authority. `httpOnly` keeps it away from scripts on the page, and
 * `SameSite=Strict` is what stops another site's page posting a mutation with it attached.
 */
export function mountAuth(app: express.Application) {
  app.get("/api/auth", (req, res) => {
    res.json({ required: authRequired(), ok: authorized(req) });
  });

  app.post("/api/auth", express.json(), (req, res) => {
    const token = typeof req.body?.token === "string" ? req.body.token : "";
    if (!authRequired() || !tokenMatches(token)) {
      res.status(401).type("text/plain").send("Unauthorized");
      return;
    }
    res.cookie(COOKIE, token, {
      httpOnly: true,
      sameSite: "strict",
      secure: req.protocol === "https",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.json({ ok: true });
  });

  app.delete("/api/auth", (_req, res) => {
    res.clearCookie(COOKIE);
    res.json({ ok: true });
  });
}

/**
 * Which kind of caller a request is, which is the whole of the identity this server has.
 *
 * There are no accounts, and adding them for one person's board would be a table to keep for a
 * distinction nobody makes. What there is instead is two doors, and they are used by two
 * different kinds of thing: `/mcp` is where agents call in, and `/graphql` is where the web app
 * does. That is enough to say an agent may run the board but not re-key it.
 *
 * With a token set the split is sharper than the door: the browser trades its token for a
 * cookie, so a `Bearer` header on `/graphql` is an agent that found the query endpoint, and it
 * is held to an agent's rules there as it would be on `/mcp`. With no token — the default —
 * `/graphql` is open and its caller is taken to be the operator, which is what it was before
 * any of this existed. `/mcp` is an agent either way.
 */
export type Caller = "operator" | "agent";

/** What the resolvers are handed. `caller` is the only thing any rule reads. */
export interface GraphContext {
  caller: Caller;
}

/**
 * The caller behind a `/graphql` request, read off its `Authorization` header. `/mcp` does not
 * ask: it is always an agent.
 */
export function callerFor(authorization: string | null | undefined): Caller {
  return authRequired() && (authorization ?? "").startsWith("Bearer ") ? "agent" : "operator";
}
