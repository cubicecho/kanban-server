import { buildSchema, GraphQLDateTime } from "@vantreeseba/drizzle-graphql";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import {
  GraphQLBoolean,
  GraphQLError,
  GraphQLInputObjectType,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  type GraphQLOutputType,
  GraphQLSchema,
  GraphQLString,
} from "graphql";
import { GraphQLJSON } from "graphql-scalars";
import { db } from "../db/client.ts";
import { addNote, recordMove } from "../db/history.ts";
import {
  agentServers,
  agents,
  boardTemplates,
  type Card,
  cardDeps,
  cardNotes,
  cards,
  lanes,
  type Project,
  roles,
  runs,
  settings,
  type TemplateLane,
  tasks,
} from "../db/schema.ts";
import { fold, history, type RunEvent, watch } from "../runner/events.ts";
import { listModels, loadSettings } from "../runner/llm.ts";
import { type McpConnection, mcp, probe } from "../runner/mcp.ts";
import { EXPAND_CONTRACT, VERDICT_CONTRACT, WORK_CONTRACT } from "../runner/prompts.ts";
import {
  blockers,
  isRunning,
  makeCard,
  refineTask,
  runCard,
  runningRunIds,
  runningSubjectIds,
  stopSubject,
  submitCard,
} from "../runner/run.ts";

/**
 * The CRUD half of the API is generated from the Drizzle schema — projects, lanes, cards,
 * tasks, agents, MCP servers and runs all get their queries, filters and mutations for free,
 * and stay in step with the tables by construction. Only the operations that are *not* row
 * edits — running something, or writing several rows that are only correct together — are
 * written by hand below.
 */
const { entities } = buildSchema(db, {
  // `cards` → type `Card`, queries `cards` (list) and `card` (single).
  typeNameMapper: "singularize",
  // Built-in detection leaves a timestamp column as `JSON`. It is a date to everyone who
  // reads it, and `DateTime` transports ISO-8601.
  mapColumnType: (column) => (column.columnType === "PgTimestamp" ? GraphQLDateTime : undefined),
  features: {
    // The run history is written by the runner, never by a client: a hand-made row would claim
    // an agent did something it did not. Settings is a singleton the migration creates. A
    // board template is a document whose arrows have to line up with its own lanes, so it is
    // written by `saveBoardTemplate` from a board that already works, never by hand.
    //
    // A card's ledger is the same argument carried further: it is readable, and nothing else.
    // Its whole worth is that it is an account nobody edited — a row that could be written,
    // corrected or quietly removed answers "why is this card here" no better than the column
    // it replaced. It is written where the move is made, and it is never written anywhere else.
    //
    // A card's notes are readable and generated-writable in neither direction, for a narrower
    // reason: a note says who wrote it, and a generated insert would let anybody write one
    // signed by an agent. `addCardNote` and its two neighbours below are the way in, and they
    // only ever write the one kind a person is entitled to.
    insert: (table) =>
      table !== "runs" &&
      table !== "settings" &&
      table !== "boardTemplates" &&
      table !== "cardEvents" &&
      table !== "cardNotes",
    update: (table) =>
      table !== "runs" &&
      table !== "boardTemplates" &&
      table !== "cardEvents" &&
      table !== "cardNotes",
    delete: (table) => table !== "settings" && table !== "cardEvents" && table !== "cardNotes",
  },
  exclude: {
    // Keys travel one way. They are excluded from the output types, so no client can read one
    // back out; `setApiKey` and `setAgentApiKey` below are how they are written.
    columns: { settings: ["apiKey"], agents: ["apiKey"] },
  },
  onWrite: {
    // A project with no lanes is a board nobody can put a card on, and the first thing anyone
    // would do with a new one is draw the same four. So it comes with them, in the same
    // transaction — a rollback takes the lanes with it.
    projects: {
      after: async ({ operation, rows, tx }) => {
        if (operation === "insert" || operation === "upsert") {
          await seedLanes(tx as typeof db, rows as Project[]);
        }
      },
    },
    tasks: {
      before: ({ operation, args }) => {
        if (operation === "delete") {
          refuseWhileRunning(
            args,
            runningSubjectIds(),
            "This task is being refined. Stop it first, then delete it.",
          );
        }
      },
    },
    cards: {
      before: ({ operation, args }) => {
        if (operation === "delete") {
          refuseWhileRunning(
            args,
            runningSubjectIds(),
            "An agent is working this card. Stop it first, then delete it.",
          );
        }
      },
      // A card's ledger starts where the card does, so that the first line of its history is
      // it arriving rather than the first thing an agent did to it.
      //
      // The lane is read back rather than taken off `rows`, which carry only the columns the
      // caller asked for: a client selecting `{ id }` would otherwise write an event saying the
      // card arrived nowhere. On `tx`, like the lane guard above, and for the same reason.
      after: async ({ operation, rows, tx }) => {
        if (operation !== "insert" && operation !== "upsert") return;
        const ids = (rows as Card[]).map((row) => row.id).filter(Boolean);
        if (!ids.length) return;
        const written = await (tx as typeof db)
          .select({ id: cards.id, laneId: cards.laneId })
          .from(cards)
          .where(inArray(cards.id, ids));
        for (const row of written) {
          await recordMove(
            { cardId: row.id, toLaneId: row.laneId, actor: "user" },
            tx as typeof db,
          );
        }
      },
    },
    // Deleting a lane takes its cards with it, which is fine for the ones drawn in it — you can
    // see what you are destroying. Its archived cards are not drawn anywhere, so the same delete
    // would quietly take a pile nobody was looking at. Refuse instead, and say where they are.
    lanes: {
      // On `tx` and not `db`: the write is already inside a transaction, and on PGlite — one
      // connection — a read that waits for its own transaction to finish never returns.
      before: async ({ operation, args, tx }) => {
        if (operation !== "delete") return;
        const laneId = whereId(args);
        if (!laneId) return;
        const held = await (tx as typeof db)
          .select({ id: cards.id })
          .from(cards)
          .where(and(eq(cards.laneId, laneId), isNotNull(cards.archivedAt)))
          .limit(1);
        if (held.length) {
          throw new GraphQLError(
            "This lane holds archived cards. They are not drawn on the board, so deleting the " +
              "lane would take them with it unseen — restore or delete them from the archive " +
              "first.",
            { extensions: { code: "HAS_ARCHIVED" } },
          );
        }
      },
    },
    // `runs` are read-only apart from deletes, so this hook only ever guards one.
    runs: {
      before: ({ args }) =>
        refuseWhileRunning(
          args,
          runningRunIds(),
          "This run is still going. Stop it first, then delete it.",
        ),
    },
    mcpServers: () => {
      void mcp.sync().catch((error) => console.error("[mcp] sync failed:", error));
    },
  },
});

