import { buildSchema, GraphQLDateTime } from "@vantreeseba/drizzle-graphql";
import { and, asc, eq } from "drizzle-orm";
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
import { agentServers, agents, cards, lanes, type Project, settings, tasks } from "../db/schema.ts";
import { fold, history, type RunEvent, watch } from "../runner/events.ts";
import { listModels } from "../runner/llm.ts";
import { type McpConnection, mcp, probe } from "../runner/mcp.ts";
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
    // an agent did something it did not. Settings is a singleton the migration creates.
    insert: (table) => table !== "runs" && table !== "settings",
    update: (table) => table !== "runs",
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
 * The agents are looked up by role rather than created, so a project made on a server whose
 * agents have been renamed or replaced gets that server's agents. Finding none is not an
 * error: the lanes are still drawn, and the board runs as soon as an agent is named on one.
 */
async function seedLanes(tx: typeof db, rows: Project[]) {
  if (!rows.length) return;
  const roleAgent = async (role: "execute" | "review") => {
    const found = await tx
      .select({ id: agents.id })
      .from(agents)
      .where(and(eq(agents.role, role), eq(agents.enabled, true)))
      .orderBy(asc(agents.name))
      .limit(1);
    return found[0]?.id ?? null;
  };
  const executor = await roleAgent("execute");
  const reviewer = await roleAgent("review");

  for (const project of rows) {
    if (!project?.id) continue;
    const [, doing, review, done] = await tx
      .insert(lanes)
      .values([
        { projectId: project.id, name: "Backlog", position: 0, intake: true },
        { projectId: project.id, name: "Doing", position: 1, agentId: executor },
        { projectId: project.id, name: "Review", position: 2, agentId: reviewer },
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
 * Refuses a delete that would pull the ground out from under something in flight — a card an
 * agent is working, or the very run row the runner is about to write the outcome to. Stop it
 * first; a stopped one deletes like any other.
 *
 * Only the `id.eq` filter the UI sends is read. A filter this cannot resolve is refused
 * outright while anything is running: a rare, recoverable no rather than a wrong yes. Throwing
 * here rolls the mutation back before it writes.
 */
function refuseWhileRunning(args: unknown, running: Set<string>, message: string) {
  if (running.size === 0) return;
  const where = (args as { where?: { id?: { eq?: unknown } } } | undefined)?.where;
  const id = typeof where?.id?.eq === "string" ? where.id.eq : undefined;
  if (id !== undefined && !running.has(id)) return;
  // A plain Error would reach the client as "Internal server error" — the library only lets a
  // GraphQLError of its own through. This one is the client's to act on, so it says why.
  throw new GraphQLError(message, { extensions: { code: "RUN_IN_FLIGHT" } });
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
          "A card that had failed comes back to `idle`, which is what makes dragging one back " +
          "a retry; a card an agent is working cannot be moved out from under it.",
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
          const [card] = await db.select().from(cards).where(eq(cards.id, args.cardId)).limit(1);
          if (!card) {
            throw new GraphQLError(`There is no card with id ${args.cardId}.`, {
              extensions: { code: "NOT_FOUND" },
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
