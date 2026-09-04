import { eq } from "drizzle-orm";

/**
 * Puts a card into a state the board would have put it in, without going through the board.
 *
 * `updateCard` only lets a client write the columns a card's *author* owns — a title, a body,
 * an acceptance — because `laneId`, `status` and `attempts` are the board's, and each has a
 * door of its own that renumbers the lane and writes the ledger. A test that wants a card
 * already failed, or already done, is not exercising any of that; it is arranging the world
 * the run before it left behind. So it writes the row, which is what the runner does.
 */
export async function setCardState(
  cardId: string,
  state: { status?: string; error?: string; attempts?: number },
) {
  const { db } = await import("../../server/db/client.ts");
  const { cards } = await import("../../server/db/schema.ts");
  await db
    .update(cards)
    // biome-ignore lint/suspicious/noExplicitAny: the status enum is generated from the column.
    .set(state as any)
    .where(eq(cards.id, cardId));
}
