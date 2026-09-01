import { createHttpHandler } from "@cubicecho/graphql-mcp";
import express from "express";
// The version a client is told it is talking to; without it the wrapper library reports its own.
// Default import, not a named one: Node's own JSON modules only export a default, and the
// container runs this file through Node rather than tsx.
import pkg from "../package.json" with { type: "json" };
import { schema } from "./graphql/schema.ts";

/**
 * The tools an outside client is handed, and nothing else.
 *
 * The schema has fifty-odd root fields — aggregates, group-bys, bulk writes, the settings row
 * with the API key behind it — and projecting all of them would spend an agent's context on
 * things no agent should be reaching for. These are the ones that make this a kanban server to
 * someone driving it from outside: make a project, put work into it, read the board, and move
 * or run a card.
 *
 * Left out on purpose: `settings`, `setApiKey` and the agent and MCP-server rows (which model
 * runs where, on whose key, is the operator's business and not a visiting agent's); every bulk
 * mutation, since a `deleteCard` with no `where` empties the table and `deleteCardSingle`
 * cannot; and deleting a project, which takes its whole board and history with it and is worth
 * the walk to the UI.
 */
const TOOLS = [
  "Query.projects",
  "Query.lanes",
  "Query.cards",
  "Query.tasks",
  "Query.runs",
  "Query.runEvents",
  "Query.agents",
  "Mutation.createProject",
  "Mutation.updateProjectSingle",
  "Mutation.submitTask",
  "Mutation.createTask",
  "Mutation.refineTask",
  "Mutation.acceptTask",
  "Mutation.decomposeTask",
  "Mutation.deleteTaskSingle",
  "Mutation.updateCardSingle",
  "Mutation.deleteCardSingle",
  "Mutation.moveCard",
  "Mutation.runCard",
  "Mutation.stopCard",
  "Mutation.stopTask",
];

/**
 * A line of orientation on the tools whose GraphQL fields are generated, and so describe
 * themselves only as "the `cards` query". A visiting agent has no other way to learn that a
 * task is not a card, or that what moves a card along is the lane it is in.
 *
 * Keyed by tool name, which is the snake_case one the client sees — `decorate` runs after the
 * rename. The `include` list above is not: filtering happens before it, on the GraphQL field.
 */
const HINTS: Record<string, string> = {
  projects:
    "The boards on this server. `autoRun` says whether agents pick cards up by themselves; " +
    "`context` is the standing description every agent working this project is shown, so it is " +
    "the place to put what the project is and how it should be worked.",
  lanes:
    "The columns of a board, in `position` order — and its pipeline. A lane with an `agentId` " +
    "is a station: cards there get worked by that agent, and go to `onSuccessLaneId` or " +
    "`onFailureLaneId` afterwards. A lane with no agent is a resting place, which is what a " +
    "backlog and a done pile are. `wipLimit` caps how many cards it works at once. Filter by " +
    "`projectId`.",
  cards:
    "The units of work. `status` is `idle`, `running`, `blocked`, `done` or `error`; a finished " +
    "card carries the agent's `result`. `acceptance` is what it will be judged on and `taskId` " +
    "is the task it was decomposed out of. Filter by `projectId`, or by `laneId` for one column.",
  tasks:
    "What people ask for, before it is work. A task is a title and a `brief`, and it becomes " +
    "cards only by being decomposed — `status` walks `draft` → `ready` → `decomposing` → " +
    "`decomposed`. Filter by `projectId`.",
  runs:
    "What happened when an agent ran — `kind` is `refine`, `decompose` or `card`, `status` is " +
    "`running`, `ok`, `error` or `stopped`, and a finished run carries its output, its error, " +
    "the tools it called and what it cost. Order by `startedAt` descending for the latest.",
  agents:
    "Who does the work: which model on which endpoint, and what for. `role` is `refine`, " +
    "`decompose`, `review` or `execute`. Read-only here — an agent's endpoint and key are the " +
    "operator's to set.",
  create_project:
    "Adds a board. It comes with four lanes — Backlog, Doing, Review, Done — already wired to " +
    "this server's execute and review agents, so it is ready for work as soon as it exists. " +
    "Set `autoRun: true` for cards to be picked up without being asked.",
  update_project_single:
    "Edits one board. `set: { autoRun: false }` leaves everything in place but stops agents " +
    "picking up cards, which is the gentle way to pause a project.",
  submit_task:
    "The short way in, and the one to reach for: describe what you want and it is written down, " +
    "broken into cards by the decomposing agent, and put on the board — one call, answering " +
    "once the cards exist. Put as much as you know in the `brief`; it is all the decomposer " +
    "gets. A decomposition that fails leaves the task in `error` with the reason on it, so read " +
    "the task back rather than assuming cards appeared.",
  create_task:
    "Writes a task down without doing anything with it. A `draft` task is for talking over " +
    "first — `refine_task`, then `accept_task`, then `decompose_task`. If you already know what " +
    "you want, `submit_task` is the one call that does all of it.",
  refine_task:
    "Says something to the refining agent about a draft task and returns its run. Each turn " +
    "rewrites the task's title and brief, so read the task back afterwards to see where the " +
    "brief has got to. Only works on a `draft` task.",
  accept_task:
    "Marks a task ready for decomposition. This does not produce cards on its own — " +
    "`decompose_task` does.",
  decompose_task:
    "Breaks a task into cards and puts them in the board's intake lane, answering when the " +
    "decomposer is done. The cards it wrote are the ones carrying this task's id.",
  delete_task_single:
    "Deletes one task and its conversation. The cards it produced are left where they are: " +
    "they are the work, and the task was only how it was asked for.",
  update_card_single:
    "Edits one card — its title, body or acceptance criteria. Use `move_card` to put it in a " +
    "different lane; setting `laneId` here skips the renumbering and leaves the board in an " +
    "order it does not look like.",
  delete_card_single:
    "Deletes one card. Refused while an agent is working it: stop it first with `stop_card`.",
  move_card:
    "Puts a card in a lane, at a position. This is how work is redirected by hand — and how a " +
    "failed card is retried, since a moved card comes back to `idle` and a lane with an agent " +
    "will pick it up again.",
  run_card:
    "Works one card now with its lane's agent, answering when the run finishes. The card moves " +
    "on by itself afterwards, to whichever lane its own said to send it.",
  stop_card: "Calls off whatever is running on a card. Answers `false` if nothing was.",
  stop_task: "Calls off a refinement or a decomposition. Answers `false` if nothing was.",
};

