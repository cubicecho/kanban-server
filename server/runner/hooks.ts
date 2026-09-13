import {
  type Gathered,
  gather as gatherHooks,
  type HookContext,
  type HookEvent,
  type HookNote,
  type HookOutcome,
  type HookRunner,
  INJECT_EVENTS,
  notify as notifyHooks,
  type RunEventInput,
} from "@cubicecho/agent-core";
import { validateHooks } from "@cubicecho/agent-mcp-pool";
import { hookSummary } from "../../shared/hooks.ts";
import { mcp } from "./mcp.ts";

/**
 * The MCP servers' hooks, fired at this board's points in a run.
 *
 * The pool runs them, and agent-core assembles what they add and says what each did; neither lets
 * one fail a run. This is the half that knows what a session is here: a card, or a task. Each run
 * against one is a turn of it, so a memory server files a card's Doing run and its Review run
 * under the same id, and forgets both when the card is deleted.
 *
 * - `sessionStart` fires before the first run a subject has — counted from the runs table, so a
 *   card whose runs `runRetentionDays` has pruned starts again, which is the honest reading of a
 *   history nobody kept.
 * - `beforeTurn` fires before every run, and is where context comes from.
 * - `afterTurn` fires after a run that finished, with what was asked and what came back.
 * - `sessionEnd` fires after every run, whatever became of it. A card has no end the board knows
 *   about — a done card can be dragged back — so a run is the thing here that ends.
 * - `sessionDelete` fires when a card or a task is deleted, the project delete that takes them
 *   included.
 * - `beforeCompact` never fires: a run starts from nothing, and nothing is ever compacted.
 *
 * `run.ts` calls the first four and `graphql/schema.ts` calls the last.
 */

export type { Gathered };

/** Every hook's `{{host}}`, so a server shared with min-agent can tell the two apart. */
export const HOST = "kanban-server";

/**
 * Said once, above the blocks, so the model reads them as background and not as its job.
 * agent-core's own speaks of "the user's message", and nobody on a board sent one.
 */
export const PREFACE =
  "The <context> blocks below were added by this board's MCP servers for this run. They are " +
  "background nobody on the board wrote and may not be relevant. What you are asked to do " +
  "follows them.";

/**
 * A note as a run event: a `notice` named `hook`, its summary on the first line and the context
 * the model was given after a blank line. The context is the point — a watcher told only that a
 * hook added 300 tokens cannot see what the model was reading while the run is still going.
 */
export const hookEvent = (note: HookNote): RunEventInput => ({
  kind: "notice",
  name: "hook",
  ok: !note.error,
  text: note.text ? `${hookSummary(note)}\n\n${note.text}` : hookSummary(note),
});

/** Where a set of hooks is told to report, and whose servers they run on. */
export interface HookOptions {
  /** The agent's servers. Absent is every server, empty is none — the pool's own reading. */
  scope?: readonly string[];
  signal?: AbortSignal;
  onEvent?: (event: RunEventInput) => void;
}

/** The pool's `runHooks`, held to one agent's servers. */
const runner =
  (scope: readonly string[] | undefined): HookRunner =>
  (event, context, { signal }) =>
    mcp.runHooks(event, context, {
      servers: scope,
      signal,
      // The pool prints nothing itself; the notes are what reach a watcher.
      onNotice: (text) => console.warn(`[hooks] ${text}`),
    });

const toEvents = (onEvent: HookOptions["onEvent"]) =>
  onEvent ? (note: HookNote) => onEvent(hookEvent(note)) : undefined;

/** The most of a non-injecting hook's answer kept on its note: enough to read, not a transcript. */
const ANSWER_CHARS = 2000;

/**
 * The runner, keeping every outcome it hands back so the ones agent-core does not note can be.
 *
 * agent-core notes a failure and a hook that added context, and nothing else — "a remember that
 * succeeded is not news". Here it is: a memory server that files nothing and says nothing looks
 * exactly like one that is not configured, and the only way to tell is to see that it ran.
 */
