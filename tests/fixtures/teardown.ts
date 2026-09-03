import type { Server } from "node:http";

/**
 * Close a server that may never have opened.
 *
 * `afterAll` runs whether or not `beforeAll` finished, and a suite whose setup timed out has a
 * `let server` still holding `undefined` — so the teardown threw `Cannot read properties of
 * undefined`, and vitest reported *that* as the suite's failure. The real one, a hook that ran
 * out of time booting postgres, was a scroll further up. A teardown's job is to leave nothing
 * behind, not to have an opinion about how far setup got.
 */
export function stop(server: Server | undefined): Promise<void> {
  if (!server) return Promise.resolve();
  return new Promise((resolve) => server.close(() => resolve()));
}
