import type { HookNote } from "@cubicecho/agent-core";
import type { HookEvent, ToolHook } from "@cubicecho/agent-mcp-pool";

/**
 * What the web app needs to know about MCP hooks, without the pool.
 *
 * The pool is a server package — it brings the MCP SDK and a child-process transport with it — so
 * the hook editor cannot import its constants. These are copies, and the `satisfies` clauses hold
 * them to the pool's types: an event the pool renames fails the typecheck here, and
 * `tests/hooks.test.ts` compares the variable lists against `hookVars` itself.
 */

/**
 * What a run says about one hook, kept on the run row: the context it added, as the model read
 * it, or why it added none. agent-core's, and only a type, so the web can have it too.
 */
export type { HookEvent, HookNote, ToolHook };

/**
 * Every event, and when this server fires it. A card or a task is the session; each run is one
 * turn of it. `beforeCompact` is accepted so a row copied from min-agent saves, but nothing here
 * compacts — a run starts from nothing every time.
 */
export const HOOK_EVENTS = {
  sessionStart: "before the first run a card or task ever has",
  beforeTurn: "before every run",
  afterTurn: "after a run that finished",
  beforeCompact: "never — runs here are not compacted",
  sessionEnd: "after every run, however it ended",
  sessionDelete: "when a card or task is deleted",
} as const satisfies Record<HookEvent, string>;

/** The events whose output can reach the model: the only two that run before the request. */
export const INJECT_EVENTS: readonly HookEvent[] = ["sessionStart", "beforeTurn"];

/** The `{{…}}` paths each event offers, beyond `vars.*`. The pool's `hookVars`, copied. */
export const HOOK_VARS = {
  sessionStart: ["prompt"],
  beforeTurn: ["prompt", "turn.index"],
  afterTurn: ["prompt", "reply", "turn.index", "turn.messages"],
  beforeCompact: ["compacting", "range.from", "range.through"],
  sessionEnd: ["status", "reply"],
  sessionDelete: [],
} as const satisfies Record<HookEvent, readonly string[]>;

/** On every event. */
export const COMMON_HOOK_VARS = ["session.id", "host", "now"] as const;

/**
 * The `vars.*` this server fills in, so a hook can file a memory under a project rather than
 * under one card. `sessionDelete` carries only `vars.kind`: the row is already gone by then.
 */
export const KANBAN_HOOK_VARS = [
  "vars.kind",
  "vars.projectId",
  "vars.cardId",
  "vars.taskId",
  "vars.laneId",
  "vars.agent",
] as const;
