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
 * mutation, since a `deleteCards` with no `where` empties the table and `deleteCard` cannot; and
 * deleting a project, which takes its whole board and history with it and is worth the walk to
 * the UI.
 */
const TOOLS = [
  "Query.projects",
  "Query.lanes",
  "Query.cards",
  "Query.tasks",
  "Query.runs",
  "Query.runEvents",
  "Query.cardEvents",
  "Query.cardNotes",
  "Query.blockers",
  "Query.agents",
  "Query.roles",
  "Query.spend",
  "Query.boardTemplates",
  "Mutation.createProject",
  "Mutation.updateProject",
  "Mutation.submitCard",
  "Mutation.createTask",
  "Mutation.refineTask",
  "Mutation.makeCard",
  "Mutation.deleteTask",
  "Mutation.createCard",
  "Mutation.updateCard",
  "Mutation.deleteCard",
  "Mutation.setCardDeps",
  "Mutation.addCardNote",
  "Mutation.updateCardNote",
  "Mutation.deleteCardNote",
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
    "The columns of a board, in `position` order — and its pipeline. A lane with a `roleId` and " +
    "an `agentId` is a station: `roleId` says what kind of lane it is and `agentId` which model " +
    "works it, and cards there go to `onSuccessLaneId` or `onFailureLaneId` afterwards — or off " +
    "the board altogether, where `archiveOnSuccess` is set and a pass is the end of the line. " +
    "A lane " +
    "with neither is a resting place, which is what a backlog and a done pile are. `prompt` is " +
    "anything this board adds to what its kind says, appended and never replacing it. " +
    "`wipLimit` caps how many cards it works at once, and `maxAttempts` is how many times it " +
    "puts a card it failed back in play before waiting for a person. Filter by `projectId`.",
  cards:
    "The units of work. `status` is `idle`, `running`, `done`, `rejected` or `error` — " +
    "`rejected` is a reviewer having turned the card down, `error` is something having broken, " +
    "and they are apart because they want different things from you. `error` is what broke and " +
    "never a verdict: what an agent made of the card, what a reviewer ruled and anything a " +
    "person wants taken into account are all in `card_notes`, and `card_events` says why the " +
    "card is where it is. `acceptance` is what it will be judged on, " +
    "`taskId` is the conversation it was written out of and `parentId` the card it was broken " +
    "off — a station that expands archives the card it read and writes its children. A card " +
    "waiting on a dependency is " +
    "`idle` like any other — ask `blockers` what is in its way. Filter by `projectId`, or by " +
    "`laneId` for one column. A card with an `archivedAt` has been put away and is not on the " +
    "board any more, so add `archivedAt: { isNull: true }` to see what the board sees — this " +
    "query does not filter them out for you.",
  card_notes:
    "Everything ever said about a card, oldest first. `kind` is `report` — what an agent made " +
    "of the card when it worked it — or `verdict`, a reviewing station's ruling in its own " +
    "words, or `note`, something a person wants taken into account. `author` says whether an " +
    "agent or a person wrote it, and stays true after `runId` is emptied by the run being " +
    "pruned. Every note of kind `note` is handed to the next agent that works the card, which " +
    "is what `add_card_note` is for; a report and a verdict are an account of what happened " +
    "and only the runner writes those. Filter by `cardId`.",
  card_events:
    "A card's ledger: every move it has made, in `createdAt` order. `noteId` points at what " +
    "was said about the move — a reviewer's verdict in its own words, or what a person wrote " +
    "when they moved it — which is a row in `card_notes`. " +
    "`fromLaneId` null is the card being created and `toLaneId` null is it " +
    "being archived; the two being the same lane is a ruling that left the card where it was. " +
    '`actor` says who decided. This is the answer to "why is this card here", which nothing ' +
    "on the card itself can tell you. Filter by `cardId`.",
  blockers:
    "The unfinished cards a card is waiting on — why a lane's agent keeps passing it over. " +
    "Empty means nothing is in its way. Worked out from the board as it stands each time you " +
    "ask, so it is never stale; an archived dependency does not count, since taking one off " +
    "the board is a decision that it need not happen.",
  tasks:
    "A conversation about what somebody wants, before it is work: a title, a `brief` that " +
    "`refine_task` rewrites each turn, and the messages it was arrived at through. A task has " +
    "no status and no pipeline of its own — `make_card` is its one exit, and whether it ever " +
    "reached the board is the cards carrying its id. Filter by `projectId`.",
  runs:
    "What happened when an agent ran — `kind` is `refine` or `card`, and `decompose` on old " +
    "rows from before breaking work up was a station. `status` is " +
    "`running`, `ok`, `error` or `stopped`, and a finished run carries its output, its error, " +
    "the tools it called and what it cost. `verdict` is what it ruled, and only a run at a " +
    "judging station rules anything: `pass`, `fail`, or `none` for every other run — including " +
    "a judging one that never finished, because a reviewer whose connection dropped ruled on " +
    "nothing. Order by `startedAt` descending for the latest.",
  agents:
    "Which models are available to work with: one endpoint each, and nothing about what they " +
    "do — an agent finds that out from the lane it works, and the same one can work a lane and " +
    "judge another. Read-only here: an agent's endpoint and key are the operator's to set.",
  roles:
    "The kinds of lane a board can be assembled out of: a name and the prompt every lane of " +
    "that kind is told. `contract` is the shape of the answer — `work` reports on the card, " +
    "`verdict` rules PASS or FAIL on it, `expand` breaks it into more cards — and it is the " +
    "only part of a role anything here reads. There may be as many as somebody has written. " +
    "Read-only here.",
  spend:
    "What a board has cost in tokens, added up from its runs. With a `taskId` it is one task " +
    "instead — its refinement and every run of every card it became. `from` " +
    "is the oldest run counted: quote that rather than `days`, because runs older than the " +
    "retention setting are gone and cannot be in the total.",
  board_templates:
    "Boards that have been kept under a name, to start the next project with. `lanes` is the " +
    "shape itself — the columns, their kinds, their agents, their WIP limits and the arrows " +
    "between them, written as indexes into the same list so it can be drawn onto any project.",
  create_project:
    "Adds a board. It comes with five lanes — Intake, Backlog, Doing, Review, Done — Intake, " +
    "Doing and Review already carrying those kinds of lane and staffed by an agent this " +
    "server has, so it is ready for work as soon as it exists. Intake breaks a card into the " +
    "cards that carry it out, Doing works them and Review judges what Doing produced. Set " +
    "`autoRun: true` for cards to be picked up without being asked.",
  update_project:
    "Edits one board. `set: { autoRun: false }` leaves everything in place but stops agents " +
    "picking up cards, which is the gentle way to pause a project.",
  submit_card:
    "The short way in, and the one to reach for: one card at the board's front door — the lane " +
    "marked `intake`, else the leftmost — without needing to know a lane id. Put as much as " +
    "you know in the `body`; it and the project's `context` are all the first agent gets. If " +
    "that lane is a station that expands, this one card becomes the cards that carry the work " +
    "out as soon as it is worked, so it does not have to be small.",
  create_task:
    "Opens a conversation about something without putting it on a board — for a request too " +
    "vague to write a card from. `refine_task` for as many turns as it takes, then `make_card` " +
    "when the brief is worth working. If you already know what you want, `submit_card` skips " +
    "all of it.",
  refine_task:
    "Says something to the refining agent about a task and returns its run. Each turn rewrites " +
    "the task's title and brief, so read the task back afterwards to see where the brief has " +
    "got to. A task can be talked about for as long as you like.",
  make_card:
    "Ends a conversation by putting it on the board: the task's title and brief become one " +
    "card at the front door, carrying the task's id. One card, not many — breaking work up is " +
    "a station now, so a front door that expands is what turns it into the cards that carry " +
    "the work out. The conversation is left where it is and can go on afterwards.",
  delete_task:
    "Deletes one task and its conversation. The cards it produced are left where they are: " +
    "they are the work, and the task was only how it was asked for.",
  create_card:
    "Puts one piece of work in a lane you have picked — the thing to reach for when you know " +
    "exactly which station it should start at. Otherwise `submit_card`, which finds the front " +
    "door for you. Needs a `projectId` and a `laneId`: there is no intake defaulting here, so read " +
    "`lanes` and pick one, which for work nobody should start yet is the lane with `intake` " +
    "set. `acceptance` is what a review agent will judge it on, and is worth writing even " +
    "when the body says it in passing — a criterion buried in a paragraph is one that gets " +
    "skipped. A card written this way carries no `taskId`, which is the honest record of " +
    "where it came from.",
  update_card:
    "Edits one card — its title, body or acceptance criteria. Use `move_card` to put it in a " +
    "different lane; setting `laneId` here skips the renumbering and leaves the board in an " +
    "order it does not look like.",
  delete_card:
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
    "will pick it up again. Say why in `note`: it is recorded against the move, and the agent " +
    "that picks the card up is shown it, exactly as it is shown a reviewer's rejection. " +
    "Sending a card back without saying what was wrong buys a second attempt at the first.",
  retry_card:
    "Puts a card that stopped back in play where it stands, without running it — `rejected` " +
    "or `error` alike. Both wait for a person on purpose, and this is the person: it clears " +
    "the card and empties the failed attempts counted against it, after which its lane's " +
    "agent picks it up again. The reason it stopped is left standing in its ledger, so the " +
    "next agent is still told what was wrong. Refused on an archived card: `restore_card` " +
    "puts it back on the board first.",
  archive_card:
    "Takes a card off the board without deleting it — the Done pile once it is long enough to " +
    "be in the way, or the card nobody is going to do. It keeps its lane, its status, its " +
    "notes and its ledger, stops being picked up, and stops counting as something other " +
    "cards wait on. Refused while an agent is working it.",
  restore_card:
    "Puts an archived card back, at the end of the lane it was archived from. Its status is " +
    "left as it was — a card archived in `error` comes back in `error`, one archived as " +
    "`rejected` comes back rejected, and `retry_card` is still what puts either back in play.",
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
 * The two that run an agent destroy nothing: each adds a run and waits for it. Neither is
 * idempotent — refining a task twice is two turns of a conversation — so the default is
 * overridden in one direction only. The two front doors are the same shape: each adds a card
 * and discards nothing, and asking twice puts two cards on the board. `move_card`,
 * `retry_card`, `archive_card` and `restore_card` do the same thing twice running, and none
 * discards anything.
 *
 * `stop_card` keeps the destructive mark. Aborting a run discards it: the run is finished as
 * `stopped` with no output, so whatever the agent had done by then is gone and cannot be
 * resumed, which is worth an operator's confirmation. Calling it a second time is free —
 * nothing is in flight and it answers `false` — and that is the part the convention cannot know.
 */
const WRITE_HINTS: Record<string, { destructiveHint?: boolean; idempotentHint?: boolean }> = {
  submit_card: { destructiveHint: false },
  make_card: { destructiveHint: false },
  refine_task: { destructiveHint: false },
  run_card: { destructiveHint: false },
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
  // acceptance and all — into a listing of projects, which is a lot of context for a question
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