/**
 * The board a new project starts with: a front door that breaks work up, a backlog, an agent
 * that works cards, an agent that checks the work, and somewhere finished cards go.
 *
 * The lanes are the pipeline — `onSuccessLaneId` and `onFailureLaneId` are the arrows between
 * them — so this is a working board rather than five empty columns. Nothing runs until the
 * project is switched to `autoRun`, or someone presses the button on a card.
 *
 * Intake is the `intake` lane as well as a station, which is what makes one card dropped
 * through the front door become the cards that carry the work out: nothing decomposes off the
 * board any more, so a board with no expanding station is a board where a request stays one
 * card. That is a legitimate shape — it is just not the one to start somebody off with.
 *
 * Review sends a card it failed back to Doing rather than round again: the card arrives with
 * its status set to `rejected`, which the worker will not pick up, so a rejected card waits for
 * a person instead of looping between two agents at whatever a token costs.
 *
 * The three staffed lanes are given a kind — the first role with that contract — and the first
 * enabled agent to staff them with. A role is found by its contract rather than by its name,
 * because a name is a thing somebody edits; the contract is what the server actually reads.
 * Finding neither is not an error: the lanes are still drawn, and the board runs as soon as a
 * role and an agent are named on one. Review judges because it *is* a Review lane, which is the
 * whole of what used to be a flag on the lane and a second one on its agent.
 */
async function seedLanes(tx: typeof db, rows: Project[]) {
  if (!rows.length) return;
  const roleFor = async (contract: (typeof roles.contract.enumValues)[number]) => {
    const found = await tx
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.contract, contract))
      .orderBy(asc(roles.name))
      .limit(1);
    return found[0]?.id ?? null;
  };
  const [worker] = await tx
    .select({ id: agents.id })
    .from(agents)
    .where(eq(agents.enabled, true))
    .orderBy(asc(agents.name))
    .limit(1);
  const agentId = worker?.id ?? null;
  const doingRole = await roleFor(WORK_CONTRACT);
  const reviewRole = await roleFor(VERDICT_CONTRACT);
  const intakeRole = await roleFor(EXPAND_CONTRACT);

  for (const project of rows) {
    if (!project?.id) continue;
    const [intake, backlog, doing, review, done] = await tx
      .insert(lanes)
      .values([
        {
          projectId: project.id,
          name: "Intake",
          position: 0,
          intake: true,
          roleId: intakeRole,
          agentId,
        },
        { projectId: project.id, name: "Backlog", position: 1 },
        { projectId: project.id, name: "Doing", position: 2, roleId: doingRole, agentId },
        { projectId: project.id, name: "Review", position: 3, roleId: reviewRole, agentId },
        { projectId: project.id, name: "Done", position: 4 },
      ])
      .returning();
    // Written second because every arrow points at a lane that did not exist yet.
    await tx.update(lanes).set({ onSuccessLaneId: backlog.id }).where(eq(lanes.id, intake.id));
    await tx.update(lanes).set({ onSuccessLaneId: review.id }).where(eq(lanes.id, doing.id));
    await tx
      .update(lanes)
      .set({ onSuccessLaneId: done.id, onFailureLaneId: doing.id })
      .where(eq(lanes.id, review.id));
  }
}

/**
 * Whether making `cardId` wait on `wanted` would close a loop — and the loop, if it would.
 *
 * One board's graph is small enough to read whole, and reading it whole is what lets the
 * refusal name the cards involved instead of only saying no. Edges point from a card to what
 * it waits on, so a path from the card back to itself is exactly a cycle; the card's own
 * existing edges are left out, because `wanted` is about to replace them.
 */
async function wouldCycle(
  cardId: string,
  wanted: string[],
  projectId: string,
): Promise<string[] | null> {
  const rows = await db
    .select({ id: cards.id, title: cards.title })
    .from(cards)
    .where(eq(cards.projectId, projectId));
  const titles = new Map(rows.map((row) => [row.id, row.title]));

  const edges = new Map<string, string[]>([[cardId, wanted]]);
  const links = await db
    .select({ cardId: cardDeps.cardId, dependsOnCardId: cardDeps.dependsOnCardId })
    .from(cardDeps)
    .where(inArray(cardDeps.cardId, [...titles.keys()]));
  for (const link of links) {
    if (link.cardId === cardId) continue;
    edges.set(link.cardId, [...(edges.get(link.cardId) ?? []), link.dependsOnCardId]);
  }

  const path: string[] = [];
  const seen = new Set<string>();
  const walk = (from: string): boolean => {
    path.push(from);
    for (const next of edges.get(from) ?? []) {
      if (next === cardId) {
        path.push(next);
        return true;
      }
      if (seen.has(next)) continue;
      seen.add(next);
      if (walk(next)) return true;
    }
    path.pop();
    return false;
  };

  return walk(cardId) ? path.map((id) => titles.get(id) ?? id) : null;
}

/**
 * Refuses a delete that would pull the ground out from under something in flight — a card an
 * agent is working, or the very run row the runner is about to write the outcome to. Stop it
 * first; a stopped one deletes like any other.
 *
 * Only the `id.eq` filter the UI sends is read. A filter this cannot resolve is refused
 * outright while anything is running: a rare, recoverable no rather than a wrong yes. Throwing
 * here rolls the mutation back before it writes.
 */
/** The one id a `...Single` write names, where it names one. */
function whereId(args: unknown): string | undefined {
  const where = (args as { where?: { id?: { eq?: unknown } } } | undefined)?.where;
  return typeof where?.id?.eq === "string" ? where.id.eq : undefined;
}

