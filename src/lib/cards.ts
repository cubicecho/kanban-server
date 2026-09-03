import { CardsStatusEnum } from "@/gql/graphql";

/**
 * How a card's status is drawn, wherever one is drawn — the board and the archive both.
 *
 * The two of them kept their own copy of this map until `rejected` arrived, and a status that
 * means one thing on the board and another in the archive is worse than no colour at all.
 */

/** The base badge for each status. Grey unless there is a reason not to be. */
export const CARD_STATUS_VARIANT: Record<CardsStatusEnum, "destructive" | "outline" | "secondary"> =
  {
    [CardsStatusEnum.Error]: "destructive",
    [CardsStatusEnum.Rejected]: "outline",
    [CardsStatusEnum.Running]: "outline",
    [CardsStatusEnum.Done]: "secondary",
    [CardsStatusEnum.Idle]: "secondary",
  };

/**
 * The two statuses worth spotting from across a board, and they are deliberately only two: a
 * board where everything is coloured says nothing.
 *
 * `running` is green, the colour the run stream already uses for a live run. `rejected` is
 * amber and not red, because that is the whole point of it being its own word — a reviewer
 * saying no is the board working and wants a decision, where red is a fault and wants looking
 * at. Telling the two apart at a glance is what a person comes to the board for.
 *
 * The hues are `--status-*` tokens rather than `emerald-*`/`amber-*` utilities, because a
 * green that reads on a near-black card is not the green that reads on a white one, and the
 * light palette is now something you can actually be looking at.
 */
export const CARD_STATUS_CLASS: Partial<Record<CardsStatusEnum, string>> = {
  [CardsStatusEnum.Running]:
    "border-status-running/30 bg-status-running/15 text-status-running-foreground",
  [CardsStatusEnum.Rejected]:
    "border-status-rejected/30 bg-status-rejected/15 text-status-rejected-foreground",
};

/** A card waiting on a person: one that was turned down, or one that broke. */
export const needsAttention = (status: CardsStatusEnum) =>
  status === CardsStatusEnum.Error || status === CardsStatusEnum.Rejected;

/**
 * Whether a lane will ever pick a card up. Both halves are needed: the role says what happens
 * here and the agent says who does it, and a lane naming one without the other never runs.
 */
export const isStation = (lane: { roleId?: string | null; agentId?: string | null }) =>
  Boolean(lane.roleId && lane.agentId);

/**
 * What is actually becoming of a card, which its status alone does not say.
 *
 * `idle` is four different situations wearing one word — a card an agent is about to pick up,
 * one held behind a dependency, one sitting in a resting place nothing runs from, and, when
 * the project is not on auto, one waiting on a person to press the button. A board makes that
 * difference visible by where the card is standing; a count of statuses cannot, and "eleven
 * idle" is exactly the number that reads as fine when half of it is stuck.
 */
export type CardHealth = "attention" | "running" | "blocked" | "waiting" | "parked" | "done";

/** Worst first: what wants somebody now, down to what wants nobody ever. */
export const CARD_HEALTH: readonly CardHealth[] = [
  "attention",
  "running",
  "blocked",
  "waiting",
  "parked",
  "done",
] as const;

/**
 * Where one card stands, given the lane it is in and the board around it.
 *
 * The dependency half is `blockers` as the server works it out, against the cards this board
 * already has: a dependency that is not among them has been archived, and an archived
 * dependency is not in the way — taking a card off the board is a decision that it does not
 * have to happen. The one case the two can differ on is a board truncated at `BOARD_LIMIT`,
 * where the missing rows are the tail of the longest lanes; the page says when it is drawing
 * a board that big.
 */
export function cardHealth(
  card: { status: CardsStatusEnum; deps: readonly { dependsOnCardId: string }[] },
  lane: { roleId?: string | null; agentId?: string | null } | undefined,
  onBoard: ReadonlyMap<string, { status: CardsStatusEnum }>,
): CardHealth {
  if (needsAttention(card.status)) return "attention";
  if (card.status === CardsStatusEnum.Running) return "running";
  if (card.status === CardsStatusEnum.Done) return "done";
  if (!lane || !isStation(lane)) return "parked";
  const waiting = card.deps.some((dep) => {
    const on = onBoard.get(dep.dependsOnCardId);
    return Boolean(on) && on?.status !== CardsStatusEnum.Done;
  });
  return waiting ? "blocked" : "waiting";
}

/** The board's dependency edges: each row is one card waiting on one other. */
export type DepGraph = { cardId: string; dependsOnCardId: string }[];

/**
 * Which cards cannot be waited on without closing a loop — the same walk the server refuses
 * with, run against the graph the board already fetched.
 *
 * This is the bargain `src/lib/board-order.ts` strikes, for the same reason: a cycle drawn as a
 * disabled row is a mistake somebody cannot make, where a cycle refused after the save is a
 * toast about a write that already went out. `setCardDeps` stays the authority — it reads every
 * card in the project, archived ones included, and names the loop — so the one way the two can
 * differ is a chain that runs through an archived card this graph does not carry: a row offered
 * that the server then declines, which is the harmless direction.
 *
 * Edges point from a card to what it waits on, so a path from a candidate back to `cardId` is
 * exactly the loop that waiting on it would close. `cardId`'s own edges are left out, because
 * the picker is about to replace them — and no path *to* `cardId` can use them anyway.
 */
export function cyclingCards(cardId: string, graph: DepGraph): Set<string> {
  const edges = new Map<string, string[]>();
  for (const link of graph) {
    if (link.cardId === cardId) continue;
    edges.set(link.cardId, [...(edges.get(link.cardId) ?? []), link.dependsOnCardId]);
  }

  // Memoised because a board is a graph and not a tree: without it a diamond is walked twice
  // over, and a board is allowed 500 cards.
  const reaches = new Map<string, boolean>();
  const walk = (from: string): boolean => {
    if (from === cardId) return true;
    const known = reaches.get(from);
    if (known !== undefined) return known;
    // Written before recursing: a loop that does not pass through `cardId` is somebody else's
    // problem, and revisiting it here would not terminate.
    reaches.set(from, false);
    const found = (edges.get(from) ?? []).some(walk);
    reaches.set(from, found);
    return found;
  };

  // Only a card with an outgoing edge can reach anything, so the keys are the whole candidate
  // set: everything else is safe to wait on by construction.
  return new Set([...edges.keys()].filter(walk));
}
