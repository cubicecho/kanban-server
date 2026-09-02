import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { errorMessage } from "../../shared/errors.ts";
import { db } from "../db/client.ts";
import {
  type Card,
  cardDeps,
  cards,
  lanes,
  messages,
  projects,
  type Run,
  runs,
  tasks,
} from "../db/schema.ts";
import { type AgentResult, runAgent } from "./agent.ts";
import { emit } from "./events.ts";
import { type Resolved, resolveAgentId, resolveStage } from "./llm.ts";
import {
  cardPrompt,
  DECOMPOSE_SYSTEM,
  type DecomposedCard,
  decomposePrompt,
  projectContext,
  REFINE_SYSTEM,
} from "./prompts.ts";
import { parseJson } from "./side-task.ts";

/**
 * What is running right now, keyed by the thing it is running *on* — a card id, or a task id
 * for a refinement or a decomposition.
 *
 * Keying by subject rather than by run is what stops the same card being worked twice at once:
 * the worker polls, a person presses the button, and both arrive within a second of each other.
 * It is also the only handle on a run once it has started — the loop is inside `runAgent` and
 * nothing else can reach it.
 */
const inFlight = new Map<string, { runId: string; controller: AbortController }>();

/** Cards and tasks with something running on them. Neither can be deleted while it is one. */
export const runningSubjectIds = () => new Set(inFlight.keys());

/** Run ids in flight. Deleting one would leave `finish` with no row to write the outcome to. */
export const runningRunIds = () => new Set([...inFlight.values()].map((entry) => entry.runId));

export const isRunning = (subjectId: string) => inFlight.has(subjectId);

/**
 * Calls off whatever is running on a card or task. Returns false if nothing was — which is the
 * honest answer to a stale button, not an error.
 *
 * The request in flight is aborted at once; a tool call already handed to an MCP server has to
 * come back on its own, and the loop stops on the iteration after.
 */
export function stopSubject(subjectId: string): boolean {
  const entry = inFlight.get(subjectId);
  if (!entry) return false;
  entry.controller.abort();
  return true;
}

interface ExecuteOptions {
  /** The card or task this is being done to. One run per subject at a time. */
  subjectId: string;
  projectId: string;
  agent: Resolved;
  kind: Run["kind"];
  taskId?: string | null;
  cardId?: string | null;
  laneId?: string | null;
  prompt: string;
  /** Overrides the agent's own system prompt, where the caller has more to say. */
  systemPrompt?: string;
  /** What to call this in the log and the first event. */
  label: string;
}

/**
 * One agent, one prompt, one row in `runs`.
 *
 * The row is written *before* the agent starts, so something running right now is visible
 * rather than appearing only once it finishes — which for an agent that hangs is never. It is
 * then updated in place with the outcome.
 *
 * The `AgentResult` comes back alongside the run because the callers all need the text for
 * something other than display: cards to parse, a brief to store, a verdict to read.
 */
async function execute(
  options: ExecuteOptions,
): Promise<{ run: Run; result?: AgentResult; ok: boolean }> {
  const { subjectId, agent, label } = options;
  if (inFlight.has(subjectId)) throw new Error(`${label} is already running`);

  const [run] = await db
    .insert(runs)
    .values({
      projectId: options.projectId,
      agentId: agent.agentId,
      kind: options.kind,
      taskId: options.taskId ?? null,
      cardId: options.cardId ?? null,
      laneId: options.laneId ?? null,
      status: "running",
    })
    .returning();

  const controller = new AbortController();
  inFlight.set(subjectId, { runId: run.id, controller });
  // Everything the run says as it goes, for anyone watching it — see `runner/events.ts`.
  const onEvent = (event: Parameters<typeof emit>[1]) => emit(run.id, event);
  onEvent({ kind: "notice", text: `${agent.name}: ${label}` });

  try {
    const result = await runAgent({
      config: agent,
      systemPrompt: options.systemPrompt,
      prompt: options.prompt,
      signal: controller.signal,
      onEvent,
    });
    onEvent({ kind: "done", ok: true, text: "finished" });
    return {
      run: await finish(run.id, {
        status: "ok",
        output: result.output,
        toolCalls: result.toolCalls,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.totalTokens,
      }),
      result,
      ok: true,
    };
  } catch (error) {
    // A stopped run is not a failed one: it did what was asked of it, which was to stop.
    if (controller.signal.aborted) {
      onEvent({ kind: "done", ok: false, text: "stopped" });
      return { run: await finish(run.id, { status: "stopped" }), ok: false };
    }
    const message = errorMessage(error);
    console.error(`[run] ${label}: ${message}`);
    onEvent({ kind: "done", ok: false, text: message });
    return { run: await finish(run.id, { status: "error", error: message }), ok: false };
  } finally {
    inFlight.delete(subjectId);
  }
}

