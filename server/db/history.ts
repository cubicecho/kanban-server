import { and, asc, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "./client.ts";
import { type CardEvent, type CardNote, cardEvents, cardNotes, cards } from "./schema.ts";

/**
 * Writing and reading a card's ledger — the record of what became of it, and why.
 *
 * Every mover of a card goes through here rather than writing the row itself, so that "why is
 * this card in this lane" has exactly one answer wherever it is asked from: a run, a mutation,
 * a person dragging it. The alternative was a column on the card, which could only ever hold
 * the most recent reason and lost the one before it.
 *
 * The reason itself is a `card_notes` row, because a reviewer's verdict and a person's reason
 * for dragging a card back are things said *about the card* — the same kind of thing as an
 * agent's report and a person's own note, and worth reading together. The move points at one
 * rather than holding a copy, so nothing can say it twice and disagree with itself.
 */

export interface NewNote {
  cardId: string;
  /** The run that wrote it, or null for a person's own. */
  runId?: string | null;
  kind: CardNote["kind"];
  author?: CardNote["author"];
  body: string;
}

/** A `db` or a transaction — whichever, this only ever inserts and selects. */
type Writer = Pick<typeof db, "insert" | "select">;

/**
 * Writes one note and answers with it. An empty body writes nothing and answers with null:
 * an agent that said nothing has not said anything, and a blank row in the stream reads as one.
 */
export async function addNote(note: NewNote, tx: Writer = db): Promise<CardNote | null> {
  const body = note.body.trim();
  if (!body) return null;
  const [written] = await tx
    .insert(cardNotes)
    .values({
      cardId: note.cardId,
      runId: note.runId ?? null,
      kind: note.kind,
      author: note.author ?? (note.runId ? "agent" : "user"),
      body,
    })
    .returning();
  return written;
}

export interface Move {
  cardId: string;
  /** The run that decided this, or null for a person's doing. */
  runId?: string | null;
  /** Null when the card is being created. */
  fromLaneId?: string | null;
  /** Null when the card is being archived. */
  toLaneId?: string | null;
  /**
   * Why, in the words of whoever decided. Given as text it is written as a note first and
   * pointed at; given as `noteId` the caller has already written one, which is how a run that
   * has to record its ruling whether or not it moved the card avoids writing it twice.
   */
  note?: string;
  noteId?: string | null;
  /** What kind of note the text makes, where the caller passed text. */
  noteKind?: CardNote["kind"];
  actor?: CardEvent["actor"];
}

/**
 * Records one move. Takes the transaction it belongs to, where there is one, so a card that
 * moved and the ledger saying so commit together or not at all.
 */
export async function recordMove(move: Move, tx: Writer = db): Promise<void> {
  const actor = move.actor ?? "user";
  const written = move.note
    ? await addNote(
        {
          cardId: move.cardId,
          runId: move.runId,
          kind: move.noteKind ?? (actor === "agent" ? "verdict" : "note"),
          author: actor === "agent" ? "agent" : "user",
          body: move.note,
        },
        tx,
      )
    : null;
  await tx.insert(cardEvents).values({
    cardId: move.cardId,
    runId: move.runId ?? null,
    fromLaneId: move.fromLaneId ?? null,
    toLaneId: move.toLaneId ?? null,
    noteId: move.noteId ?? written?.id ?? null,
    actor,
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
    .select({ toLaneId: cardEvents.toLaneId, body: cardNotes.body })
    .from(cardEvents)
    .leftJoin(cardNotes, eq(cardEvents.noteId, cardNotes.id))
    .where(eq(cardEvents.cardId, cardId))
    .orderBy(desc(cardEvents.createdAt))
    .limit(20);
  for (const event of recent) {
    if (event.toLaneId !== laneId) break;
    if (event.body) return event.body;
  }
  return "";
}

/**
 * What has been said about a card: the newest account of the work, and every note a person
 * left, oldest first.
 *
 * The two are asked for together because they are what an agent picking the card up is given.
 * Only the newest report — an agent needs the state of the work, not every draft of it, and the
 * older ones are on the card's page for a person to read. Every note, because a person who
 * wrote one meant it to stand until they take it back; that is what makes a note different from
 * a verdict, which belongs to the move it caused and is read off the ledger instead.
 */
export async function saidAbout(cardId: string): Promise<{ report: string; notes: string[] }> {
  const [newest] = await db
    .select({ body: cardNotes.body })
    .from(cardNotes)
    .where(and(eq(cardNotes.cardId, cardId), eq(cardNotes.kind, "report")))
    .orderBy(desc(cardNotes.createdAt))
    .limit(1);
  const notes = await db
    .select({ body: cardNotes.body })
    .from(cardNotes)
    .where(and(eq(cardNotes.cardId, cardId), eq(cardNotes.kind, "note")))
    .orderBy(asc(cardNotes.createdAt));
  return { report: newest?.body ?? "", notes: notes.map((note) => note.body) };
}

/** What a board can say about one card without opening it. */
export interface CardMark {
  cardId: string;
  /** Standing notes a person left on it. Reports and verdicts are not anybody's to leave. */
  notes: number;
  /** Why a reviewer turned it down, where one did and it has not been sent on since. */
  rejection: string;
}

/**
 * The marks a whole board's cards carry, in two queries rather than one per card.
 *
 * A card knew everything about itself except the two things worth seeing from across the board:
 * that somebody has written on it, and why it came back. Both live in `card_notes`, which the
 * `Board` query cannot reach for — it draws as many as five hundred cards and polls every three
 * seconds, and a relation on that is five hundred more queries a tick.
 *
 * The rejection is the newest `verdict` on a card that is *currently* rejected, which is the
 * same reason `lastMoveNote` would give and arrived at without walking the ledger: a card stops
 * being rejected the moment it is sent on, so a stale verdict cannot be drawn. Only those cards
 * are read at all, which is what keeps the bodies fetched here to the handful being asked about.
 */
export async function cardMarks(projectId: string): Promise<CardMark[]> {
  const counts = await db
    .select({ cardId: cardNotes.cardId, notes: count() })
    .from(cardNotes)
    .innerJoin(cards, eq(cardNotes.cardId, cards.id))
    .where(
      and(eq(cards.projectId, projectId), isNull(cards.archivedAt), eq(cardNotes.kind, "note")),
    )
    .groupBy(cardNotes.cardId);

  const verdicts = await db
    .select({ cardId: cardNotes.cardId, body: cardNotes.body })
    .from(cardNotes)
    .innerJoin(cards, eq(cardNotes.cardId, cards.id))
    .where(
      and(
        eq(cards.projectId, projectId),
        isNull(cards.archivedAt),
        eq(cards.status, "rejected"),
        eq(cardNotes.kind, "verdict"),
      ),
    )
    .orderBy(asc(cardNotes.createdAt));

  // Oldest first, so the last write per card wins and the newest verdict is what is left.
  const marks = new Map<string, CardMark>();
  const mark = (cardId: string) => {
    const found = marks.get(cardId) ?? { cardId, notes: 0, rejection: "" };
    marks.set(cardId, found);
    return found;
  };
  for (const row of counts) mark(row.cardId).notes = row.notes;
  for (const row of verdicts) mark(row.cardId).rejection = row.body;
  return [...marks.values()];
}