function refuseWhileRunning(args: unknown, running: Set<string>, message: string) {
  if (running.size === 0) return;
  const id = whereId(args);
  if (id !== undefined && !running.has(id)) return;
  // A plain Error would reach the client as "Internal server error" — the library only lets a
  // GraphQLError of its own through. This one is the client's to act on, so it says why.
  throw new GraphQLError(message, { extensions: { code: "RUN_IN_FLIGHT" } });
}

/** One card, or the refusal that says which id had nothing behind it. */
async function cardOrThrow(cardId: string) {
  const [card] = await db.select().from(cards).where(eq(cards.id, cardId)).limit(1);
  if (!card) {
    throw new GraphQLError(`There is no card with id ${cardId}.`, {
      extensions: { code: "NOT_FOUND" },
    });
  }
  return card;
}

/**
 * One note somebody wrote, or the refusal.
 *
 * The kind is checked here rather than by the caller because it is the whole of what makes
 * these three mutations safe: a report and a verdict are an account of what an agent did, and
 * an account anybody may rewrite afterwards answers nothing.
 */
async function noteOrThrow(id: string) {
  const [note] = await db.select().from(cardNotes).where(eq(cardNotes.id, id)).limit(1);
  if (!note) {
    throw new GraphQLError(`There is no note with id ${id}.`, {
      extensions: { code: "NOT_FOUND" },
    });
  }
  if (note.kind !== "note") {
    throw new GraphQLError(
      `That is a ${note.kind}, which is an account of what happened rather than a note. Write your own note instead.`,
      { extensions: { code: "NOT_A_NOTE" } },
    );
  }
  return note;
}

/** Generated types are keyed by the mapped name; a rename should fail loudly, not silently. */
function generatedType(name: string): GraphQLOutputType {
  const type = entities.types[name as keyof typeof entities.types];
  if (!type) {
    throw new Error(
      `drizzle-graphql did not generate a "${name}" type; it has: ${Object.keys(entities.types).join(", ")}`,
    );
  }
  return type as GraphQLOutputType;
}

const McpToolType = new GraphQLObjectType({
  name: "McpTool",
  fields: {
    name: { type: new GraphQLNonNull(GraphQLString) },
    description: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const McpServerStatusType = new GraphQLObjectType({
  name: "McpServerStatus",
  description: "Live connection state for a configured MCP server, and the tools it offers.",
  fields: {
    id: { type: new GraphQLNonNull(GraphQLString) },
    slug: { type: new GraphQLNonNull(GraphQLString) },
    label: { type: new GraphQLNonNull(GraphQLString) },
    status: { type: new GraphQLNonNull(GraphQLString) },
    error: { type: new GraphQLNonNull(GraphQLString) },
    tools: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(McpToolType))) },
  },
});

const McpConnectionInput = new GraphQLInputObjectType({
  name: "McpConnectionInput",
  description: "How to reach an MCP server — the connection half of a row, without its identity.",
  fields: {
    transport: { type: new GraphQLNonNull(GraphQLString) },
    command: { type: GraphQLString },
    args: { type: new GraphQLList(new GraphQLNonNull(GraphQLString)) },
    env: { type: GraphQLJSON },
    url: { type: GraphQLString },
    headers: { type: GraphQLJSON },
  },
});

const McpProbeType = new GraphQLObjectType({
  name: "McpProbe",
  description: "The result of dialling an MCP server once, without saving or pooling it.",
  fields: {
    ok: { type: new GraphQLNonNull(GraphQLBoolean) },
    error: { type: new GraphQLNonNull(GraphQLString) },
    tools: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(McpToolType))) },
  },
});

const RunEventType = new GraphQLObjectType({
  name: "RunEvent",
  description:
    "Something a run did while it was running — a token, a tool call, a notice. Held in memory " +
    "for the length of the run and a minute after; the run row is the lasting record.",
  fields: {
    runId: { type: new GraphQLNonNull(GraphQLString) },
    seq: {
      type: new GraphQLNonNull(GraphQLInt),
      description: "Per-run counter from 1, so a client can order and de-duplicate.",
    },
    at: { type: new GraphQLNonNull(GraphQLDateTime) },
    kind: {
      type: new GraphQLNonNull(GraphQLString),
      description: "turn | thinking | output | tool-call | tool-result | notice | done.",
    },
    text: { type: new GraphQLNonNull(GraphQLString) },
    name: {
      type: new GraphQLNonNull(GraphQLString),
      description: "Tool name, where there is one.",
    },
    ok: { type: GraphQLBoolean },
  },
});

const SpendType = new GraphQLObjectType({
  name: "Spend",
  description:
    "What has been spent on a project, or on one task in it, added up from the run rows " +
    "themselves rather than from a counter — a counter would keep climbing after retention " +
    "deleted the runs behind it.",
  fields: {
    runs: {
      type: new GraphQLNonNull(GraphQLInt),
      description: "How many runs went into this total.",
    },
    promptTokens: { type: new GraphQLNonNull(GraphQLInt) },
    completionTokens: { type: new GraphQLNonNull(GraphQLInt) },
    totalTokens: { type: new GraphQLNonNull(GraphQLInt) },
    days: {
      type: new GraphQLNonNull(GraphQLInt),
      description: "The window that was asked for. Zero means every run still kept.",
    },
    from: {
      type: GraphQLDateTime,
      description:
        "The oldest run in the total. This, not `days`, is what the number actually covers: " +
        "if retention has swept older runs away, it is later than the window asked for. Null " +
        "when nothing was counted.",
    },
    retentionDays: {
      type: new GraphQLNonNull(GraphQLInt),
      description:
        "How long runs are kept, from settings. Zero means forever, and then the total is " +
        "the whole history.",
    },
  },
});

/**
 * Adds up the tokens on the runs that match, in one query.
 *
 * Read rather than remembered, because `runRetentionDays` deletes runs: a stored counter would
 * go on reporting money spent on runs nobody can look at any more, and a total that cannot be
 * checked against the rows behind it is worse than no total. `from` is what makes it honest —
 * it says how far back the rows actually go.
 */
