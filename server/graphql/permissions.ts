import {
  Actions,
  accept,
  and,
  createCan,
  createGraphQLAbility,
  deny,
  type PermissionsMap,
  type Rule,
  rule,
} from "@vantreeseba/graphql-casl";
import { GraphQLError } from "graphql";
import type { Caller, GraphContext } from "../auth.ts";

/**
 * Who may call what, in one place.
 *
 * This used to be said twice and enforced once. `TOOLS` in `mcp-endpoint.ts` lists the
 * thirty-six fields an agent is offered, and `features` in `schema.ts` says which tables get
 * generated writes at all — but the first is a listing, not a lock. Both endpoints are one
 * token and one schema, so an agent that could call a curated tool could also post to
 * `/graphql` and call `deleteCards` with no `where`, which empties the table. The tool list
 * decided what an agent was *told about*; nothing decided what it could *reach*.
 *
 * So the rules are here, applied to the schema itself rather than to either endpoint, which is
 * what makes them true of both. `TOOLS` stays what it always was and is now only a listing —
 * an agent's context is worth spending deliberately, and thirty-six tools is a different
 * question from what the ninety-eighth mutation would do.
 *
 * The map is a whitelist of what to guard, so the two root types say their default outright:
 * every mutation is denied unless it is named below, which is what makes a field added to the
 * schema later ship shut rather than open. Reads are the other way round, and deliberately: the
 * only thing on this server worth keeping from a reader is the API key, and that is excluded
 * from the types entirely — there is no field to guard because there is no field.
 */

/**
 * The subjects rules are written against: the GraphQL types, which are the tables.
 *
 * Named as a type rather than inferred from generated resolvers, which this repo does not emit
 * — `typescript-resolvers` over ninety-eight generated mutations is a build of its own for a
 * list of fifteen names. A subject the schema has not got is caught when the map is applied,
 * which happens as the server is built rather than on the request that would have needed it.
 */
type SubjectName =
  | "Project"
  | "Lane"
  | "Card"
  | "Task"
  | "Message"
  | "CardNote"
  | "CardEvent"
  | "CardDep"
  | "Run"
  | "BoardTemplate"
  | "Agent"
  | "Role"
  | "McpServer"
  | "AgentServer"
  | "Setting";

type Subjects = Record<SubjectName, Record<string, unknown>>;

const BOARD = ["Project", "Lane", "Card", "Task", "Message", "CardNote", "CardDep"] as const;
const CONFIG = ["Agent", "Role", "McpServer", "AgentServer", "Setting"] as const;

/**
 * What each kind of caller may do.
 *
 * The operator is the person whose server this is, and there is nothing here they may not do —
 * the web app is the whole of the API. An agent runs the board: it makes projects and cards,
 * works them, moves them and says what it found. What it may not do is re-key the server or
 * re-staff it, because which model runs where and on whose key is the operator's business, and
 * an agent editing the agents is a loop nobody asked for.
 *
 * Reading is almost unrestricted. The one thing an agent is not shown is the settings row, which
 * is the operator's account of their own server — which endpoint, which model, what it costs.
 * The agents and the roles it does see, because a lane names one of each and a client drawing a
 * board has to be able to ask which exist.
 */
function abilitiesFor(caller: Caller) {
  const { can, build } = createGraphQLAbility<Subjects>();
  if (caller === "operator") {
    can(Actions.manage, [...BOARD, ...CONFIG, "Run", "CardEvent", "BoardTemplate"]);
    return build();
  }
  // What an agent may see. Not `Setting`, which is the operator's account of their own server,
  // and not the MCP servers, which are how it is wired rather than what it is working on. The
  // agents and the roles are readable because a lane names one of each, so a client drawing a
  // board has to be able to ask which exist.
  can(Actions.read, [...BOARD, "Run", "CardEvent", "BoardTemplate", "Agent", "Role"]);
  // An agent's board. No `Lane`: the shape of the pipeline is the board somebody drew, and a
  // station that rewires itself is one nobody can reason about afterwards. No `Setting`, no
  // `Agent`, no `McpServer`, and no deleting a `Project`, which takes a board and its history.
  can([Actions.create, Actions.update], ["Project", "Card", "Task", "CardNote", "CardDep"]);
  can(Actions.delete, ["Card", "Task", "CardNote", "CardDep"]);
  can([Actions.create, Actions.update], "BoardTemplate");
  return build();
}

