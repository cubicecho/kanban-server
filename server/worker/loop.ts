import { eq } from "drizzle-orm";
import { errorMessage } from "../../shared/errors.ts";
import { db } from "../db/client.ts";
import { cards, lanes, projects } from "../db/schema.ts";
import { loadSettings } from "../runner/llm.ts";
import { isRunning, readyCards, runCard } from "../runner/run.ts";

let timer: NodeJS.Timeout | undefined;
let ticking = false;

/**
 * One pass over every board that is on auto, starting whatever it may.
 *
 * A lane is a station: it has an agent, a WIP limit, and somewhere to send a card when the
 * agent is finished with it. That is the whole of the automation — there is no workflow engine
 * here, and the shape of the pipeline is the shape of the board someone drew.
 *
 * Three things have to be true before a card is picked up, and each is a different person's
 * intent: the project is on auto, the lane names an agent, and the lane has room under its WIP
 * limit. A lane with no agent is a backlog or a done pile, and cards sit there forever, which
 * is the point of them.
 *
 * Runs are started but not awaited: a tick that waited would be as slow as its slowest agent
 * and would hold up every other board. `runCard` refuses a card already in flight, so the next
 * tick finding the same card mid-run is expected rather than a race — but the WIP check counts
 * running cards, so it is normally not even asked.
 */
export async function tick(): Promise<number> {
  const boards = await db.select().from(projects).where(eq(projects.autoRun, true));
  let started = 0;

  for (const project of boards) {
    const stations = await db.select().from(lanes).where(eq(lanes.projectId, project.id));
    for (const lane of stations) {
      if (!lane.agentId) continue;

      const here = await db.select().from(cards).where(eq(cards.laneId, lane.id));
      const busy = here.filter((card) => card.status === "running" || isRunning(card.id)).length;
      const room = Math.max(0, lane.wipLimit - busy);
      if (!room) continue;

      for (const card of (await readyCards(lane.id)).slice(0, room)) {
        started += 1;
        void runCard(card.id).catch((error: unknown) => {
          console.error(`[worker] ${lane.name}/${card.title}: ${errorMessage(error)}`);
        });
      }
    }
  }

  return started;
}

/**
 * Polls for work, at the interval in settings.
 *
 * Polling rather than waking on a write because the things that make a card runnable are not
 * all writes: a dependency finishing, an agent being switched back on, a run being stopped. A
 * few seconds of latency on a job measured in model round-trips is not worth the bookkeeping.
 *
 * The interval is re-read each tick, so changing it in the UI takes effect without a restart,
 * and a tick that overruns the interval is skipped rather than stacked.
 */
export function start() {
  stop();
  schedule(0);
}

function schedule(delayMs: number) {
  timer = setTimeout(run, delayMs);
  // Nothing should be held open by this: a server with no work to do should still exit.
  timer.unref?.();
}

async function run() {
  if (ticking) return;
  ticking = true;
  let seconds = 5;
  try {
    seconds = (await loadSettings()).workerIntervalSeconds;
    await tick();
  } catch (error) {
    console.error(`[worker] tick failed: ${errorMessage(error)}`);
  } finally {
    ticking = false;
    schedule(Math.max(1, seconds) * 1000);
  }
}

export function stop() {
  clearTimeout(timer);
  timer = undefined;
}
