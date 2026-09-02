import type { ServerResponse } from "node:http";
import type { McpHttpHandler, McpHttpRequest } from "@cubicecho/graphql-mcp";
import { connectServer, createServerFactory } from "@cubicecho/graphql-mcp";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
// The version a client is told it is talking to; without it the wrapper library reports its own.
// Default import, not a named one: Node's own JSON modules only export a default, and the
// container runs this file through Node rather than tsx.
import pkg from "../package.json" with { type: "json" };
import { requireAuth } from "./auth.ts";
import { schema } from "./graphql/schema.ts";
import { registerPrompts } from "./mcp-prompts.ts";

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
  "Query.roles",
  "Query.spend",
  "Query.boardTemplates",
  "Mutation.createProject",
  "Mutation.updateProjectSingle",
  "Mutation.submitTask",
  "Mutation.createTask",
  "Mutation.refineTask",
  "Mutation.acceptTask",
  "Mutation.decomposeTask",
  "Mutation.deleteTaskSingle",
  "Mutation.createCard",
  "Mutation.updateCardSingle",
  "Mutation.deleteCardSingle",
  "Mutation.setCardDeps",
  "Mutation.moveCard",
  "Mutation.retryCard",
  "Mutation.archiveCard",
  "Mutation.restoreCard",
  "Mutation.runCard",
  "Mutation.stopCard",
  "Mutation.stopTask",
  "Mutation.saveBoardTemplate",
  "Mutation.applyBoardTemplate",
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
    "backlog and a done pile are. `wipLimit` caps how many cards it works at once, and a lane " +
    "with `readVerdict` judges cards rather than working them: its agent answers PASS or FAIL " +
    "and that word picks the arm. Filter by `projectId`.",
  cards:
    "The units of work. `status` is `idle`, `running`, `blocked`, `done` or `error`; a finished " +
    "card carries the agent's `result`. `acceptance` is what it will be judged on and `taskId` " +
    "is the task it was decomposed out of. Filter by `projectId`, or by `laneId` for one " +
    "column. A card with an `archivedAt` has been put away and is not on the board any more, " +
    "so add `archivedAt: { isNull: true }` to see what the board sees — this query does not " +
    "filter them out for you.",
  tasks:
    "What people ask for, before it is work. A task is a title and a `brief`, and it becomes " +
    "cards only by being decomposed — `status` walks `draft` → `ready` → `decomposing` → " +
    "`decomposed`. Filter by `projectId`.",
  runs:
    "What happened when an agent ran — `kind` is `refine`, `decompose` or `card`, `status` is " +
    "`running`, `ok`, `error` or `stopped`, and a finished run carries its output, its error, " +
    "the tools it called and what it cost. Order by `startedAt` descending for the latest.",
  agents:
    "Who does the work: which model on which endpoint, filling which role. Read-only here — an " +
    "agent's endpoint and key are the operator's to set.",
  roles:
    "The jobs an agent can be asked to fill: a name and the prompt that goes with it. `stage` " +
    "is `refine`, `decompose` or `card`; only a `card` role is one a lane can point at, and " +
    "there may be as many of those as somebody has written. Read-only here.",
  spend:
    "What a board has cost in tokens, added up from its runs. With a `taskId` it is one task " +
    "instead — its refinement, its decomposition and every run of every card it became. `from` " +
    "is the oldest run counted: quote that rather than `days`, because runs older than the " +
    "retention setting are gone and cannot be in the total.",
  board_templates:
    "Boards that have been kept under a name, to start the next project with. `lanes` is the " +
    "shape itself — the columns, their agents, their WIP limits and the arrows between them, " +
    "written as indexes into the same list so it can be drawn onto any project.",
  create_project:
    "Adds a board. It comes with four lanes — Backlog, Doing, Review, Done — already wired to " +
    "this server's executor and reviewer agents, so it is ready for work as soon as it exists. " +
    "Review is set to read its agent's answer as a PASS/FAIL verdict. Set `autoRun: true` for " +
    "cards to be picked up without being asked.",
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
  create_card:
    "Puts one piece of work on a board directly, without a task to decompose — the thing to " +
    "reach for when you already know what the card is and breaking it up would only be " +
    "ceremony. Needs a `projectId` and a `laneId`: there is no intake defaulting here, so read " +
    "`lanes` and pick one, which for work nobody should start yet is the lane with `intake` " +
    "set. `acceptance` is what a review agent will judge it on, and is worth writing even " +
    "when the body says it in passing — a criterion buried in a paragraph is one that gets " +
    "skipped. A card written this way carries no `taskId`, which is the honest record of " +
    "where it came from.",
  update_card_single:
    "Edits one card — its title, body or acceptance criteria. Use `move_card` to put it in a " +
    "different lane; setting `laneId` here skips the renumbering and leaves the board in an " +
    "order it does not look like.",
  delete_card_single:
    "Deletes one card. Refused while an agent is working it: stop it first with `stop_card`.",
  set_card_deps:
    "Replaces what a card waits on, as a whole set — the ids of other cards on the same board " +
    "that must finish first. A card with an unfinished dependency is skipped rather than run " +
    "out of order, so this is what puts a decomposition back in the right order. Pass an " +
    "empty list to say a card waits on nothing. A cycle is refused, and the refusal names the " +
    "cards in it.",
  move_card:
    "Puts a card in a lane, at a position. This is how work is redirected by hand — and how a " +
    "failed card is retried, since a moved card comes back to `idle` and a lane with an agent " +
    "will pick it up again.",
  retry_card:
    "Puts a failed card back in play where it stands, without running it. A card a reviewer " +
    "rejected keeps its `error` status so the board waits for a person, and this is what " +
    "clears it — after which its lane's agent will pick it up again.",
  archive_card:
    "Takes a card off the board without deleting it — the Done pile once it is long enough to " +
    "be in the way, or the card nobody is going to do. It keeps its lane, its status and its " +
    "result, stops being picked up, and stops counting as something other cards wait on. " +
    "Refused while an agent is working it.",
  restore_card:
    "Puts an archived card back, at the end of the lane it was archived from. Its status is " +
    "left as it was — a card archived in `error` comes back in `error`, and `retry_card` is " +
    "still what puts that back in play.",
  run_card:
    "Works one card now with its lane's agent, answering when the run finishes. The card moves " +
    "on by itself afterwards, to whichever lane its own said to send it.",
  stop_card: "Calls off whatever is running on a card. Answers `false` if nothing was.",
  stop_task: "Calls off a refinement or a decomposition. Answers `false` if nothing was.",
  save_board_template:
    "Keeps a project's lanes under a name so another project can start with them. The cards " +
    "are not part of it. A name that is already taken is replaced, which is how a template is " +
    "corrected — there is no second copy under the same name.",
  apply_board_template:
    "Redraws a project's board from a saved template, and answers with the lanes it wrote. " +
    "Only on a board with no cards on it: lanes are replaced, and a lane takes its cards with " +
    "it. A template naming an agent this server does not have leaves that lane without one, " +
    "so read `lanes` back before expecting it to work cards.",
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
 * turns of a conversation — so the default is overridden in one direction only. `accept_task`,
 * `move_card`, `retry_card`, `archive_card` and `restore_card` do the same thing twice
 * running, and none discards anything.
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
  retry_card: { destructiveHint: false, idempotentHint: true },
  // Neither loses anything — archiving is the alternative to deleting, and each is the other's
  // undo — and archiving an archived card leaves the time it was archived alone.
  archive_card: { destructiveHint: false, idempotentHint: true },
  restore_card: { destructiveHint: false, idempotentHint: true },
  // A set, not an append: writing the same one twice leaves the same ordering. It does replace
  // what was there, which is the destructive half, and the convention cannot read that off a
  // name that starts with `set`.
  set_card_deps: { destructiveHint: true, idempotentHint: true },
  stop_card: { idempotentHint: true },
  stop_task: { idempotentHint: true },
  // Both replace rather than add, and both land the same way twice: saving the same board
  // under the same name overwrites one template with its equal, and drawing a template onto a
  // board that has none of its own cards gets there whether it runs once or twice.
  save_board_template: { destructiveHint: true, idempotentHint: true },
  apply_board_template: { destructiveHint: true, idempotentHint: true },
};