async function finish(runId: string, patch: Partial<Run>): Promise<Run> {
  const [updated] = await db
    .update(runs)
    .set({ ...patch, finishedAt: new Date() })
    .where(eq(runs.id, runId))
    .returning();
  return updated;
}

const loadProject = async (projectId: string) => {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) throw new Error(`no project with id ${projectId}`);
  return project;
};

const loadTask = async (taskId: string) => {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) throw new Error(`no task with id ${taskId}`);
  return task;
};

const loadCard = async (cardId: string) => {
  const [card] = await db.select().from(cards).where(eq(cards.id, cardId)).limit(1);
  if (!card) throw new Error(`no card with id ${cardId}`);
  return card;
};

/** What the refine agent is asked to send back, and what the caller does with each field. */
interface RefineReply {
  reply?: string;
  title?: string;
  brief?: string;
}

/**
 * One turn of refining a task: the person says something, the agent answers, and the brief is
 * rewritten.
 *
 * The whole thread is sent each time rather than kept as a session — a refinement is a handful
 * of short turns, and holding conversation state across HTTP requests would buy nothing and
 * cost a reconnection story.
 *
 * A reply that is not the JSON asked for is kept as prose rather than failing the turn: the
 * person still gets an answer, and the brief simply does not move this turn.
 */
export async function refineTask(taskId: string, userMessage: string): Promise<Run> {
  const task = await loadTask(taskId);
  if (task.status !== "draft") throw new Error("this task has been accepted; it is past refining");
  const project = await loadProject(task.projectId);
  const agent = await resolveStage("refine", project.refineAgentId);

  await db.insert(messages).values({ taskId, role: "user", content: userMessage });
  const thread = await db
    .select()
    .from(messages)
    .where(eq(messages.taskId, taskId))
    .orderBy(asc(messages.createdAt));

  const transcript = thread
    .map((message) => `${message.role === "user" ? "Them" : "You"}: ${message.content}`)
    .join("\n\n");

  const { run, result } = await execute({
    subjectId: taskId,
    projectId: project.id,
    agent,
    kind: "refine",
    taskId,
    label: `refining "${task.title || "untitled task"}"`,
    systemPrompt: `${agent.systemPrompt || REFINE_SYSTEM}\n\n${projectContext(project)}`,
    prompt: `Current brief:\n${task.brief || "(nothing yet)"}\n\nConversation so far:\n\n${transcript}`,
  });

  if (run.status !== "ok" || !result) return run;

  const parsed = parseJson<RefineReply>(result.output) ?? {};
  const reply = parsed.reply?.trim() || result.output.trim();
  await db.insert(messages).values({ taskId, role: "assistant", content: reply });
  await db
    .update(tasks)
    .set({
      title: parsed.title?.trim() || task.title,
      brief: parsed.brief?.trim() || task.brief,
    })
    .where(eq(tasks.id, taskId));

  return run;
}

/** Where decomposed cards land: the lane marked `intake`, else the leftmost one. */
async function intakeLane(projectId: string) {
  const [lane] = await db
    .select()
    .from(lanes)
    .where(eq(lanes.projectId, projectId))
    .orderBy(desc(lanes.intake), asc(lanes.position))
    .limit(1);
  if (!lane) throw new Error("this project has no lanes — add one before decomposing a task");
  return lane;
}