/**
 * The mutations a naming convention cannot classify, and what they actually do.
 *
 * `mutationHints: "byName"` reads the conventional prefixes off the GraphQL field name, which
 * settles the creates, updates and deletes: the creates destroy nothing, the deletes do and
 * land the same way twice. A client that gates on `destructiveHint` — asking the operator
 * before it proceeds — should be spending that interruption on the delete, and it cannot if
 * adding a card looks the same as dropping one.
 *
 * The rest are named after neither prefix, so they arrive under the conservative default of
 * destructive and not idempotent. Only one of them earns it.
 *
 * The four that run an agent destroy nothing: each adds a run and waits for it. None is
 * idempotent — decomposing a task twice makes two sets of cards, and refining it twice is two
 * turns of a conversation — so the default is overridden in one direction only. `accept_task`
 * and `move_card` do the same thing twice running, and neither discards anything.
 *
 * `stop_card` keeps the destructive mark. Aborting a run discards it: the run is finished as
 * `stopped` with no output, so whatever the agent had done by then is gone and cannot be
 * resumed, which is worth an operator's confirmation. Calling it a second time is free —
 * nothing is in flight and it answers `false` — and that is the part the convention cannot know.
 */
const WRITE_HINTS: Record<string, { destructiveHint?: boolean; idempotentHint?: boolean }> = {
  submit_task: { destructiveHint: false },
  refine_task: { destructiveHint: false },
  decompose_task: { destructiveHint: false },
  run_card: { destructiveHint: false },
  accept_task: { destructiveHint: false, idempotentHint: true },
  move_card: { destructiveHint: false, idempotentHint: true },
  stop_card: { idempotentHint: true },
  stop_task: { idempotentHint: true },
};

/**
 * The same schema the web app uses, offered to other clients as MCP tools.
 *
 * A kanban server whose own API is a set of tools can be driven by an agent — "put together a
 * project for the migration and get it started" — which is the shortest path from this being a
 * board someone fills in to being somewhere work is handed off.
 *
 * Stateless: each request builds its own server and answers as JSON, so nothing is pinned to a
 * process and a client can reconnect whenever it likes. Sessions would buy server-initiated
 * messages over an open stream; nothing here sends any.
 */
export const mcpHandler = createHttpHandler({
  schema,
  name: "kanban-server",
  version: pkg.version,
  include: TOOLS,
  // One level: the leaf fields of what a tool returns. Two would pull every card — body,
  // result and all — into a listing of projects, which is a lot of context for a question
  // about names.
  selectionDepth: 1,
  mutationHints: "byName",
  decorate: (descriptor) => ({
    description: HINTS[descriptor.name]
      ? `${HINTS[descriptor.name]}\n\n${descriptor.description}`
      : descriptor.description,
    ...(WRITE_HINTS[descriptor.name] ? { annotations: WRITE_HINTS[descriptor.name] } : {}),
  }),
});

/**
 * Mounts the endpoint. `all`, not `post`: a client does more than call tools — it opens the
 * notification stream with a `GET` and ends its session with a `DELETE` — and the transport
 * answers all three, in JSON-RPC, including when the request is wrong. Mounted on `post`
 * alone, the other two met Express's 404 page instead, which reads as "wrong URL".
 */
export function mountMcp(app: express.Application, route = "/mcp") {
  app.all(route, express.json(), mcpHandler);
}
