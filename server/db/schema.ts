import { defineRelations } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

/**
 * The whole domain, in one place. Postgres is the only database; `client.ts` chooses which
 * postgres — embedded or a server — and nothing above this directory has to care.
 *
 * The shape of the thing, in the order work moves through it:
 *
 * A **project** is a body of work with a board. Its **lanes** are the columns of that board,
 * and a lane may name an **agent**, which is a model endpoint, a system prompt and a set of
 * MCP servers — the unit that actually does something. A **task** is what a person asks for,
 * in their own words, refined over a **message** thread until they accept it. Accepting it
 * hands it to a decompose agent, which turns the one task into many **cards**: the things that
 * land on the board and get worked. Every time an agent is asked to do anything — refine,
 * decompose, or work a card — that is one **run**.
 *
 * A task is deliberately not a card. It is the unit a person thinks in and a card is the unit
 * an agent executes, and the whole point of the decomposer is that those two are different
 * sizes. Keeping both means a card can be traced back to the sentence that asked for it.
 *
 * Column names stay camelCase. Postgres folds unquoted identifiers to lower case, so the
 * generated migrations under `drizzle/` quote every one of them. This file is the only
 * definition of the tables: change it, then `npm run db:generate` to write the migration that
 * gets the change into a database.
 */

const id = () =>
  text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  timestamp({ mode: "date", withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date());

const updatedAt = () =>
  timestamp({ mode: "date", withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date());

/**
 * A kind of lane: what happens to a card at a station, apart from which model it happens on.
 *
 * A role used to be something an agent *was*. It is the role a lane *plays* — "this lane's role
 * is to review" — and a lane is an instance of one. Roles are rows and not an enum because the
 * useful kinds are not knowable from here: a tester, a security reviewer, a technical writer are
 * each a paragraph of instruction and none should need a migration. What cannot be invented is
 * `contract`, which is the shape of answer the server itself reads.
 *
 * A lane points at one and may append an addendum of its own. Editing a role changes every lane
 * of that kind, which is the whole reason a lane keeps the pointer rather than a copy.
 */
export const roles = pgTable("roles", {
  id: id(),
  name: text().notNull().unique(),
  /** What this kind of lane is for, in one line. Shown where one is picked; never sent to a model. */
  description: text().notNull().default(""),
  /**
   * The only thing about a role a program relies on; everything else here is prose.
   *
   * `work` is answered with a report, which becomes the card's `result`. `verdict` is answered
   * with `PASS` or `FAIL` and then why, which routes the card and is kept as the move's note.
   * `expand` is answered with JSON cards, which are written down the pass arrow.
   */
  contract: text({ enum: ["work", "verdict", "expand"] })
    .notNull()
    .default("work"),
  /** What an agent working a lane of this kind is told. The job itself. */
  prompt: text().notNull().default(""),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/**
 * A model endpoint, a prompt, and the tools to go with it.
 *
 * Separate rows rather than one set of settings because the four things this server asks a
 * model to do want different models: refining a sentence with a person watching wants something
 * fast, decomposing wants something that can hold a whole brief in its head, and executing wants
 * whichever one has the tools. Each agent carries its own `baseUrl`, key and model, so one can
 * be a local llama.cpp and the next a frontier API without either knowing about the other.
 *
 * An agent does not know what job it does. The job belongs to the lane, and the two meet nowhere
 * else — which is what lets one agent work a Doing lane and judge a Review lane on one board.
 *
 * Every numeric knob treats zero as "inherit from settings", and `temperature` uses `-1` for it
 * — zero being a temperature someone may genuinely want. Empty strings inherit the same way.
 */
export const agents = pgTable("agents", {
  id: id(),
  name: text().notNull().unique(),
  enabled: boolean().notNull().default(true),
  /** Any OpenAI-compatible endpoint. Empty falls back to the one in settings. */
  baseUrl: text().notNull().default(""),
  /** Empty falls back to settings, then to $OPENAI_API_KEY. Never readable over the API. */
  apiKey: text().notNull().default(""),
  model: text().notNull().default(""),
  /**
   * Who this agent is, said before the lane says what to do. Expected empty: it is for the
   * standing instruction a particular model needs wherever it works — "you are a small local
   * model; be terse" — and not for the job, which belongs to the lane.
   */
  systemPrompt: text().notNull().default(""),
  maxTokens: integer().notNull().default(0),
  temperature: real().notNull().default(-1),
  /** Ceiling on tool round-trips in one run, so a stuck agent cannot loop forever. */
  maxToolIterations: integer().notNull().default(0),
  /**
   * `eager` sends every one of this agent's tool definitions on every request. `ondemand`
   * sends a name-only catalogue and lets the model load the schemas it needs. `inherit` takes
   * whatever Settings says — a word rather than an empty string, because the enum reaches the
   * API and a nameless member reads as a bug there.
   */
  toolDiscovery: text({ enum: ["inherit", "eager", "ondemand"] })
    .notNull()
    .default("inherit"),
  /** Seconds of silence from the endpoint before a request is given up on. Zero inherits. */
  requestTimeoutSeconds: integer().notNull().default(0),
  /** Retries of a request that failed before the model produced anything. -1 inherits. */
  maxRetries: integer().notNull().default(-1),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const mcpServers = pgTable("mcp_servers", {
  id: id(),
  /** Namespace for this server's tools: an agent sees `<slug>__<tool name>`. */
  slug: text().notNull().unique(),
  label: text().notNull().default(""),
  enabled: boolean().notNull().default(true),
  transport: text({ enum: ["stdio", "http"] })
    .notNull()
    .default("stdio"),
  command: text().notNull().default(""),
  args: jsonb().$type<string[]>(),
  env: jsonb().$type<Record<string, string>>(),
  url: text().notNull().default(""),
  headers: jsonb().$type<Record<string, string>>(),
});

/**
 * Which servers an agent may reach.
 *
 * The connection pool is shared — a stdio server is a child process and one per agent would
 * be one per agent per restart — so this decides what an agent is *shown*, not what is
 * running. An agent with no rows here gets no tools at all, which is the right default for a
 * refiner: it is having a conversation, not doing the work.
 */
export const agentServers = pgTable(
  "agent_servers",
  {
    id: id(),
    agentId: text()
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    serverId: text()
      .notNull()
      .references(() => mcpServers.id, { onDelete: "cascade" }),
  },
  (table) => [
    unique("agent_servers_pair").on(table.agentId, table.serverId),
    index("agent_servers_agent_idx").on(table.agentId),
  ],
);

export const projects = pgTable("projects", {
  id: id(),
  name: text().notNull(),
  description: text().notNull().default(""),
  /**
   * Background every agent working this project is given before its own prompt: the stack, the
   * conventions, where things live. It is what stops each card's prompt repeating the same
   * paragraph.
   */
  context: text().notNull().default(""),
  /**
   * Whether the worker fires the lanes' agents on its own.
   *
   * Off, the board is a board: cards sit where they are put and an agent runs when someone
   * asks for it. On, a card that lands in a lane with an agent is picked up, worked, and moved
   * to that lane's `onSuccessLaneId` — the whole pipeline, unattended. It is per project
   * because trusting it is a per-project decision.
   */
  autoRun: boolean().notNull().default(false),
  /** Which agent refines this project's tasks. Empty takes the one in Settings. */
  refineAgentId: text().references(() => agents.id, { onDelete: "set null" }),
  /** Which agent decomposes them. Empty takes the one in Settings. */
  decomposeAgentId: text().references(() => agents.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/**
 * A column of a project's board, and — where it names a role — a station of a pipeline.
 *
 * A lane is not only a place a card sits. `roleId` says what sort of station this is,
 * `agentId` which model staffs it, `onSuccessLaneId` where cards go when it succeeds and
 * `onFailureLaneId` where they go when it does not, which is enough to describe
 * "intake → doing → review → done" without a workflow engine. Every one of those may be empty:
 * a lane with no role is a resting place — a backlog, a done column, a bucket for the ones that
 * need a person.
 *
 * This is the one place a role and an agent meet. Neither table knows about the other.
 */
export const lanes = pgTable(
  "lanes",
  {
    id: id(),
    projectId: text()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text().notNull(),
    /** Left to right on the board. */
    position: integer().notNull().default(0),
    /** Where freshly decomposed cards land. The lowest-positioned lane if none is marked. */
    intake: boolean().notNull().default(false),
    /**
     * What sort of station this is: the job, and the prompt that goes with it. Null is a
     * resting place, where nothing runs however the rest of the lane is filled in.
     *
     * `restrict` rather than `set null`, because a lane that quietly stopped being a Review
     * lane because somebody tidied up the roles list is the silent wedge this codebase keeps
     * refusing to allow. Deleting a role in use is refused instead.
     */
    roleId: text().references(() => roles.id, { onDelete: "restrict" }),
    /**
     * Anything to add on this board, appended to the role's prompt and never replacing it.
     *
     * The role says what a Review lane does everywhere; this says what it does here — "the
     * acceptance criteria are in the card body" — without forking a role per project.
     */
    prompt: text().notNull().default(""),
    /** The agent that works cards in this lane. Null means nothing runs here. */
    agentId: text().references(() => agents.id, { onDelete: "set null" }),
    /** Where a card goes when its run succeeds. Null leaves it where it is. */
    onSuccessLaneId: text().references((): AnyPgColumn => lanes.id, { onDelete: "set null" }),
    /** Where a card goes when its run fails. Null leaves it here, marked `error`. */
    onFailureLaneId: text().references((): AnyPgColumn => lanes.id, { onDelete: "set null" }),
    /** How many cards the worker will run here at once. Zero means one — never unbounded. */
    wipLimit: integer().notNull().default(1),
    /**
     * How many times this station will put a card it failed back in play, before it stops and
     * waits for a person.
     *
     * Zero — the default — is never, which is the behaviour a board has always had: a failed
     * card is left `error` where it lands, so a Doing↔Review loop cannot spin on its own. Any
     * number above that is a budget for the board to correct itself with. It belongs to the
     * lane that *failed* the card rather than the one it goes back to, because how many times
     * a thing is worth rejecting is a judgement the judging station makes.
     */
    maxAttempts: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [index("lanes_project_idx").on(table.projectId)],
);

/**
 * What someone asked for, before it is work.
 *
 * A task is a sentence and a conversation about it. `brief` is the current best statement of
 * it — the refine agent rewrites it as the thread goes — and `status` is how far it has got:
 * `draft` while it is being talked about, `ready` once a person accepts it, then `decomposing`
 * and `decomposed` as the decomposer turns it into cards. A task that needed no refining goes
 * straight from `draft` to `ready`; that path is the whole reason accepting is a separate step
 * from talking.
 */
export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    projectId: text()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text().notNull().default(""),
    /** The statement the decomposer will read. What refinement is refining. */
    brief: text().notNull().default(""),
    status: text({ enum: ["draft", "ready", "decomposing", "decomposed", "error"] })
      .notNull()
      .default("draft"),
    error: text().notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("tasks_project_idx").on(table.projectId)],
);

/** One turn of the conversation that refines a task. The thread is the task's history. */
export const messages = pgTable(
  "messages",
  {
    id: id(),
    taskId: text()
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    role: text({ enum: ["user", "assistant"] })
      .notNull()
      .default("user"),
    content: text().notNull().default(""),
    createdAt: createdAt(),
  },
  (table) => [index("messages_task_idx").on(table.taskId)],
);

/**
 * One piece of work, on the board.
 *
 * Cards are what the decomposer produces and what the lane agents execute. `acceptance` is
 * kept apart from `body` on purpose: it is what a review agent is asked to check against, and
 * a criterion buried in a paragraph of description is a criterion that gets skipped.
 *
 * A card with an `archivedAt` is off the board without being gone: nothing draws it, nothing
 * runs it, and nothing waits on it, but it is still there to be read or restored. It is the
 * middle answer between a Done pile that grows forever and a delete that cannot be undone.
 */
export const cards = pgTable(
  "cards",
  {
    id: id(),
    projectId: text()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** The task this was decomposed out of. Null for a card someone wrote by hand. */
    taskId: text().references(() => tasks.id, { onDelete: "set null" }),
    laneId: text()
      .notNull()
      .references(() => lanes.id, { onDelete: "cascade" }),
    title: text().notNull(),
    body: text().notNull().default(""),
    /** How anyone — a reviewer, a person — can tell this card is actually done. */
    acceptance: text().notNull().default(""),
    /** Top to bottom within its lane. */
    position: integer().notNull().default(0),
    /**
     * `rejected` is a reviewer saying no; `error` is something breaking. They are kept apart
     * because they need different things from a person: one is the system working and wants a
     * decision, the other is a fault and wants looking at.
     *
     * There is no `blocked`: a card waiting on a dependency is `idle`, and what it waits on is
     * read off the cards around it. A stored one went stale the moment the dependency finished.
     */
    status: text({ enum: ["idle", "running", "done", "rejected", "error"] })
      .notNull()
      .default("idle"),
    /**
     * What the last agent to *work* this card had to say about it.
     *
     * A station that judges rather than works leaves this alone: a reviewer's verdict is about
     * the card's output, not another account of it, and overwriting the report with "PASS"
     * would lose the one thing the next agent round the loop needs to read.
     */
    result: text().notNull().default(""),
    /**
     * What broke, and only that: a crash, a timeout, a run a restart interrupted.
     *
     * Never a verdict. A reviewer's reasons are a property of the move it caused, so they live
     * on the `card_events` row — putting them here made a rejection indistinguishable from a
     * connection reset, and `cardPrompt` then fed both to the next agent as the same thing.
     */
    error: text().notNull().default(""),
    /**
     * Failed runs since a person last put this card back in play.
     *
     * It is what a lane's `maxAttempts` is counted against, so it counts failures rather than
     * runs: a card that keeps passing is not using anything up. Nothing the board does on its
     * own resets it — that is the point of a budget — so `retryCard` and `moveCard` do, both
     * being somebody deciding to start this card over.
     */
    attempts: integer().notNull().default(0),
    /**
     * When this card was put out of the way, or null while it is on the board.
     *
     * Archiving is kept apart from `status` because the two say different things: a card is
     * archived whether it finished, failed or was never picked up, and folding that into the
     * status would lose the outcome it is being archived with. A timestamp rather than a flag
     * because an archive is a list, and a list wants an order — most recently put away first.
     *
     * It is the lane that a card is missing from, not the project: an archived card keeps its
     * `laneId`, which is where restoring puts it back.
     */
    archivedAt: timestamp({ mode: "date", withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("cards_project_idx").on(table.projectId),
    index("cards_lane_idx").on(table.laneId),
  ],
);

/**
 * "This card cannot start until that one is done."
 *
 * A decomposition is rarely a flat list — the migration comes before the endpoint that reads
 * it — and without somewhere to say so the ordering lives only in the prose. The worker skips
 * a card whose dependencies have not finished rather than running it out of order.
 */
export const cardDeps = pgTable(
  "card_deps",
  {
    id: id(),
    cardId: text()
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    dependsOnCardId: text()
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
  },
  (table) => [
    unique("card_deps_pair").on(table.cardId, table.dependsOnCardId),
    index("card_deps_card_idx").on(table.cardId),
    // "What is waiting on this card" — the direction nothing could ask before.
    index("card_deps_depends_idx").on(table.dependsOnCardId),
  ],
);

/**
 * One move of one card: where it went, why, and who decided.
 *
 * "Why is this card here?" is a question about the move that put it here, not about the card,
 * and a column on the card could only ever hold the latest answer to it. A reviewer's reasons,
 * a person's note when they drag something back, the run that caused either — this is where
 * they stay, in order, for as long as the card does.
 *
 * `fromLaneId` null is the card being created; `toLaneId` null is it being archived. Nothing
 * else needs saying, so there is no `kind`: from, to, actor and note already say what happened,
 * and an enum here would go stale the way `readVerdict` did.
 *
 * Unlike runs, these are never pruned. `runRetentionDays` throws away the transcript of the
 * work; the ledger is the durable account of what became of the card, and it has to outlive
 * the runs it points at.
 */
export const cardEvents = pgTable(
  "card_events",
  {
    id: id(),
    cardId: text()
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    /** The run that caused this move, or null for a person's. */
    runId: text().references(() => runs.id, { onDelete: "set null" }),
    /**
     * Where the card came from — null when it came from nowhere, which is a card being created
     * or one coming back out of the archive. The first event a card has is its creation and
     * every later one with no `from` is a restore, so the two are told apart by their order
     * rather than by a column saying so.
     */
    fromLaneId: text().references(() => lanes.id, { onDelete: "set null" }),
    /** Where it went — null when it went off the board, which is only ever archiving. */
    toLaneId: text().references(() => lanes.id, { onDelete: "set null" }),
    /** Why: a reviewer's verdict in its own words, or the reason a person gave. */
    note: text().notNull().default(""),
    /** `system` is the server tidying up after itself — a restart putting a run back. */
    actor: text({ enum: ["agent", "user", "system"] })
      .notNull()
      .default("user"),
    createdAt: createdAt(),
  },
  (table) => [index("card_events_card_idx").on(table.cardId)],
);

/**
 * One execution of one agent, and what came of it.
 *
 * Refining, decomposing and working a card are the same act from here — a prompt, some tools,
 * an answer, a bill — so they are one table with a `kind` saying which, rather than three that
 * would each need their own history page. `taskId` and `cardId` are what it was about; both
 * are nullable and exactly one is set.
 */
export const runs = pgTable(
  "runs",
  {
    id: id(),
    projectId: text()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** Null once the agent that ran has been deleted — the account of the run still stands. */
    agentId: text().references(() => agents.id, { onDelete: "set null" }),
    kind: text({ enum: ["refine", "decompose", "card"] })
      .notNull()
      .default("card"),
    taskId: text().references(() => tasks.id, { onDelete: "set null" }),
    cardId: text().references(() => cards.id, { onDelete: "set null" }),
    /** The lane the card was in when this ran; a lane rename since does not rewrite history. */
    laneId: text().references(() => lanes.id, { onDelete: "set null" }),
    /** `stopped` is a run called off by hand — not a failure, and not a result either. */
    status: text({ enum: ["running", "ok", "error", "stopped"] })
      .notNull()
      .default("running"),
    /**
     * What this run ruled, if it was a run that rules on anything.
     *
     * A verdict is about the output, not about the run: a reviewer that answers FAIL has still
     * run fine, so `status` stays `ok` and this says what it decided. `none` is every run from
     * a station that does not judge — and every judging run that never finished, because a
     * reviewer whose connection dropped ruled on nothing.
     *
     * It is here as well as on the move because a verdict need not move the card: a station
     * with no arrow to send it down leaves no event, and the ruling would otherwise be lost.
     */
    verdict: text({ enum: ["none", "pass", "fail"] })
      .notNull()
      .default("none"),
    startedAt: createdAt(),
    finishedAt: timestamp({ mode: "date", withTimezone: true }),
    /** The agent's final reply. */
    output: text().notNull().default(""),
    error: text().notNull().default(""),
    /** Every tool the run called, in order, as JSON — enough to see what it actually did. */
    toolCalls: jsonb().$type<{ name: string; ok: boolean }[]>(),
    promptTokens: integer().notNull().default(0),
    completionTokens: integer().notNull().default(0),
    totalTokens: integer().notNull().default(0),
  },
  (table) => [
    index("runs_project_idx").on(table.projectId),
    index("runs_card_idx").on(table.cardId),
    index("runs_started_idx").on(table.startedAt),
  ],
);

/**
 * One lane of a saved board: everything that makes a lane a station, without the board.
 *
 * The arrows are indexes into the list they belong to rather than ids, because a template has
 * no lanes — the ids do not exist until it is applied, and resolving them is the applying.
 */
export interface TemplateLane {
  name: string;
  position: number;
  intake: boolean;
  /** By id, like `agentId`: a role belongs to this server, and a missing one resolves to none. */
  roleId: string | null;
  /** The lane's own addendum to its role's prompt. */
  prompt: string;
  /** By id, so a template keeps the agents it was drawn with. Missing ones resolve to none. */
  agentId: string | null;
  wipLimit: number;
  /** How many times this station puts a card it failed back in play. Zero never does. */
  maxAttempts: number;
  /** Index into the same list, or null for "leave the card where it is". */
  onSuccess: number | null;
  onFailure: number | null;
}

/**
 * A board somebody drew, kept so the next project can start with it.
 *
 * Stored as a document rather than as rows, because a template is not a board: nothing lands on
 * it, nothing runs on it, and it outlives every project made from it. Copying it into real
 * lanes is `applyBoardTemplate`, in one transaction — the arrows are indexes here and have to
 * become ids there.
 */
export const boardTemplates = pgTable("board_templates", {
  id: id(),
  name: text().notNull().unique(),
  description: text().notNull().default(""),
  lanes: jsonb().$type<TemplateLane[]>().notNull(),
  createdAt: createdAt(),
});

/** One row, `id: "default"`. A table rather than a file so it comes free over GraphQL. */
export const settings = pgTable("settings", {
  id: text().primaryKey().default("default"),
  /** The endpoint an agent uses when it names none of its own. */
  baseUrl: text().notNull().default("http://localhost:11434/v1"),
  /** Empty falls back to $OPENAI_API_KEY. */
  apiKey: text().notNull().default(""),
  model: text().notNull().default(""),
  maxTokens: integer().notNull().default(4096),
  temperature: real().notNull().default(0.7),
  maxToolIterations: integer().notNull().default(20),
  toolDiscovery: text({ enum: ["eager", "ondemand"] })
    .notNull()
    .default("eager"),
  /** Small model that guesses a run's tools before it starts. Empty uses the agent's model. */
  toolSelectModel: text().notNull().default(""),
  requestTimeoutSeconds: integer().notNull().default(120),
  maxRetries: integer().notNull().default(2),
  /**
   * How long a finished run is kept, in days. Zero — the default — keeps every run forever.
   * A run row holds the whole output, so a busy board writes a lot of them.
   */
  runRetentionDays: integer().notNull().default(0),
  /** How often the worker looks for cards to pick up, in seconds. Zero stops it entirely. */
  workerIntervalSeconds: integer().notNull().default(5),
  /**
   * The two jobs that are not stations, and so cannot be found on a board.
   *
   * Refining and decomposing happen off the board, and used to be found by asking which agent
   * held a role with that stage. An agent has no role now, so the answer is named here instead:
   * the fallback for a project that names none of its own. Empty falls back to the first
   * enabled agent, there being nothing else to go on.
   */
  refineAgentId: text().references(() => agents.id, { onDelete: "set null" }),
  decomposeAgentId: text().references(() => agents.id, { onDelete: "set null" }),
  /**
   * What the refiner is told. Empty takes `REFINE_SYSTEM`.
   *
   * Refinement is a conversation and not a kind of lane, so its prompt has no role to live on;
   * it lives here, editable, rather than being a constant nobody can reach.
   */
  refinePrompt: text().notNull().default(""),
});

export const schema = {
  roles,
  agents,
  mcpServers,
  agentServers,
  projects,
  lanes,
  tasks,
  messages,
  cards,
  cardDeps,
  cardEvents,
  runs,
  boardTemplates,
  settings,
};

export const relations = defineRelations(schema, (r) => ({
  roles: {
    lanes: r.many.lanes({ from: r.roles.id, to: r.lanes.roleId }),
  },
  agents: {
    servers: r.many.agentServers({ from: r.agents.id, to: r.agentServers.agentId }),
    lanes: r.many.lanes({ from: r.agents.id, to: r.lanes.agentId }),
    runs: r.many.runs({ from: r.agents.id, to: r.runs.agentId }),
  },
  mcpServers: {
    agents: r.many.agentServers({ from: r.mcpServers.id, to: r.agentServers.serverId }),
  },
  agentServers: {
    agent: r.one.agents({ from: r.agentServers.agentId, to: r.agents.id, optional: false }),
    server: r.one.mcpServers({
      from: r.agentServers.serverId,
      to: r.mcpServers.id,
      optional: false,
    }),
  },
  projects: {
    lanes: r.many.lanes({ from: r.projects.id, to: r.lanes.projectId }),
    tasks: r.many.tasks({ from: r.projects.id, to: r.tasks.projectId }),
    cards: r.many.cards({ from: r.projects.id, to: r.cards.projectId }),
    runs: r.many.runs({ from: r.projects.id, to: r.runs.projectId }),
    refineAgent: r.one.agents({ from: r.projects.refineAgentId, to: r.agents.id }),
    decomposeAgent: r.one.agents({ from: r.projects.decomposeAgentId, to: r.agents.id }),
  },
  // `lanes.onSuccessLaneId` and `onFailureLaneId` are foreign keys but not relations: they
  // point sideways within one board, and everything that reads them already has every lane.
  lanes: {
    project: r.one.projects({ from: r.lanes.projectId, to: r.projects.id, optional: false }),
    role: r.one.roles({ from: r.lanes.roleId, to: r.roles.id }),
    agent: r.one.agents({ from: r.lanes.agentId, to: r.agents.id }),
    cards: r.many.cards({ from: r.lanes.id, to: r.cards.laneId }),
  },
  tasks: {
    project: r.one.projects({ from: r.tasks.projectId, to: r.projects.id, optional: false }),
    messages: r.many.messages({ from: r.tasks.id, to: r.messages.taskId }),
    cards: r.many.cards({ from: r.tasks.id, to: r.cards.taskId }),
  },
  messages: {
    task: r.one.tasks({ from: r.messages.taskId, to: r.tasks.id, optional: false }),
  },
  cards: {
    project: r.one.projects({ from: r.cards.projectId, to: r.projects.id, optional: false }),
    lane: r.one.lanes({ from: r.cards.laneId, to: r.lanes.id, optional: false }),
    task: r.one.tasks({ from: r.cards.taskId, to: r.tasks.id }),
    deps: r.many.cardDeps({ from: r.cards.id, to: r.cardDeps.cardId }),
    // The other direction: the cards held up by this one.
    blocks: r.many.cardDeps({ from: r.cards.id, to: r.cardDeps.dependsOnCardId }),
    runs: r.many.runs({ from: r.cards.id, to: r.runs.cardId }),
    events: r.many.cardEvents({ from: r.cards.id, to: r.cardEvents.cardId }),
  },
  cardDeps: {
    card: r.one.cards({ from: r.cardDeps.cardId, to: r.cards.id, optional: false }),
    dependsOn: r.one.cards({
      from: r.cardDeps.dependsOnCardId,
      to: r.cards.id,
      optional: false,
    }),
  },
  cardEvents: {
    card: r.one.cards({ from: r.cardEvents.cardId, to: r.cards.id, optional: false }),
    run: r.one.runs({ from: r.cardEvents.runId, to: r.runs.id }),
    fromLane: r.one.lanes({ from: r.cardEvents.fromLaneId, to: r.lanes.id }),
    toLane: r.one.lanes({ from: r.cardEvents.toLaneId, to: r.lanes.id }),
  },
  runs: {
    project: r.one.projects({ from: r.runs.projectId, to: r.projects.id, optional: false }),
    agent: r.one.agents({ from: r.runs.agentId, to: r.agents.id }),
    task: r.one.tasks({ from: r.runs.taskId, to: r.tasks.id }),
    card: r.one.cards({ from: r.runs.cardId, to: r.cards.id }),
    // Which station this ran at — the timeline names it, and a rename since must not rewrite it.
    lane: r.one.lanes({ from: r.runs.laneId, to: r.lanes.id }),
  },
}));

export type Role = typeof roles.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type McpServerRow = typeof mcpServers.$inferSelect;
export type AgentServer = typeof agentServers.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Lane = typeof lanes.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type CardDep = typeof cardDeps.$inferSelect;
export type CardEvent = typeof cardEvents.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type BoardTemplate = typeof boardTemplates.$inferSelect;
export type Settings = typeof settings.$inferSelect;
