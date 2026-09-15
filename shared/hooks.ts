import type { HookNote } from "@cubicecho/agent-core";
import type { HookEvent, ToolHook } from "@cubicecho/agent-mcp-pool/hooks";

/**
 * What the web app needs to know about MCP hooks that the pool cannot say: what each event means
 * on this board, and the `vars.*` this server fills in. The events, the variables each offers and
 * the rules a row is held to come from the pool's browser-safe `/hooks` entry.
 */

/**
 * What a run says about one hook, kept on the run row: the context it added, as the model read
 * it, or why it added none. agent-core's, and only a type, so the web can have it too.
 */
export type { HookEvent, HookNote, ToolHook };

/**
 * One hook note in a line: what it added, or why it did not. Shared so the live stream, which
 * only ever carries text, and the stored run say the same thing about the same hook.
 */
export const hookSummary = (note: HookNote) => {
  const name = `${note.source}/${note.hookId} (${note.event})`;
  if (note.error) return `${name} failed: ${note.error}`;
  // Only an injected note carries tokens. Any other that did not fail is a hook that ran, and
  // its text — if any — is what it answered rather than anything the model read.
  if (note.tokens != null) return `${name} added ~${note.tokens} tokens of context`;
  return note.text ? `${name} ran and answered` : `${name} ran`;
};

/**
 * When this server fires each event. A card or a task is the session; each run is one turn of it.
 * `beforeCompact` is accepted so a row copied from min-agent saves, but nothing here compacts — a
 * run starts from nothing every time. Keyed by the pool's `HookEvent`, so an event it adds or
 * renames fails the typecheck here.
 */
export const HOOK_EVENT_TIMING = {
  sessionStart: "before the first run a card or task ever has",
  beforeTurn: "before every run",
  afterTurn: "after a run that finished",
  beforeCompact: "never — runs here are not compacted",
  sessionEnd: "after every run, however it ended",
  sessionDelete: "when a card or task is deleted",
} as const satisfies Record<HookEvent, string>;

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
