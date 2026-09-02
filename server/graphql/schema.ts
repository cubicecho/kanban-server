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
import { errorMessage } from "../../shared/errors.ts";
import { db } from "../db/client.ts";
import {
  agentServers,
  agents,
  boardTemplates,
  cardDeps,
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
import { EXECUTOR_ROLE, REVIEWER_ROLE } from "../runner/prompts.ts";
import {
  decomposeTask,
  isRunning,
  refineTask,
  runCard,
  runningRunIds,
  runningSubjectIds,
  stopSubject,
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
    insert: (table) => table !== "runs" && table !== "settings" && table !== "boardTemplates",
    update: (table) => table !== "runs" && table !== "boardTemplates",
    delete: (table) => table !== "settings",
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
            "This task is being refined or decomposed. Stop it first, then delete it.",
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
 * The board a new project starts with: a backlog, an agent that works cards, an agent that
 * checks the work, and somewhere finished cards go.
 *
 * The lanes are the pipeline — `onSuccessLaneId` and `onFailureLaneId` are the arrows between
 * them — so this is a working board rather than four empty columns. Nothing runs until the
 * project is switched to `autoRun`, or someone presses the button on a card.
 *
 * Review sends a card it failed back to Doing rather than round again: the card arrives with
 * its status set to `error`, which the worker will not pick up, so a rejected card waits for a
 * person instead of looping between two agents at whatever a token costs.
 *
 * The agents are looked up by their role's name rather than created, so a project made on a
 * server whose agents have been renamed or replaced gets that server's agents. Finding none is
 * not an error: the lanes are still drawn, and the board runs as soon as an agent is named on
 * one. Review is the lane that reads its agent's answer as a verdict — a fresh board is the one
 * place that is decided for somebody, and the lane dialog is where it is changed.
 */
async function seedLanes(tx: typeof db, rows: Project[]) {
  if (!rows.length) return;
  const roleAgent = async (roleName: string) => {
    const found = await tx
      .select({ id: agents.id })
      .from(agents)
      .innerJoin(roles, eq(agents.roleId, roles.id))
      .where(and(eq(roles.name, roleName), eq(agents.enabled, true)))
      .orderBy(asc(agents.name))
      .limit(1);
    return found[0]?.id ?? null;
  };
  const executor = await roleAgent(EXECUTOR_ROLE);
  const reviewer = await roleAgent(REVIEWER_ROLE);

  for (const project of rows) {
    if (!project?.id) continue;
    const [, doing, review, done] = await tx
      .insert(lanes)
      .values([
        { projectId: project.id, name: "Backlog", position: 0, intake: true },
        { projectId: project.id, name: "Doing", position: 1, agentId: executor },
        {
          projectId: project.id,
          name: "Review",
          position: 2,
          agentId: reviewer,
          readVerdict: true,
        },
        { projectId: project.id, name: "Done", position: 3 },
      ])
      .returning();
    // Written second because two of the three arrows point at lanes that did not exist yet.
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
 * `seedLanes` takes, for the same reason. An `agentId` naming an agent this server no longer
 * has resolves to none rather than failing: a template is a shape, and the agents are whoever
 * happens to be here.
 */
async function drawTemplate(tx: Tx, projectId: string, plan: TemplateLane[]) {
  const known = new Set((await tx.select({ id: agents.id }).from(agents)).map((row) => row.id));
  const written = await tx
    .insert(lanes)
    .values(
      plan.map((lane, index) => ({
        projectId,
        name: lane.name,
        position: index,
        intake: lane.intake,
        agentId: lane.agentId && known.has(lane.agentId) ? lane.agentId : null,
        wipLimit: lane.wipLimit,
        // Templates saved before stations could judge cards have no such key; a lane that does
        // not say it reads a verdict does not read one, and one that does not say how many
        // times it will put a card back does not put one back at all.
        readVerdict: lane.readVerdict ?? false,
        maxAttempts: lane.maxAttempts ?? 0,
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
          "to see where the brief has got to. Only a `draft` task can be refined.",
        args: {
          taskId: { type: new GraphQLNonNull(GraphQLString) },
          message: { type: new GraphQLNonNull(GraphQLString) },
        },
        resolve: (_source, args: { taskId: string; message: string }) =>
          refineTask(args.taskId, args.message),
      },
      acceptTask: {
        type: new GraphQLNonNull(generatedType("Task")),
        description:
          "Marks a refined task ready for the decomposer, without running it. `decomposeTask` " +
          "is the next step, and is what actually produces cards.",
        args: { taskId: { type: new GraphQLNonNull(GraphQLString) } },
        resolve: async (_source, args: { taskId: string }) => {
          const task = await taskOrThrow(args.taskId);
          if (!task.brief.trim()) {
            throw new GraphQLError("This task has no brief yet — there is nothing to accept.", {
              extensions: { code: "BAD_TASK" },
            });
          }
          const [updated] = await db
            .update(tasks)
            .set({ status: "ready", error: "" })
            .where(eq(tasks.id, task.id))
            .returning();
          return updated;
        },
      },
      decomposeTask: {
        type: new GraphQLNonNull(generatedType("Run")),
        description:
          "Breaks a task into cards and puts them in the project's intake lane, resolving with " +
          "the finished run — which means it does not answer until the decomposer is done. " +
          "The cards it wrote are the ones with this `taskId`. A decomposition that produced " +
          "nothing readable fails, and says so on the task as well as in the run.",
        args: { taskId: { type: new GraphQLNonNull(GraphQLString) } },
        resolve: (_source, args: { taskId: string }) => decomposeTask(args.taskId),
      },
      submitTask: {
        type: new GraphQLNonNull(generatedType("Task")),
        description:
          "The short way in, for a caller that already knows what it wants: writes the task and " +
          "decomposes it in one call, resolving with the task once its cards are on the board. " +
          "Skips refinement entirely. A decomposition that fails leaves the task in `error` " +
          "with the reason on it rather than throwing, so the task is still there to retry.",
        args: {
          projectId: { type: new GraphQLNonNull(GraphQLString) },
          title: { type: new GraphQLNonNull(GraphQLString) },
          brief: {
            type: new GraphQLNonNull(GraphQLString),
            description: "What is wanted, in as much detail as you have. The decomposer reads it.",
          },
        },
        resolve: async (_source, args: { projectId: string; title: string; brief: string }) => {
          const [task] = await db
            .insert(tasks)
            .values({
              projectId: args.projectId,
              title: args.title,
              brief: args.brief,
              status: "ready",
            })
            .returning();
          // The task is kept whatever happens next. A decomposition that cannot even start —
          // no decomposer defined, an endpoint that will not answer — is written onto the task
          // rather than thrown, so the caller is left with something to look at and retry.
          await decomposeTask(task.id).catch(async (error: unknown) => {
            await db
              .update(tasks)
              .set({ status: "error", error: errorMessage(error) })
              .where(eq(tasks.id, task.id));
          });
          return taskOrThrow(task.id);
        },
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
        description:
          "Calls off a refinement or decomposition in flight. False means none was running.",
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
          "back on the board.",
        args: {
          cardId: { type: new GraphQLNonNull(GraphQLString) },
          laneId: { type: new GraphQLNonNull(GraphQLString) },
          position: { type: GraphQLInt },
        },
        resolve: async (
          _source,
          args: { cardId: string; laneId: string; position?: number | null },
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
          return retried;
        },
      },
      archiveCard: {
        type: new GraphQLNonNull(generatedType("Card")),
        description:
          "Takes a card off the board without deleting it. It stops being drawn in its lane, " +
          "stops being picked up by that lane's agent, and stops counting as something other " +
          "cards are waiting on — but it keeps its lane, its status and its result, and " +
          "`restoreCard` puts it back. This is what a Done pile is for once it is long enough " +
          "to be in the way. Read the archive with `cards(where: { archivedAt: { isNotNull: " +
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
          return restored;
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
            agentId: lane.agentId,
            wipLimit: lane.wipLimit,
            readVerdict: lane.readVerdict,
            maxAttempts: lane.maxAttempts,
            onSuccess: index.get(lane.onSuccessLaneId ?? "") ?? null,
            onFailure: index.get(lane.onFailureLaneId ?? "") ?? null,
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