/**
 * The same schema the web app uses, offered to other clients as MCP tools.
 *
 * A kanban server whose own API is a set of tools can be driven by an agent — "put together a
 * project for the migration and get it started" — which is the shortest path from this being a
 * board someone fills in to being somewhere work is handed off.
 *
 * The descriptors are built once here; each request gets a server of its own from the factory.
 */
const makeServer = createServerFactory({
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
 * Stateless MCP over HTTP: a fresh server and transport per request, answered as JSON. Nothing
 * is pinned to a process and a client can reconnect whenever it likes. Sessions would buy
 * server-initiated messages over an open stream; nothing here sends any.
 *
 * This is `createHttpHandler`'s stateless path written out, and it is written out for one
 * reason: the prompts have to be registered on the `McpServer` the factory mints, before it
 * connects, and the driver hands that server to nobody. Owning these lines costs nothing —
 * `createServerFactory` and `connectServer` are the driver's own and are used unchanged, and
 * everything they do for a stateless request (the shared `tools/list` render, the argument
 * guard that answers a bad call before the SDK's validator does) is installed by the factory
 * rather than by the handler. cubicecho/graphql-mcp#20 asks for prompts to be an option beside
 * `tools`, and this goes back to one call when it is.
 */
async function handleMcp(req: McpHttpRequest, res: ServerResponse): Promise<void> {
  const server = makeServer();
  registerPrompts(server);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });

  await connectServer(server, transport);
  await transport.handleRequest(req, res, req.body);
}

export const mcpHandler: McpHttpHandler = Object.assign(handleMcp, {
  // Nothing outlives a request here, so there is nothing to shut down. It stays because the
  // process shutdown calls it, and because turning sessions on would give it work to do.
  close: async () => {},
});

/**
 * Mounts the endpoint. `all`, not `post`: a client does more than call tools — it opens the
 * notification stream with a `GET` and ends its session with a `DELETE` — and the transport
 * answers all three, in JSON-RPC, including when the request is wrong. Mounted on `post`
 * alone, the other two met Express's 404 page instead, which reads as "wrong URL".
 */
export function mountMcp(app: express.Application, route = "/mcp") {
  app.all(route, requireAuth, express.json(), mcpHandler);
}
