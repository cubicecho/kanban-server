import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

/**
 * Each page is its own chunk, fetched when it is first needed.
 *
 * Statically imported, every route was in the one bundle the browser waits for before it can
 * draw anything. `defaultPreload: "intent"` below starts the fetch on hover, so a chunk is
 * usually already there by the time the click lands and the split costs no perceived delay.
 *
 * `AppShell` is not lazy: it is the frame every route renders inside. Nor is the index route
 * lazy in effect — it is the first thing anyone sees.
 *
 * No project id in any path: the selected board is app state rather than a location, so that
 * switching projects does not renavigate and every page does not need an id it would only pass
 * along. See `lib/project.ts`.
 */
const rootRoute = createRootRoute({ component: AppShell });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: lazyRouteComponent(() => import("@/routes/home"), "HomeRoute"),
});

const boardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/board",
  component: lazyRouteComponent(() => import("@/routes/board"), "BoardRoute"),
});

const tasksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tasks",
  component: lazyRouteComponent(() => import("@/routes/tasks"), "TasksRoute"),
});

const agentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/agents",
  component: lazyRouteComponent(() => import("@/routes/agents"), "AgentsRoute"),
});

const runsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/runs",
  component: lazyRouteComponent(() => import("@/routes/runs"), "RunsRoute"),
});

const mcpRoute = createRoute({
  getParentRoute: () => rootRoute,
  // Not `/mcp`: that path is the MCP endpoint the server answers on, and in dev the vite
  // proxy would hand this page to it.
  path: "/servers",
  component: lazyRouteComponent(() => import("@/routes/mcp"), "McpRoute"),
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: lazyRouteComponent(() => import("@/routes/settings"), "SettingsRoute"),
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([
    indexRoute,
    boardRoute,
    tasksRoute,
    agentsRoute,
    runsRoute,
    mcpRoute,
    settingsRoute,
  ]),
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