async function spendOver(projectId: string, taskId: string | null | undefined, days: number) {
  const since = days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;

  // A task's spend is its own runs — the refinement, the decomposition — plus every run of
  // every card it was broken into. The cards are what the money actually went on.
  const cardIds = taskId
    ? (await db.select({ id: cards.id }).from(cards).where(eq(cards.taskId, taskId))).map(
        (row) => row.id,
      )
    : [];
  const scope = taskId
    ? or(eq(runs.taskId, taskId), cardIds.length ? inArray(runs.cardId, cardIds) : undefined)
    : undefined;

  const [totals] = await db
    .select({
      runs: sql<number>`count(*)::int`,
      promptTokens: sql<number>`coalesce(sum(${runs.promptTokens}), 0)::int`,
      completionTokens: sql<number>`coalesce(sum(${runs.completionTokens}), 0)::int`,
      totalTokens: sql<number>`coalesce(sum(${runs.totalTokens}), 0)::int`,
      from: sql<Date | null>`min(${runs.startedAt})`,
    })
    .from(runs)
    .where(
      and(eq(runs.projectId, projectId), since ? gte(runs.startedAt, since) : undefined, scope),
    );

  const { runRetentionDays } = await loadSettings();
  return {
    ...totals,
    from: totals.from ? new Date(totals.from) : null,
    days,
    retentionDays: runRetentionDays,
  };
}

/** Whatever `db.transaction` hands its callback — the same API as `db`, inside the transaction. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Draws a saved board onto a project, in one transaction.
 *
 * The lanes go in first and the arrows second, because a template's arrows are indexes into
 * its own list and half of them point at lanes that do not exist yet — the same two steps
 * `seedLanes` takes, for the same reason. An `agentId` or a `roleId` naming something this
 * server no longer has resolves to none rather than failing: a template is a shape, and the
 * agents and the roles are whoever happens to be here.
 */
async function drawTemplate(tx: Tx, projectId: string, plan: TemplateLane[]) {
  const known = new Set((await tx.select({ id: agents.id }).from(agents)).map((row) => row.id));
  const kinds = new Set((await tx.select({ id: roles.id }).from(roles)).map((row) => row.id));
  const written = await tx
    .insert(lanes)
    .values(
      plan.map((lane, index) => ({
        projectId,
        name: lane.name,
        position: index,
        intake: lane.intake,
        roleId: lane.roleId && kinds.has(lane.roleId) ? lane.roleId : null,
        agentId: lane.agentId && known.has(lane.agentId) ? lane.agentId : null,
        wipLimit: lane.wipLimit,
        // Templates saved before a lane carried its own job have neither key; a lane with no
        // kind is a resting place, and one with nothing to add adds nothing. Nor does one that
        // does not say how many times it will put a card back put one back at all.
        prompt: lane.prompt ?? "",
        maxAttempts: lane.maxAttempts ?? 0,
        archiveOnSuccess: lane.archiveOnSuccess ?? false,
      })),
    )
    .returning();

  const at = (index: number | null) =>
    index === null || index < 0 || index >= written.length ? null : written[index].id;
  for (const [index, lane] of plan.entries()) {
    const onSuccessLaneId = at(lane.onSuccess);
    const onFailureLaneId = at(lane.onFailure);
    if (!onSuccessLaneId && !onFailureLaneId) continue;
    await tx
      .update(lanes)
      .set({ onSuccessLaneId, onFailureLaneId })
      .where(eq(lanes.id, written[index].id));
  }
  return written;
}

const taskOrThrow = async (taskId: string) => {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) {
    throw new GraphQLError(`There is no task with id ${taskId}.`, {
      extensions: { code: "NOT_FOUND" },
    });
  }
  return task;
};

