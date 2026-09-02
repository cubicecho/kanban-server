import { desc, eq } from "drizzle-orm";
import { db } from "./client.ts";
import { type CardEvent, cardEvents } from "./schema.ts";

/**
 * Writing and reading a card's ledger — the record of what became of it, and why.
 *
 * Every mover of a card goes through here rather than writing the row itself, so that "why is
 * this card in this lane" has exactly one answer wherever it is asked from: a run, a mutation,
 * a person dragging it. The alternative was a column on the card, which could only ever hold
 * the most recent reason and lost the one before it.
 */

export interface Move {
  cardId: string;
  /** The run that decided this, or null for a person's doing. */
  runId?: string | null;
  /** Null when the card is being created. */
  fromLaneId?: string | null;
  /** Null when the card is being archived. */
  toLaneId?: string | null;
  /** Why, in the words of whoever decided: a reviewer's verdict, or a person's reason. */
  note?: string;
  actor?: CardEvent["actor"];
}

/**
 * Records one move. Takes the transaction it belongs to, where there is one, so a card that
 * moved and the ledger saying so commit together or not at all.
 */
export async function recordMove(move: Move, tx: Pick<typeof db, "insert"> = db): Promise<void> {
  await tx.insert(cardEvents).values({
    cardId: move.cardId,
    runId: move.runId ?? null,
    fromLaneId: move.fromLaneId ?? null,
    toLaneId: move.toLaneId ?? null,
    note: move.note ?? "",
    actor: move.actor ?? "user",
  });
}

/**
 * Why this card is in this lane, if anyone said — the reason given by whatever put it here.
 *
 * Read backwards from the newest event and stop at the one that brought the card to this lane:
 * anything older happened somewhere else and is not why it is here now. A move onwards is
 * therefore what clears a reviewer's rejection, which is what stops it following the card
 * around the board for the rest of its life.
 *
 * Note-less events in between are skipped rather than treated as an answer, so a person hitting
 * retry does not quietly delete the reason the card came back. That is the whole point of
 * pressing it: try again, knowing what went wrong.
 *
 * This is what `cardPrompt` reads. Nothing on the card itself can tell an agent this.
 */
export async function lastMoveNote(cardId: string, laneId: string): Promise<string> {
  const recent = await db
    .select()
    .from(cardEvents)
    .where(eq(cardEvents.cardId, cardId))
    .orderBy(desc(cardEvents.createdAt))
    .limit(20);
  for (const event of recent) {
    if (event.toLaneId !== laneId) break;
    if (event.note) return event.note;
  }
  return "";
}