/**
 * The caller a request is from, defaulting to the operator.
 *
 * A request with no context at all is one nothing built a context for — a test calling
 * `graphql()` directly, or a tool executing the schema in process. Those are this server
 * running its own schema against itself, which is the operator; an agent's requests come
 * through `/mcp`, which says so.
 */
const callerOf = (ctx: Partial<GraphContext> | undefined) => ctx?.caller ?? "operator";

const canUser = createCan<Partial<GraphContext> | undefined, Subjects>(
  async (ctx) => abilitiesFor(callerOf(ctx)),
  // Everything past the door is a caller of some kind; the door itself is `requireAuth`.
  () => true,
);

/**
 * The columns a client may write on a card, and nothing else.
 *
 * `UpdateCardInput` is generated from the table, so it offers every column — including the ones
 * the board owns rather than the author. `set: { laneId }` moves a card without renumbering the
 * lane it lands in and without the ledger row that says why it moved; `set: { archivedAt }`
 * archives one out from under the agent working it; `set: { attempts: 0 }` refills a rework
 * budget that is deliberately only reset by a person. Each of those has a door of its own —
 * `moveCard`, `archiveCard`, `retryCard` — which is where the arithmetic and the ledger live.
 *
 * An allow-list rather than a deny-list, so a column added to `cards` tomorrow is not writable
 * by accident. The runner and the hand-written mutations write through Drizzle rather than
 * through this field, so none of them is affected.
 */
const CARD_AUTHORED = ["title", "body", "acceptance"];

const authoredColumnsOnly = rule(
  (_parent, args) => {
    const set = (args as { set?: Record<string, unknown> }).set ?? {};
    const owned = Object.keys(set).filter((column) => !CARD_AUTHORED.includes(column));
    if (!owned.length) return true;
    return new GraphQLError(
      `A card's ${owned.join(", ")} is the board's to set, not the author's. ` +
        "Use `moveCard`, `archiveCard`, `retryCard` or `runCard`, which renumber the lane and " +
        "record why the card moved.",
      { extensions: { code: "BOARD_OWNED" } },
    );
  },
  { name: "authoredColumnsOnly" },
);

/**
 * The mutations that are allowed at all, each with what it does and to what.
 *
 * A bulk write is in none of them, which is the point: `deleteCards` with no `where` empties
 * the table and `deleteCard` cannot, and there is no caller here — the web app included — with
 * a reason to reach for one. They were already left out of the tool listing; now they are shut.
 */