export const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: "Query",
    fields: {
      ...entities.queries,
      models: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString))),
        description:
          "Model ids an OpenAI-compatible server reports. With no `agentId` this asks the " +
          "endpoint in Settings; with one it asks that agent's own endpoint, which is the " +
          "list that agent can actually choose from.",
        args: { agentId: { type: GraphQLString } },
        resolve: (_source, args: { agentId?: string | null }) => listModels(args.agentId),
      },
      blockers: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(generatedType("Card")))),
        description:
          "The cards this one is waiting on that are not finished yet — the reason a card sits " +
          "in a lane its agent never picks it up from. Empty means nothing is in its way. " +
          "Worked out from the cards as they stand every time it is asked, rather than read " +
          "off the card, because the answer changes when some other card finishes and nothing " +
          "would go back to rewrite it. An archived dependency is not in the way: taking one " +
          "off the board is a decision that it does not have to happen.",
        args: { cardId: { type: new GraphQLNonNull(GraphQLString) } },
        resolve: (_source, args: { cardId: string }) => blockers(args.cardId),
      },
      mcpStatus: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(McpServerStatusType))),
        description:
          "Which of the configured MCP servers this one actually reached, and the tools it " +
          "found on each. A server that is enabled but absent here failed to connect, and its " +
          "tools are not offered to any agent linked to it.",
        resolve: () => mcp.state(),
      },
      runEvents: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(RunEventType))),
        description:
          "What a run has said so far, oldest first, with consecutive thinking and output " +
          "tokens folded into one entry each. The snapshot form of the `runEvents` " +
          "subscription, for a client that polls rather than holds a stream open: pass the " +
          "`seq` of the last entry you read as `afterSeq` to pick up exactly where you left " +
          "off. Empty for a run that has not started, or one that finished over a minute ago.",
        args: {
          runId: { type: new GraphQLNonNull(GraphQLString) },
          afterSeq: {
            type: GraphQLInt,
            description: "Only what is numbered above this. Omit for the whole run.",
          },
          limit: {
            type: GraphQLInt,
            description: "At most this many entries, oldest first. Default 200.",
          },
        },
        resolve: (
          _source,
          args: { runId: string; afterSeq?: number | null; limit?: number | null },
        ) =>
          fold(history(args.runId).filter((event) => event.seq > (args.afterSeq ?? 0))).slice(
            0,
            args.limit ?? 200,
          ),
      },
      spend: {
        type: new GraphQLNonNull(SpendType),
        description:
          "What a project has cost in tokens, over a window, added up from its runs. With a " +
          "`taskId` it is that one task instead: its refinement, its decomposition, and every " +
          "run of every card it turned into. Read `from` before quoting the number — it says " +
          "how far back the runs behind it actually go.",
        args: {
          projectId: { type: new GraphQLNonNull(GraphQLString) },
          taskId: {
            type: GraphQLString,
            description: "Narrows the total to one task of that project. Omit for the whole board.",
          },
          days: {
            type: GraphQLInt,
            description: "How far back to count. Default 30. Zero counts every run still kept.",
          },
        },
        resolve: (
          _source,
          args: { projectId: string; taskId?: string | null; days?: number | null },
        ) => spendOver(args.projectId, args.taskId, Math.max(0, args.days ?? 30)),
      },
    },
  }),
  mutation: new GraphQLObjectType({
    name: "Mutation",
    fields: {
      ...entities.mutations,
      refineTask: {
        type: new GraphQLNonNull(generatedType("Run")),
        description:
          "One turn of talking a task into shape: says something to the refining agent and " +
          "resolves once it has answered. The answer is appended to the task's messages and " +
          "the task's title and brief are rewritten from it, so read the task back after this " +
          "to see where the brief has got to. A task can be talked about for as long as you " +
          "like; `makeCard` is what ends the conversation by putting it on the board.",
        args: {
          taskId: { type: new GraphQLNonNull(GraphQLString) },
          message: { type: new GraphQLNonNull(GraphQLString) },
        },
        resolve: (_source, args: { taskId: string; message: string }) =>
          refineTask(args.taskId, args.message),
      },
      makeCard: {
        type: new GraphQLNonNull(generatedType("Card")),
        description:
          "Ends a refining conversation by putting it on the board: writes the task's title " +
          "and brief as one card in the project's intake lane, linked back to the task. It is " +
          "one card and not many — breaking work up is a station on the board now, so a card " +
          "landing in a lane that expands is what turns it into the cards that carry it out. " +
          "The conversation is left exactly where it is and can go on afterwards.",
        args: { taskId: { type: new GraphQLNonNull(GraphQLString) } },
        resolve: async (_source, args: { taskId: string }) => {
          await taskOrThrow(args.taskId);
          return makeCard(args.taskId);
        },
      },
      submitCard: {
        type: new GraphQLNonNull(generatedType("Card")),
        description:
          "The way onto a board for a caller that has no lane ids: writes one card at the " +
          "project's front door — the lane marked `intake`, else the leftmost — and answers " +
          "with it. Use this rather than `create_card` unless you know exactly which lane you " +
          "mean. If that lane is a station that expands, the card becomes the cards that carry " +
          "the work out as soon as it is worked.",
        args: {
          projectId: { type: new GraphQLNonNull(GraphQLString) },
          title: { type: new GraphQLNonNull(GraphQLString) },
          body: {
            type: new GraphQLNonNull(GraphQLString),
            description: "What is wanted, in as much detail as you have. An agent reads it.",
          },
        },
        resolve: (_source, args: { projectId: string; title: string; body: string }) =>
          submitCard(args.projectId, args.title, args.body),
      },
      runCard: {
        type: new GraphQLNonNull(generatedType("Run")),
        description:
          "Works one card now, with its lane's agent unless `agentId` names another, and " +
          "resolves with the finished run — a long call for a long card. Read `runEvents` " +
          "meanwhile to watch it, or `stopCard` to call it off. The card moves on afterwards " +
          "exactly as it would have under `autoRun`, following its lane's success and failure " +
          "arrows. Refused for a card waiting on unfinished dependencies.",
        args: {
          cardId: { type: new GraphQLNonNull(GraphQLString) },
          agentId: { type: GraphQLString },
        },
        resolve: (_source, args: { cardId: string; agentId?: string | null }) =>
          runCard(args.cardId, args.agentId),
      },
      stopCard: {
        type: new GraphQLNonNull(GraphQLBoolean),
        description:
          "Calls off the agent working a card. False means none was — a stale button, not a " +
          "failure. The run is recorded as `stopped` and the card goes back to `idle` where it " +
          "is, rather than moving on.",
        args: { cardId: { type: new GraphQLNonNull(GraphQLString) } },
        resolve: (_source, args: { cardId: string }) => stopSubject(args.cardId),
      },
      stopTask: {
        type: new GraphQLNonNull(GraphQLBoolean),
        description: "Calls off a refinement in flight. False means none was running.",
        args: { taskId: { type: new GraphQLNonNull(GraphQLString) } },
        resolve: (_source, args: { taskId: string }) => stopSubject(args.taskId),
      },
      moveCard: {
        type: new GraphQLNonNull(generatedType("Card")),
        description:
          "Puts a card in a lane, at a position, and renumbers the cards around it so the " +
          "board stays in the order it looks like. Omit `position` to drop it at the end. " +
          "A card that had failed comes back to `idle` with its attempts forgiven, which is " +
          "what makes dragging one back a retry; a card an agent is working cannot be moved " +
          "out from under it, and nor can an archived one — `restoreCard` is what puts that " +
          "back on the board. Say why in `note` and the agent that picks the card up is told " +
          "it, the same way a reviewer's rejection reaches one: moving a card back without " +
          "saying what was wrong with it buys a second attempt identical to the first.",
        args: {
          cardId: { type: new GraphQLNonNull(GraphQLString) },
          laneId: { type: new GraphQLNonNull(GraphQLString) },
          position: { type: GraphQLInt },
          note: { type: GraphQLString },
        },
        resolve: async (
          _source,
          args: { cardId: string; laneId: string; position?: number | null; note?: string | null },
        ) => {
          if (isRunning(args.cardId)) {
            throw new GraphQLError("An agent is working this card. Stop it first, then move it.", {
              extensions: { code: "RUN_IN_FLIGHT" },
            });
          }
          const card = await cardOrThrow(args.cardId);
          // Moving one would renumber a whole lane around a card nobody can see.
          if (card.archivedAt) {
            throw new GraphQLError("This card is archived. Restore it before moving it.", {
              extensions: { code: "ARCHIVED" },
            });
          }
          const [lane] = await db.select().from(lanes).where(eq(lanes.id, args.laneId)).limit(1);
          if (!lane || lane.projectId !== card.projectId) {
            throw new GraphQLError("That lane is not on this card's board.", {
              extensions: { code: "BAD_LANE" },
            });
          }

          const others = await db
            .select({ id: cards.id })
            .from(cards)
            .where(eq(cards.laneId, args.laneId))
            .orderBy(asc(cards.position));
          const order = others.map((row) => row.id).filter((id) => id !== card.id);
          const at = Math.max(0, Math.min(args.position ?? order.length, order.length));
          order.splice(at, 0, card.id);

          await db.transaction(async (tx) => {
            for (const [position, id] of order.entries()) {
              await tx
                .update(cards)
                .set({
                  position,
                  ...(id === card.id
                    ? {
                        laneId: args.laneId,
                        status: card.status === "done" ? "done" : ("idle" as const),
                        error: "",
                        // Somebody moving a card by hand is somebody starting it over, so the
                        // rework budget its next station spends is a fresh one.
                        attempts: 0,
                      }
                    : {}),
                })
                .where(eq(cards.id, id));
            }
            await recordMove(
              {
                cardId: card.id,
                fromLaneId: card.laneId,
                toLaneId: args.laneId,
                note: args.note ?? "",
                actor: "user",
              },
              tx,
            );
          });

          const [moved] = await db.select().from(cards).where(eq(cards.id, card.id)).limit(1);
          return moved;
        },
      },
      retryCard: {
        type: new GraphQLNonNull(generatedType("Card")),
        description:
          "Puts a card back in play where it stands: clears its error, empties the count of " +
          "failed attempts against it, and returns it to `idle`, which is the status a lane's " +
          "agent will pick up. This is the way back for a card that stopped at `error` — one " +
          "a reviewer rejected once its lane had no attempts left to spend, or one whose lane " +
          "spends none. It does not run anything itself; `runCard` does that, and `autoRun` " +
          "does it unasked. Refused while an agent is working the card, and on an archived " +
          "one — `restoreCard` puts that back on the board first.",
        args: { cardId: { type: new GraphQLNonNull(GraphQLString) } },
        resolve: async (_source, args: { cardId: string }) => {
          if (isRunning(args.cardId)) {
            throw new GraphQLError("An agent is working this card already.", {
              extensions: { code: "RUN_IN_FLIGHT" },
            });
          }
          const card = await cardOrThrow(args.cardId);
          // Clearing the error of a card nobody can see is a change with no visible cause, and
          // it would let one come back from the archive as something other than what went in.
          if (card.archivedAt) {
            throw new GraphQLError("This card is archived. Restore it before retrying it.", {
              extensions: { code: "ARCHIVED" },
            });
          }
          const [retried] = await db
            .update(cards)
            .set({ status: "idle", error: "", attempts: 0 })
            .where(eq(cards.id, card.id))
            .returning();
          // Recorded rather than tidied away: putting a card back in play is a thing a person
          // did to it, and the ledger is the account of what has been done to it. The note is
          // left empty on purpose, so the reason the card came back is still the last one
          // given — a retry is trying again knowing that, not forgetting it.
          await recordMove({
            cardId: card.id,
            fromLaneId: card.laneId,
            toLaneId: card.laneId,
            actor: "user",
          });
          return retried;
        },
      },
      archiveCard: {
        type: new GraphQLNonNull(generatedType("Card")),
        description:
          "Takes a card off the board without deleting it. It stops being drawn in its lane, " +
          "stops being picked up by that lane's agent, and stops counting as something other " +
          "cards are waiting on — but it keeps its lane, its status and everything said " +
          "about it, and `restoreCard` puts it back. This is what a Done pile is for once it " +
          "is long enough to be in the way. Read the archive with `cards(where: { archivedAt: { isNotNull: " +
          "true } })`. Refused while an agent is working the card; archiving one already " +
          "archived leaves the time it was archived alone.",
        args: { cardId: { type: new GraphQLNonNull(GraphQLString) } },
        resolve: async (_source, args: { cardId: string }) => {
          if (isRunning(args.cardId)) {
            throw new GraphQLError(
              "An agent is working this card. Stop it first, then archive it.",
              { extensions: { code: "RUN_IN_FLIGHT" } },
            );
          }
          const card = await cardOrThrow(args.cardId);
          if (card.archivedAt) return card;
          const [archived] = await db
            .update(cards)
            .set({ archivedAt: new Date() })
            .where(eq(cards.id, card.id))
            .returning();
          // No `to`: the archive is not a lane. The card keeps its `laneId` all the same, which
          // is where restoring puts it back.
          await recordMove({ cardId: card.id, fromLaneId: card.laneId, actor: "user" });
          return archived;
        },
      },
      restoreCard: {
        type: new GraphQLNonNull(generatedType("Card")),
        description:
          "Puts an archived card back on the board, at the end of the lane it was archived " +
          "from. Its status is left as it was found — a card archived as `error` comes back " +
          "as one, and `retryCard` is still the way to put that back in play — because what " +
          "the card was is the reason someone archived it. The end of the lane rather than " +
          "its old position, which the cards added since have long taken.",
        args: { cardId: { type: new GraphQLNonNull(GraphQLString) } },
        resolve: async (_source, args: { cardId: string }) => {
          const card = await cardOrThrow(args.cardId);
          if (!card.archivedAt) return card;
          const [last] = await db
            .select({ position: cards.position })
            .from(cards)
            .where(and(eq(cards.laneId, card.laneId), isNull(cards.archivedAt)))
            .orderBy(desc(cards.position))
            .limit(1);
          const [restored] = await db
            .update(cards)
            .set({ archivedAt: null, position: (last?.position ?? -1) + 1 })
            .where(eq(cards.id, card.id))
            .returning();
          await recordMove({ cardId: card.id, toLaneId: card.laneId, actor: "user" });
          return restored;
        },
      },
      addCardNote: {
        type: new GraphQLNonNull(generatedType("CardNote")),
        description:
          "Writes a note on a card. Everything ever said about a card is a note — the report " +
          "an agent leaves when it has worked one, the verdict a reviewing station rules, and " +
          "this, a standing note somebody wants taken into account. Every note on the card is " +
          'handed to the next agent that works it, under "Notes on this card", so this is ' +
          "how you tell one something the card's body does not say without editing the card " +
          "out from under whoever wrote it. Reports and verdicts are written by the runner " +
          "and cannot be written here: a note says who wrote it, and that has to be true. " +
          'Read them with `card_notes(where: { cardId: { eq: "…" } })`.',
        args: {
          cardId: { type: new GraphQLNonNull(GraphQLString) },
          body: { type: new GraphQLNonNull(GraphQLString) },
        },
        resolve: async (_source, args: { cardId: string; body: string }) => {
          await cardOrThrow(args.cardId);
          const note = await addNote({ cardId: args.cardId, kind: "note", body: args.body });
          if (!note) {
            throw new GraphQLError("A note with nothing in it says nothing.", {
              extensions: { code: "EMPTY_NOTE" },
            });
          }
          return note;
        },
      },
      updateCardNote: {
        type: new GraphQLNonNull(generatedType("CardNote")),
        description:
          "Rewrites a note. Only a note somebody wrote: an agent's report and a reviewer's " +
          "verdict are an account of what happened, and an account that can be corrected " +
          "afterwards is worth no more than no account at all.",
        args: {
          id: { type: new GraphQLNonNull(GraphQLString) },
          body: { type: new GraphQLNonNull(GraphQLString) },
        },
        resolve: async (_source, args: { id: string; body: string }) => {
          const note = await noteOrThrow(args.id);
          const body = args.body.trim();
          if (!body) {
            throw new GraphQLError("A note with nothing in it says nothing.", {
              extensions: { code: "EMPTY_NOTE" },
            });
          }
          const [updated] = await db
            .update(cardNotes)
            .set({ body, updatedAt: new Date() })
            .where(eq(cardNotes.id, note.id))
            .returning();
          return updated;
        },
      },
      deleteCardNote: {
        type: new GraphQLNonNull(GraphQLBoolean),
        description:
          "Takes a note back, so the next agent working the card stops being told it. Only a " +
          "note somebody wrote, for the same reason `updateCardNote` is. A verdict that " +
          "explained a move stays readable through that move in `card_events`.",
        args: { id: { type: new GraphQLNonNull(GraphQLString) } },
        resolve: async (_source, args: { id: string }) => {
          const note = await noteOrThrow(args.id);
          await db.delete(cardNotes).where(eq(cardNotes.id, note.id));
          return true;
        },
      },
      setCardDeps: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString))),
        description:
          "Replaces what a card waits on, and answers with it. A card with unfinished " +
          "dependencies is skipped rather than run out of order, so this is how a " +
          "decomposition that got the order wrong is corrected. Written as a set rather than " +
          "a row at a time, because half an ordering is not an ordering. Every id has to be a " +
          "card on the same board, and a cycle is refused — cards that wait on each other " +
          "would never run, and nothing downstream would say why.",
        args: {
          cardId: { type: new GraphQLNonNull(GraphQLString) },
          dependsOn: {
            type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString))),
          },
        },
        resolve: async (_source, args: { cardId: string; dependsOn: string[] }) => {
          const wanted = [...new Set(args.dependsOn)];
          const card = await cardOrThrow(args.cardId);
          if (wanted.includes(card.id)) {
            throw new GraphQLError("A card cannot wait on itself.", {
              extensions: { code: "CYCLE" },
            });
          }

          // Same board, and all of them: a dependency on a card from another project is a
          // wait that nothing on this board will ever satisfy.
          const found = wanted.length
            ? await db
                .select({ id: cards.id })
                .from(cards)
                .where(and(inArray(cards.id, wanted), eq(cards.projectId, card.projectId)))
            : [];
          const here = new Set(found.map((row) => row.id));
          const strangers = wanted.filter((id) => !here.has(id));
          if (strangers.length) {
            throw new GraphQLError(
              `Not cards on this board: ${strangers.join(", ")}. A card can only wait on one beside it.`,
              { extensions: { code: "BAD_CARD" } },
            );
          }

          const cycle = await wouldCycle(card.id, wanted, card.projectId);
          if (cycle) {
            throw new GraphQLError(
              `That would make a cycle: ${cycle.join(" → ")}. Cards that wait on each other never run.`,
              { extensions: { code: "CYCLE" } },
            );
          }

          await db.transaction(async (tx) => {
            await tx.delete(cardDeps).where(eq(cardDeps.cardId, card.id));
            if (wanted.length) {
              await tx
                .insert(cardDeps)
                .values(wanted.map((dependsOnCardId) => ({ cardId: card.id, dependsOnCardId })));
            }
          });
          return wanted;
        },
      },
      saveBoardTemplate: {
        type: new GraphQLNonNull(generatedType("BoardTemplate")),
        description:
          "Keeps a project's board — its lanes, their agents, their WIP limits and the arrows " +
          "between them — under a name, so the next project can start with it instead of it " +
          "being drawn again. Saving under a name that already exists replaces it. The cards " +
          "are not part of it: a template is the shape of a board, not its contents.",
        args: {
          projectId: { type: new GraphQLNonNull(GraphQLString) },
          name: { type: new GraphQLNonNull(GraphQLString) },
          description: { type: GraphQLString },
        },
        resolve: async (
          _source,
          args: { projectId: string; name: string; description?: string | null },
        ) => {
          const name = args.name.trim();
          if (!name) {
            throw new GraphQLError("A template needs a name to be found by later.", {
              extensions: { code: "BAD_NAME" },
            });
          }
          const drawn = await db
            .select()
            .from(lanes)
            .where(eq(lanes.projectId, args.projectId))
            .orderBy(asc(lanes.position));
          if (!drawn.length) {
            throw new GraphQLError("That project has no lanes to save.", {
              extensions: { code: "NOT_FOUND" },
            });
          }
          // Ids become indexes here, which is what makes the saved board portable.
          const index = new Map(drawn.map((lane, position) => [lane.id, position]));
          const plan: TemplateLane[] = drawn.map((lane, position) => ({
            name: lane.name,
            position,
            intake: lane.intake,
            roleId: lane.roleId,
            prompt: lane.prompt,
            agentId: lane.agentId,
            wipLimit: lane.wipLimit,
            maxAttempts: lane.maxAttempts,
            onSuccess: index.get(lane.onSuccessLaneId ?? "") ?? null,
            onFailure: index.get(lane.onFailureLaneId ?? "") ?? null,
            archiveOnSuccess: lane.archiveOnSuccess,
          }));

          const values = { name, description: args.description ?? "", lanes: plan };
          const [saved] = await db
            .insert(boardTemplates)
            .values(values)
            .onConflictDoUpdate({ target: boardTemplates.name, set: values })
            .returning();
          return saved;
        },
      },
      applyBoardTemplate: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(generatedType("Lane")))),
        description:
          "Redraws a project's board from a saved template, and answers with the lanes it " +
          "wrote. Refused once the board has cards on it, archived ones included: replacing " +
          "lanes takes their cards with them, so this is for a project that has not started " +
          "rather than a way to rearrange one that has.",
        args: {
          projectId: { type: new GraphQLNonNull(GraphQLString) },
          templateId: { type: new GraphQLNonNull(GraphQLString) },
        },
        resolve: async (_source, args: { projectId: string; templateId: string }) => {
          const [template] = await db
            .select()
            .from(boardTemplates)
            .where(eq(boardTemplates.id, args.templateId))
            .limit(1);
          if (!template) {
            throw new GraphQLError(`There is no template with id ${args.templateId}.`, {
              extensions: { code: "NOT_FOUND" },
            });
          }
          const held = await db
            .select({ id: cards.id })
            .from(cards)
            .where(eq(cards.projectId, args.projectId))
            .limit(1);
          if (held.length) {
            throw new GraphQLError(
              "That board has cards on it — archived ones included, which are not drawn " +
                "anywhere. Applying a template replaces its lanes, and a lane takes its cards " +
                "with it.",
              { extensions: { code: "HAS_CARDS" } },
            );
          }
          return db.transaction(async (tx) => {
            await tx.delete(lanes).where(eq(lanes.projectId, args.projectId));
            return drawTemplate(tx, args.projectId, template.lanes);
          });
        },
      },
      setAgentServers: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString))),
        description:
          "Replaces the set of MCP servers an agent may reach, and answers with it. Written as " +
          "a set rather than a row at a time because that is how it is decided — an agent's " +
          "tools are the whole of what it can do, and half-applied is a different agent.",
        args: {
          agentId: { type: new GraphQLNonNull(GraphQLString) },
          serverIds: {
            type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString))),
          },
        },
        resolve: async (_source, args: { agentId: string; serverIds: string[] }) => {
          const wanted = [...new Set(args.serverIds)];
          await db.transaction(async (tx) => {
            await tx.delete(agentServers).where(eq(agentServers.agentId, args.agentId));
            if (wanted.length) {
              await tx
                .insert(agentServers)
                .values(wanted.map((serverId) => ({ agentId: args.agentId, serverId })));
            }
          });
          return wanted;
        },
      },
      testMcpServer: {
        type: new GraphQLNonNull(McpProbeType),
        description:
          "Connects to a config that need not be saved yet and lists its tools, so a server " +
          "can be checked before an agent depends on it.",
        args: { config: { type: new GraphQLNonNull(McpConnectionInput) } },
        resolve: (_source, args: { config: Partial<McpConnection> }) =>
          probe({
            transport: args.config.transport === "http" ? "http" : "stdio",
            command: args.config.command ?? "",
            args: args.config.args ?? null,
            env: args.config.env ?? null,
            url: args.config.url ?? "",
            headers: args.config.headers ?? null,
          }),
      },
      reconnectMcp: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(McpServerStatusType))),
        description: "Tears down and rebuilds every MCP connection.",
        resolve: async () => {
          await mcp.shutdown();
          await mcp.sync();
          return mcp.state();
        },
      },
      setApiKey: {
        type: new GraphQLNonNull(GraphQLBoolean),
        description:
          "Writes the shared API key. Separate from updateSetting because the key is " +
          "write-only: it is excluded from the Setting type so it can never be read back out.",
        args: { apiKey: { type: new GraphQLNonNull(GraphQLString) } },
        resolve: async (_source, args: { apiKey: string }) => {
          await db.update(settings).set({ apiKey: args.apiKey }).where(eq(settings.id, "default"));
          return true;
        },
      },
      setAgentApiKey: {
        type: new GraphQLNonNull(GraphQLBoolean),
        description:
          "Writes one agent's own API key, for an agent pointed at an endpoint of its own. " +
          "Write-only, like the shared one. Send an empty string to clear it — an agent with " +
          "no key of its own borrows the shared one only while it is also on the shared " +
          "endpoint.",
        args: {
          agentId: { type: new GraphQLNonNull(GraphQLString) },
          apiKey: { type: new GraphQLNonNull(GraphQLString) },
        },
        resolve: async (_source, args: { agentId: string; apiKey: string }) => {
          await db.update(agents).set({ apiKey: args.apiKey }).where(eq(agents.id, args.agentId));
          return true;
        },
      },
    },
  }),
  subscription: new GraphQLObjectType({
    name: "Subscription",
    fields: {
      runEvents: {
        type: new GraphQLNonNull(RunEventType),
        description:
          "Watches a run as it happens. Replays what the run has said so far, then follows it " +
          "live, and completes when the run ends. Subscribing to a run that has not started " +
          "waits for it; subscribing to one long finished ends straight away.",
        args: { runId: { type: new GraphQLNonNull(GraphQLString) } },
        subscribe: (_source, args: { runId: string }) => watch(args.runId),
        resolve: (event: RunEvent) => event,
      },
    },
  }),
  types: [...Object.values(entities.types), ...Object.values(entities.inputs)],
});
