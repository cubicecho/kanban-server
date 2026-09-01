/**
 * Where a dragged card lands, and what that does to the numbering.
 *
 * Both of these mirror `moveCard` on the server, and that is the whole reason they are here
 * rather than inline in the board: the drop is applied to the cache before the server has
 * answered, so if the two disagree the card moves twice — once where it was dropped, and again
 * when the refetch lands. `tests/board-order.test.ts` runs the real mutation and compares.
 *
 * Only the lane a card lands in is renumbered. The lane it left keeps its numbering, hole and
 * all, which is what the server does too: positions order a lane, they do not count it.
 */

type Sortable = { id: string; laneId: string; position: number };

/**
 * The lane and position a drop means, or nothing if it means nothing.
 *
 * `over` is either another card — land where that card is — or a lane's own space, which is the
 * part below the cards and means the end. The position is the over card's index in the lane as
 * it stands, counting the dragged card itself when it is already there: `moveCard` pulls the
 * card out before it splices it back, so that index is one lower on the way down and dropping
 * A of [A, B, C] onto C gives [B, C, A] rather than [B, A, C]. That is the direction people
 * mean when they drag a card past another one, and it is what dnd-kit's own preview shows.
 */
export function landing(
  cards: readonly Sortable[],
  laneIds: readonly string[],
  activeId: string,
  overId: string,
): { laneId: string; position: number } | null {
  const card = cards.find((row) => row.id === activeId);
  if (!card) return null;

  const onLane = overId.startsWith("lane:");
  const laneId = onLane
    ? overId.slice("lane:".length)
    : cards.find((row) => row.id === overId)?.laneId;
  if (!laneId || !laneIds.includes(laneId)) return null;

  const here = cards
    .filter((row) => row.laneId === laneId)
    .sort((a, b) => a.position - b.position)
    .map((row) => row.id);
  // Over a card, that card's own index — including the dragged one, which is what makes
  // dragging downwards past itself land below rather than above. Over the lane, the end.
  const at = onLane ? here.filter((id) => id !== card.id).length : here.indexOf(overId);
  if (at === -1) return null;
  if (card.laneId === laneId && at === here.indexOf(card.id)) return null;
  return { laneId, position: at };
}

/** The target lane's order once the card is in it, which is its numbering from zero. */
export function placement(
  cards: readonly Sortable[],
  moved: { cardId: string; laneId: string; position?: number | null },
): string[] {
  const order = cards
    .filter((row) => row.laneId === moved.laneId && row.id !== moved.cardId)
    .sort((a, b) => a.position - b.position)
    .map((row) => row.id);
  const at = Math.max(0, Math.min(moved.position ?? order.length, order.length));
  order.splice(at, 0, moved.cardId);
  return order;
}