const MUTATIONS: Record<string, Rule> = {
  // Denied unless named. A generated mutation added by a new table arrives shut.
  "*": deny,

  createProject: canUser(Actions.create, "Project"),
  updateProject: canUser(Actions.update, "Project"),
  deleteProject: canUser(Actions.delete, "Project"),

  createLane: canUser(Actions.create, "Lane"),
  updateLane: canUser(Actions.update, "Lane"),
  deleteLane: canUser(Actions.delete, "Lane"),

  createCard: canUser(Actions.create, "Card"),
  updateCard: and(authoredColumnsOnly, canUser(Actions.update, "Card")),
  deleteCard: canUser(Actions.delete, "Card"),
  // Each of these is a card being worked rather than a row being edited, which is why they are
  // hand-written and why they are `update` on the card either way.
  submitCard: canUser(Actions.create, "Card"),
  moveCard: canUser(Actions.update, "Card"),
  retryCard: canUser(Actions.update, "Card"),
  archiveCard: canUser(Actions.update, "Card"),
  restoreCard: canUser(Actions.update, "Card"),
  runCard: canUser(Actions.update, "Card"),
  stopCard: canUser(Actions.update, "Card"),
  setCardDeps: canUser(Actions.update, "Card"),

  createTask: canUser(Actions.create, "Task"),
  updateTask: canUser(Actions.update, "Task"),
  deleteTask: canUser(Actions.delete, "Task"),
  refineTask: canUser(Actions.update, "Task"),
  stopTask: canUser(Actions.update, "Task"),
  // The one exit a task has. It writes a card, and the conversation is left where it is.
  makeCard: canUser(Actions.create, "Card"),

  createMessage: canUser(Actions.create, "Message"),
  updateMessage: canUser(Actions.update, "Message"),
  deleteMessage: canUser(Actions.delete, "Message"),

  addCardNote: canUser(Actions.create, "CardNote"),
  updateCardNote: canUser(Actions.update, "CardNote"),
  deleteCardNote: canUser(Actions.delete, "CardNote"),

  createCardDep: canUser(Actions.create, "CardDep"),
  updateCardDep: canUser(Actions.update, "CardDep"),
  deleteCardDep: canUser(Actions.delete, "CardDep"),

  deleteRun: canUser(Actions.delete, "Run"),

  saveBoardTemplate: canUser(Actions.create, "BoardTemplate"),
  deleteBoardTemplate: canUser(Actions.delete, "BoardTemplate"),
  // Applying one redraws the lanes of a board, which is the project's shape and not the
  // template's, so it asks after the project.
  applyBoardTemplate: canUser(Actions.update, "Project"),

  createAgent: canUser(Actions.create, "Agent"),
  updateAgent: canUser(Actions.update, "Agent"),
  deleteAgent: canUser(Actions.delete, "Agent"),
  setAgentApiKey: canUser(Actions.update, "Agent"),
  setAgentServers: canUser(Actions.update, "Agent"),

  createRole: canUser(Actions.create, "Role"),
  updateRole: canUser(Actions.update, "Role"),
  deleteRole: canUser(Actions.delete, "Role"),

  createMcpServer: canUser(Actions.create, "McpServer"),
  updateMcpServer: canUser(Actions.update, "McpServer"),
  deleteMcpServer: canUser(Actions.delete, "McpServer"),
  testMcpServer: canUser(Actions.update, "McpServer"),
  reconnectMcp: canUser(Actions.update, "McpServer"),

  updateSetting: canUser(Actions.update, "Setting"),
  setApiKey: canUser(Actions.update, "Setting"),
};

/**
 * Reading one table, in the four ways a generated schema offers it.
 *
 * Guarding `settings` and leaving `settingsGroupBy` is guarding the front door of a room with
 * two: `settingsGroupBy(groupBy: [baseUrl, model])` answers with the same column values under
 * a different heading, and `settingsAggregate { min { … } }` answers with the numeric ones.
 * They are one permission, so they are written as one.
 */
const tableReads = (
  single: string,
  plural: string,
  subject: SubjectName,
): Record<string, Rule> => ({
  [single]: canUser(Actions.read, subject),
  [plural]: canUser(Actions.read, subject),
  [`${plural}Aggregate`]: canUser(Actions.read, subject),
  [`${plural}GroupBy`]: canUser(Actions.read, subject),
});

export const permissions: PermissionsMap = {
  // Reading a row is reading a row. The one thing worth keeping back from a *reader* is the API
  // key, and `exclude.columns` drops it from the types, so no rule here has to remember it.
  "*": accept,
  Query: {
    "*": accept,
    // Three tables an agent is not shown. The settings row is the operator's account of their
    // own server — which endpoint, which model, what it costs. The MCP servers are how it is
    // wired rather than what it is working on, and `env` and `headers` on one of those rows are
    // credentials in all but name: a visiting agent reading them has read somebody's keys.
    ...tableReads("setting", "settings", "Setting"),
    ...tableReads("mcpServer", "mcpServers", "McpServer"),
    ...tableReads("agentServer", "agentServers", "AgentServer"),
  },
  Mutation: MUTATIONS,

  // And the way in that is not a query. A rule on the type guards every field of it wherever it
  // is reached, which is what closes `agents { servers { server { headers } } }` — the same
  // three tables, walked to from a table an agent may read. Naming the entry points alone would
  // have left every one of those relations open.
  Setting: canUser(Actions.read, "Setting"),
  McpServer: canUser(Actions.read, "McpServer"),
  AgentServer: canUser(Actions.read, "AgentServer"),
  // A relation's aggregate answers with a different type, so the rule on `AgentServer` does not
  // reach it. `McpServer.agentsAggregate` is the same shape and is covered, the whole of
  // `McpServer` being guarded already.
  Agent: { serversAggregate: canUser(Actions.read, "AgentServer") },
};