const nextPosition = async (laneId: string) => {
  const rows = await db
    .select({ position: cards.position })
    .from(cards)
    .where(eq(cards.laneId, laneId))
    .orderBy(desc(cards.position))
    .limit(1);
  return (rows[0]?.position ?? -1) + 1;
};

/**
 * Turns one accepted task into the cards that carry it out.
 *
 * The task is marked `decomposing` before the agent starts and `decomposed` or `error` after,
 * so a decomposition in flight is visible and a failed one says why on the task rather than
 * only in the run history.
 *
 * A decomposition that produces nothing usable is an error, not an empty success: a task the
 * agent could not break up is exactly the case a person needs to be told about.
 */
export async function decomposeTask(taskId: string): Promise<Run> {
  const task = await loadTask(taskId);
  if (!task.brief.trim()) throw new Error("this task has no brief for the decomposer to read");
  const project = await loadProject(task.projectId);
  const agent = await resolveStage("decompose", project.decomposeAgentId);
  const lane = await intakeLane(project.id);

  await db.update(tasks).set({ status: "decomposing", error: "" }).where(eq(tasks.id, taskId));

  const { run, result } = await execute({
    subjectId: taskId,
    projectId: project.id,
    agent,
    kind: "decompose",
    taskId,
    label: `decomposing "${task.title || "untitled task"}"`,
    systemPrompt: agent.systemPrompt || DECOMPOSE_SYSTEM,
    prompt: decomposePrompt(project, task),
  });

  const fail = async (why: string) => {
    await db.update(tasks).set({ status: "error", error: why }).where(eq(tasks.id, taskId));
    return db
      .update(runs)
      .set({ status: "error", error: run.error || why })
      .where(eq(runs.id, run.id))
      .returning()
      .then((rows) => rows[0]);
  };

  if (run.status !== "ok" || !result) {
    return await fail(run.error || "the decompose agent did not finish");
  }

  const proposed = (parseJson<DecomposedCard[]>(result.output) ?? []).filter(
    (card) => card && typeof card.title === "string" && card.title.trim(),
  );
  if (!proposed.length) {
    return await fail("the decompose agent produced no cards this server could read");
  }

  const start = await nextPosition(lane.id);
  const written = await db
    .insert(cards)
    .values(
      proposed.map((card, at) => ({
        projectId: project.id,
        taskId,
        laneId: lane.id,
        title: card.title.trim(),
        body: card.body?.trim() ?? "",
        acceptance: card.acceptance?.trim() ?? "",
        position: start + at,
      })),
    )
    .returning();

  // Dependencies come back as titles, because a model cannot know the ids of rows that do not
  // exist yet. Anything naming a card outside this batch is dropped rather than failing the
  // decomposition — a hallucinated title is a lost ordering hint, not a lost card.
  const byTitle = new Map(written.map((card) => [card.title, card.id]));
  const links = proposed.flatMap((card, at) =>
    (card.dependsOn ?? [])
      .map((title) => byTitle.get(title.trim()))
      .filter((dependsOnCardId) => dependsOnCardId && dependsOnCardId !== written[at].id)
      .map((dependsOnCardId) => ({
        cardId: written[at].id,
        dependsOnCardId: dependsOnCardId as string,
      })),
  );
  if (links.length) await db.insert(cardDeps).values(links).onConflictDoNothing();

  await db.update(tasks).set({ status: "decomposed", error: "" }).where(eq(tasks.id, taskId));
  return run;
}

/**
 * Cards this one is waiting on that are not finished yet.
 *
 * An archived card counts as no longer in the way, the same as a done one. It is off the board:
 * nothing is going to move it on, and a card left waiting for it would wait for good — with a
 * hint on its face naming a card that is not drawn anywhere. Archiving a dependency is a
 * decision that it does not have to happen, and this is that decision taking effect.
 */
export async function blockers(cardId: string): Promise<Card[]> {
  const deps = await db
    .select({ id: cardDeps.dependsOnCardId })
    .from(cardDeps)
    .where(eq(cardDeps.cardId, cardId));
  if (!deps.length) return [];
  const rows = await db
    .select()
    .from(cards)
    .where(
      inArray(
        cards.id,
        deps.map((dep) => dep.id),
      ),
    );
  return rows.filter((card) => card.status !== "done" && !card.archivedAt);
}

