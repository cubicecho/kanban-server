import { and, asc, desc, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { errorMessage } from "../../shared/errors.ts";
import { db } from "../db/client.ts";
import { lastMoveNote, recordMove } from "../db/history.ts";
import {
  type Card,
  cardDeps,
  cards,
  lanes,
  messages,
  projects,
  type Run,
  roles,
  runs,
  tasks,
} from "../db/schema.ts";
import { type AgentResult, runAgent } from "./agent.ts";
import { emit } from "./events.ts";
import { loadSettings, type Resolved, resolveAgentId, resolveRefineAgent } from "./llm.ts";
import {
  cardPrompt,
  type ProposedCard,
  projectContext,
  REFINE_SYSTEM,
  systemPromptFor,
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

/** What a run that was still going when the process went away is recorded as, and left on. */
const INTERRUPTED = "interrupted by a restart";

/** How much of that there was, for the line the server prints when it finds any. */
export interface Interrupted {
  runs: number;
  cards: number;
}

/**
 * Puts back what a restart interrupted.
 *
 * `inFlight` is memory, and a run lives only as long as the process that started it. One that
 * dies mid-run leaves rows saying otherwise, and none of them ever rights itself: the run stays
 * `running`, which `prune` will not delete, `spend` keeps counting and the board keeps drawing
 * as live; the card stays `running`, which counts against its lane's WIP limit, so a lane of
 * one is a station that never starts anything again. A board that quietly stops is worse than
 * a board that fails, and nothing short of somebody noticing gets it going again.
 *
 * So this is called once at boot, before the worker looks at any board: at that moment every
 * `running` row is stale by definition. The runs are marked `error` rather than `stopped` —
 * `stopped` is a run somebody called off, and nobody called these off — and their cards go back
 * to `idle` with the reason on their face, which is where an auto-run board picks them up again
 * and a manual one shows a person what happened. Nothing is put back on a task: a refinement is
 * one turn of a conversation, and breaking work up is a card on the board like any other.
 *
 * Whatever this process is genuinely running is left alone, so calling it later is safe rather
 * than merely discouraged. It costs an attempt nothing — a restart is not the card's failure.
 */
export async function reconcile(): Promise<Interrupted> {
  const live = [...runningRunIds()];
  const subjects = [...runningSubjectIds()];

  const abandoned = await db
    .update(runs)
    .set({ status: "error", error: INTERRUPTED, finishedAt: new Date() })
    .where(and(eq(runs.status, "running"), live.length ? notInArray(runs.id, live) : undefined))
    .returning({ id: runs.id });

  const stranded = await db
    .update(cards)
    .set({ status: "idle", error: INTERRUPTED })
    .where(
      and(
        eq(cards.status, "running"),
        subjects.length ? notInArray(cards.id, subjects) : undefined,
      ),
    )
    .returning({ id: cards.id });

  // A task has nothing left to be caught in the middle of. Refining is one turn of a
  // conversation — an interrupted one leaves the thread a message short and nothing else — and
  // breaking work up happens on the board now, where it is a card like any other.
  return { runs: abandoned.length, cards: stranded.length };
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
 * A task can be talked about for as long as anyone wants to. There is nothing to be past: the
 * conversation's one exit is somebody making a card out of it, and that leaves the thread
 * where it is rather than closing it.
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
  const project = await loadProject(task.projectId);
  const agent = await resolveRefineAgent(project.refineAgentId);
  const config = await loadSettings();

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
    systemPrompt: systemPromptFor({
      where: projectContext(project),
      identity: agent.systemPrompt,
      role: config.refinePrompt || REFINE_SYSTEM,
    }),
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

/** A project's front door: the lane marked `intake`, else the leftmost one. */
async function intakeLane(projectId: string) {
  const [lane] = await db
    .select()
    .from(lanes)
    .where(eq(lanes.projectId, projectId))
    .orderBy(desc(lanes.intake), asc(lanes.position))
    .limit(1);
  if (!lane) throw new Error("this project has no lanes — add one before putting work in it");
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
 * Turns proposed cards into rows, in the order they were proposed, and links what they wait on.
 *
 * Dependencies come back as titles, because a model cannot know the ids of rows that do not
 * exist yet. Anything naming a card outside this batch is dropped rather than failing the whole
 * expansion — a hallucinated title is a lost ordering hint, not a lost card.
 */
async function writeCards(where: {
  projectId: string;
  laneId: string;
  taskId?: string | null;
  parentId?: string | null;
  runId: string;
  proposed: ProposedCard[];
}): Promise<Card[]> {
  const start = await nextPosition(where.laneId);
  const written = await db
    .insert(cards)
    .values(
      where.proposed.map((card, at) => ({
        projectId: where.projectId,
        taskId: where.taskId ?? null,
        parentId: where.parentId ?? null,
        laneId: where.laneId,
        title: card.title.trim(),
        body: card.body?.trim() ?? "",
        acceptance: card.acceptance?.trim() ?? "",
        position: start + at,
      })),
    )
    .returning();

  // These are the only cards on the board an agent made rather than a person, and their ledgers
  // say so: the run that wrote them is the first line of each one's history.
  for (const card of written)
    await recordMove({
      cardId: card.id,
      runId: where.runId,
      toLaneId: where.laneId,
      actor: "agent",
    });

  const byTitle = new Map(written.map((card) => [card.title, card.id]));
  const links = where.proposed.flatMap((card, at) =>
    (card.dependsOn ?? [])
      .map((title) => byTitle.get(title.trim()))
      .filter((dependsOnCardId) => dependsOnCardId && dependsOnCardId !== written[at].id)
      .map((dependsOnCardId) => ({
        cardId: written[at].id,
        dependsOnCardId: dependsOnCardId as string,
      })),
  );
  if (links.length) await db.insert(cardDeps).values(links).onConflictDoNothing();
  return written;
}

/** The cards an expanding station's answer proposes — none, where this server could read none. */
const proposedCards = (output: string): ProposedCard[] =>
  (parseJson<ProposedCard[]>(output) ?? []).filter(
    (card) => card && typeof card.title === "string" && card.title.trim(),
  );

/**
 * A card in at the front door.
 *
 * This is the way onto a board for a caller that has no lane ids to hand — an MCP client, or a
 * conversation that has finished being a conversation. Where the front door is is the project's
 * business, which is what `intake` on a lane says.
 */
export async function submitCard(
  projectId: string,
  title: string,
  body: string,
  taskId?: string | null,
): Promise<Card> {
  const lane = await intakeLane(projectId);
  const [card] = await db
    .insert(cards)
    .values({
      projectId,
      taskId: taskId ?? null,
      laneId: lane.id,
      title: title.trim() || body.trim().slice(0, 80) || "untitled",
      body,
      position: await nextPosition(lane.id),
    })
    .returning();
  await recordMove({ cardId: card.id, toLaneId: lane.id, actor: "user" });
  return card;
}

/**
 * The one exit from a conversation: what was talked about, as a card in the front door.
 *
 * The thread is left exactly where it is. A task has no status to advance and nothing further
 * happens to it — whether it produced work is the card pointing back at it, which is a fact
 * about the board rather than a second copy of one.
 */
export async function makeCard(taskId: string): Promise<Card> {
  const task = await loadTask(taskId);
  if (!task.brief.trim() && !task.title.trim())
    throw new Error("this task has nothing in it yet — say what you want first");
  return submitCard(task.projectId, task.title, task.brief, taskId);
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
 * Where the card ends up is the lane's business, not the agent's: `onSuccessLaneId`,
 * `archiveOnSuccess` and `onFailureLaneId` are what make a board a pipeline, and a lane that
 * names none of them simply keeps its cards. A card with no lane agent cannot be run at all — that is what a backlog is.
 *
 * What the agent is told is composed here and nowhere else: its own identity, the lane's role,
 * and whatever this board adds on top. A lane whose composition comes out empty has no job, and
 * is refused rather than run on an empty system message.
 *
 * A lane whose role answers with a `verdict` is judged on what its agent said rather than on
 * whether it answered: a reviewer did its job either way, so its run is `ok`, and a verdict
 * beginning FAIL sends the card down the failure arm. Anything else counts as a pass, because a
 * reviewer that cannot make itself clear should not silently block the board.
 *
 * A lane whose role `expand`s answers with cards instead. They are written down the pass arrow
 * and the card that asked for them is archived: it has become the work rather than waiting on
 * it, and leaving it on the board would be a card nobody can finish.
 *
 * A lane may also archive what passes rather than pass it anywhere, which is the end of a
 * pipeline saying so: the Done pile that grows forever and gets emptied by hand is a chore the
 * board can do itself.
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

  // The one place a role and an agent meet. Neither knows about the other anywhere else, which
  // is what lets this agent work cards in Doing and rule on them in Review on the same board.
  const [role] = lane.roleId
    ? await db.select().from(roles).where(eq(roles.id, lane.roleId)).limit(1)
    : [undefined];
  // Where an expansion's children would land, asked before the run rather than after it: a
  // station that breaks cards up and has nowhere to put the pieces has no job it can finish,
  // and finding that out after the tokens are spent helps nobody.
  if (role?.contract === "expand" && (!lane.onSuccessLaneId || lane.archiveOnSuccess))
    throw new Error(`lane "${lane.name}" breaks cards up but has no lane to put them in`);

  // The project's background is asked for separately from the job, because a lane that says
  // nothing at all is a lane with no job — and a system prompt made only of background would
  // hide that behind text an agent cannot act on.
  const job = systemPromptFor({
    identity: agent.systemPrompt,
    role: role?.prompt,
    extra: lane.prompt,
  });
  if (!job) throw new Error(`lane "${lane.name}" has nothing to tell an agent — give it a role`);
  const systemPrompt = systemPromptFor({ where: projectContext(project), role: job });

  // Nothing is written about waiting. What a card waits on is a fact about the cards around
  // it, and the one this used to store went stale the moment a dependency finished — a card
  // sitting at `blocked` saying "waiting on: X" long after X was done. The caller gets the
  // reason in the message, and `blockers` answers the question properly whenever it is asked.
  const waiting = await blockers(cardId);
  if (waiting.length)
    throw new Error(`"${card.title}" is waiting on ${waiting.length} unfinished card(s)`);

  const note = await lastMoveNote(cardId, card.laneId);
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
    systemPrompt,
    prompt: cardPrompt(card, note),
  });

  const output = result?.output?.trim() ?? "";
  // The verdict is the lane's business, not the agent's: a station that judges cards says so,
  // and the same agent works cards elsewhere without its answer being read as a ruling. It
  // also needs a run that finished — a reviewer whose connection dropped ruled on nothing,
  // whatever half a sentence made it out before the stream died.
  const judges = role?.contract === "verdict";
  const verdict: Run["verdict"] =
    judges && ok ? (/^\s*FAIL\b/i.test(output) ? "fail" : "pass") : "none";

  // An expansion is judged on what it produced. An answer no cards could be read out of is a
  // failure and not an empty success: a card the agent could not break up is exactly the case
  // a person needs telling about, and a board that quietly swallowed it would lose the work.
  const proposed = role?.contract === "expand" && ok ? proposedCards(output) : [];
  const barren = role?.contract === "expand" && ok && !proposed.length;
  const passed = ok && verdict !== "fail" && !barren;
  // A run somebody called off is not a verdict on the card: it costs it no attempt and leaves
  // it where it was, to be started again whenever.
  const stopped = run.status === "stopped";
  const attempts = card.attempts + (passed || stopped ? 0 : 1);

  // A run somebody called off sends the card nowhere. It is not a failure of the work — there
  // is no work yet — and a stopped review dropping the card down the failure arm would put it
  // back in Doing as though it had been rejected by a reviewer that never finished a sentence.
  // A card that passes out of a lane that archives goes off the board rather than along it, so
  // it has no target at all: `archiveOnSuccess` and `onSuccessLaneId` are two answers to one
  // question and this is which of them is read.
  const archiving = passed && !stopped && lane.archiveOnSuccess;
  const target = stopped || archiving ? null : passed ? lane.onSuccessLaneId : lane.onFailureLaneId;
  const [next] = target
    ? await db.select().from(lanes).where(eq(lanes.id, target)).limit(1)
    : [undefined];

  // A failed card goes back in play while this station still has attempts to spend on it — the
  // board correcting itself, which is what a Doing↔Review loop is for — and only where an agent
  // will actually pick it up: a card put back `idle` in a lane where nothing runs is not being
  // retried, it is being lost. Spent, or nowhere to go, it stops at `error` and waits for a
  // person. With `maxAttempts` left at zero that is every failure, which is how a board behaved
  // before there was a budget to spend.
  const landing = next ?? lane;
  const rework = !passed && !stopped && attempts <= lane.maxAttempts && !!landing.agentId;

  // The children go where the parent's pass arrow points — the same place the parent would have
  // gone, because that is what the board says happens to work that is finished here.
  const children =
    passed && proposed.length && next
      ? await writeCards({
          projectId: project.id,
          laneId: next.id,
          taskId: card.taskId,
          parentId: cardId,
          runId: run.id,
          proposed,
        })
      : [];

  // A card that passes into a lane with an agent of its own is not finished — it is waiting for
  // that lane's turn, and only an `idle` card is picked up. `done` is for a card nothing further
  // will happen to: one that stayed put, or one that landed where no agent runs.
  //
  // A card a reviewer turned down is `rejected` and not `error`. The two want different things
  // from a person — a decision, or a look at what broke — and telling them apart on the board
  // is the whole reason there are two words.
  await db
    .update(cards)
    .set({
      status:
        stopped || rework
          ? "idle"
          : !passed
            ? verdict === "fail"
              ? "rejected"
              : "error"
            : children.length || archiving
              ? "done"
              : next?.agentId
                ? "idle"
                : "done",
      // A station that judges does not overwrite the account of the work with its ruling on it:
      // that report is the one thing the agent asked to fix the card needs to read. The ruling
      // goes on the move it caused, where the next prompt picks it up as the reason.
      result: judges ? card.result : output || card.result,
      // What broke, and only that. A verdict is not a fault and a stopped run is not one
      // either — the sentence that used to be invented here, "the agent did not finish", was
      // written onto every card whose run somebody deliberately called off. An expansion that
      // answered with nothing readable did break, and this is where it says so.
      error: barren ? "the agent produced no cards this server could read" : run.error,
      attempts,
      // A card that has become other cards, or one whose lane archives what it passes, goes
      // off the board rather than along it. Its own lane is kept, which is where restoring
      // would put it back.
      ...(children.length || archiving
        ? { archivedAt: new Date() }
        : target
          ? { laneId: target, position: await nextPosition(target) }
          : {}),
    })
    .where(eq(cards.id, cardId));

  // A ruling that moved nothing is still a ruling, so it is recorded where it stands: `from`
  // and `to` being the same lane is the ledger's way of saying the card was judged and left.
  // A card that was broken up went nowhere at all — `to` is null, which is this ledger's word
  // for off the board — and the note says what became of it, since the run that says so will
  // be pruned long before the children are.
  if (children.length)
    await recordMove({
      cardId,
      runId: run.id,
      fromLaneId: lane.id,
      toLaneId: null,
      note: `broken into ${children.length} card(s)`,
      actor: "agent",
    });
  else if (archiving)
    await recordMove({
      cardId,
      runId: run.id,
      fromLaneId: lane.id,
      toLaneId: null,
      // A verdict says why it was let through, which outlives the run that said so. Without
      // one there is nothing to quote, and the null above is already the ledger saying where
      // the card went — but not that it went there finished rather than in pieces.
      note: verdict === "none" ? "archived on the way out" : output,
      actor: "agent",
    });
  else if (verdict !== "none" || next)
    await recordMove({
      cardId,
      runId: run.id,
      fromLaneId: lane.id,
      toLaneId: next?.id ?? lane.id,
      note: verdict === "none" ? "" : output,
      actor: "agent",
    });

  if (verdict !== "none") await db.update(runs).set({ verdict }).where(eq(runs.id, run.id));

  // An expansion nobody could read cards out of is a failed run and not a successful one that
  // happened to write nothing, so the run history says so too.
  if (barren) {
    const [failed] = await db
      .update(runs)
      .set({ status: "error", error: "the agent produced no cards this server could read" })
      .where(eq(runs.id, run.id))
      .returning();
    return { ...failed, verdict };
  }

  return { ...run, verdict };
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
    .where(and(eq(cards.laneId, laneId), isNull(cards.archivedAt), eq(cards.status, "idle")))
    .orderBy(asc(cards.position));

  const ready: Card[] = [];
  for (const card of rows) {
    if (inFlight.has(card.id)) continue;
    if ((await blockers(card.id)).length) continue;
    ready.push(card);
  }
  return ready;
}