const recording = (scope: readonly string[] | undefined) => {
  const outcomes: HookOutcome[] = [];
  const run: HookRunner = async (event, context, options) => {
    const answered = await runner(scope)(event, context, options);
    outcomes.push(...answered);
    return answered;
  };
  /** A note for each hook that worked but is not among `noted`. */
  const unnoted = (noted: readonly HookNote[]): HookNote[] => {
    const seen = new Set(noted.map((note) => `${note.event}\0${note.source}\0${note.hookId}`));
    return outcomes
      .filter(
        (outcome) =>
          outcome.ok && !seen.has(`${outcome.event}\0${outcome.label}\0${outcome.hookId}`),
      )
      .map((outcome) => {
        // What an injecting hook returned and did not inject never reached the model, and a note
        // carrying it would read as context; a later hook's answer is the receipt worth seeing.
        const answer = INJECT_EVENTS.has(outcome.event) ? "" : (outcome.text?.trim() ?? "");
        return {
          event: outcome.event,
          source: outcome.label,
          hookId: outcome.hookId,
          ...(answer ? { text: answer.slice(0, ANSWER_CHARS) } : {}),
        };
      });
  };
  return { run, unnoted };
};

/**
 * Runs the injecting events' hooks ahead of a run and builds what they add to its prompt.
 *
 * On the path of the run, so the bounds matter: each hook gets 3s unless its row says otherwise,
 * `signal` ends all of them, and agent-core caps the blocks in total so a generous server cannot
 * crowd out the card.
 */
export async function gather(
  events: readonly HookEvent[],
  context: HookContext,
  { scope, signal, onEvent }: HookOptions,
): Promise<Gathered> {
  const { run, unnoted } = recording(scope);
  const onNote = toEvents(onEvent);
  const gathered = await gatherHooks(run, events, context, { signal, onNote });
  const ran = unnoted(gathered.notes);
  for (const note of ran) onNote?.(note);
  return { ...gathered, notes: [...gathered.notes, ...ran] };
}

/**
 * Runs the hooks for an event that reads what happened and adds nothing to a request: a note for
 * every hook, what it answered or why it failed. It never rejects.
 *
 * No signal: a run that has finished is not asking for the finish not to be remembered.
 */
export async function notify(
  event: HookEvent,
  context: HookContext,
  { scope, onEvent }: Omit<HookOptions, "signal"> = {},
): Promise<HookNote[]> {
  const { run, unnoted } = recording(scope);
  const onNote = toEvents(onEvent);
  const failed = await notifyHooks(run, event, context, onNote);
  const ran = unnoted(failed);
  for (const note of ran) onNote?.(note);
  return [...failed, ...ran];
}

/**
 * Cards or tasks were deleted. Tells every server that keeps anything under their ids — every
 * server rather than an agent's, because no agent is involved in a delete and a memory filed by
 * any of them is still a memory of this card.
 *
 * Called without being awaited: a memory server forgetting is its own business, and a slow one
 * must not hold a delete open.
 */
export function subjectsDeleted(kind: "card" | "task", ids: readonly string[]) {
  for (const id of ids)
    void notify("sessionDelete", { session: { id }, host: HOST, vars: { kind } });
}

/**
 * What is wrong with a server row's `hiddenTools` and `hooks`, as a write hands them over.
 *
 * `validateHooks` is the pool's and assumes the shape it was typed with. These columns are JSON
 * a client wrote, so the shape is checked first: an entry that is not an object would otherwise
 * be a crash in the validator rather than a sentence about the row.
 */
export function hookProblems(row: { hiddenTools?: unknown; hooks?: unknown }): string[] {
  const problems: string[] = [];
  if (
    row.hiddenTools != null &&
    !(Array.isArray(row.hiddenTools) && row.hiddenTools.every((name) => typeof name === "string"))
  )
    problems.push("hiddenTools must be a list of tool names");
  if (row.hooks == null) return problems;
  if (!Array.isArray(row.hooks)) return [...problems, "hooks must be a list"];
  const shapeless = row.hooks.findIndex(
    (hook) => !hook || typeof hook !== "object" || Array.isArray(hook),
  );
  if (shapeless >= 0) return [...problems, `hook ${shapeless + 1}: must be an object`];
  return [...problems, ...validateHooks(row.hooks)];
}