/**
 * Works one card with the agent its lane names, and moves it on.
 *
 * Where the card ends up is the lane's business, not the agent's: `onSuccessLaneId` and
 * `onFailureLaneId` are what make a board a pipeline, and a lane that names neither simply
 * keeps its cards. A card with no lane agent cannot be run at all — that is what a backlog is.
 *
 * A lane with `readVerdict` is judged on what its agent said rather than on whether it answered:
 * a reviewer did its job either way, so its run is `ok`, and a verdict beginning FAIL sends the
 * card down the failure arm. Anything else counts as a pass, because a reviewer that cannot make
 * itself clear should not silently block the board.
 */
export async function runCard(cardId: string, agentId?: string | null): Promise<Run> {
  const card = await loadCard(cardId);
  const project = await loadProject(card.projectId);
  if (card.archivedAt)
    throw new Error(`"${card.title}" is archived — restore it before running it`);
  const [lane] = await db.select().from(lanes).where(eq(lanes.id, card.laneId)).limit(1);
  if (!lane) throw new Error("this card is not in a lane");

  const chosen = agentId ?? lane.agentId;
  if (!chosen) throw new Error(`lane "${lane.name}" has no agent — nothing runs there`);
  const agent = await resolveAgentId(chosen);

  const waiting = await blockers(cardId);
  if (waiting.length) {
    await db
      .update(cards)
      .set({ status: "blocked", error: `waiting on: ${waiting.map((c) => c.title).join(", ")}` })
      .where(eq(cards.id, cardId));
    throw new Error(`"${card.title}" is waiting on ${waiting.length} unfinished card(s)`);
  }

  await db.update(cards).set({ status: "running", error: "" }).where(eq(cards.id, cardId));

  const { run, result, ok } = await execute({
    subjectId: cardId,
    projectId: project.id,
    agent,
    kind: "card",
    cardId,
    taskId: card.taskId,
    laneId: lane.id,
    label: `working "${card.title}"`,
    prompt: cardPrompt(project, card),
  });

  const output = result?.output?.trim() ?? "";
  // The verdict is the lane's business, not the agent's: a station that judges cards says so,
  // and the same agent works cards elsewhere without its answer being read as a ruling.
  const passed = ok && (!lane.readVerdict || !/^\s*FAIL\b/i.test(output));

  const target = passed ? lane.onSuccessLaneId : lane.onFailureLaneId;
  const [next] = target
    ? await db.select().from(lanes).where(eq(lanes.id, target)).limit(1)
    : [undefined];

  // A card that passes into a lane with an agent of its own is not finished — it is waiting for
  // that lane's turn, and only an `idle` card is picked up. `done` is for a card nothing further
  // will happen to: one that stayed put, or one that landed where no agent runs.
  await db
    .update(cards)
    .set({
      status:
        run.status === "stopped" ? "idle" : !passed ? "error" : next?.agentId ? "idle" : "done",
      result: output || card.result,
      error: passed ? "" : run.error || (lane.readVerdict ? output : "the agent did not finish"),
      ...(target ? { laneId: target, position: await nextPosition(target) } : {}),
    })
    .where(eq(cards.id, cardId));

  return run;
}

/**
 * Cards a lane's agent could pick up right now, oldest position first.
 *
 * An archived card is not one of them however runnable it looks. It is still in a lane — that
 * is where restoring puts it back — so nothing but this excludes it from the lane's own queue.
 */
export async function readyCards(laneId: string): Promise<Card[]> {
  const rows = await db
    .select()
    .from(cards)
    .where(
      and(
        eq(cards.laneId, laneId),
        isNull(cards.archivedAt),
        inArray(cards.status, ["idle", "blocked"]),
      ),
    )
    .orderBy(asc(cards.position));

  const ready: Card[] = [];
  for (const card of rows) {
    if (inFlight.has(card.id)) continue;
    if ((await blockers(card.id)).length) continue;
    ready.push(card);
  }
  return ready;
}
