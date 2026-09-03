import { CardsStatusEnum } from "@/gql/graphql";

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
 * The dependency half is `blockingDeps` rather than a second reading of the same edges — the
 * board's hint and this page's heap have to agree about what is in a card's way, or the two
 * say different things about one card on two pages. The one case either can differ from the
 * server on is a board truncated at `BOARD_LIMIT`, where the missing rows are the tail of the
 * longest lanes; the page says when it is drawing a board that big.
 */
export function cardHealth(
  card: { status: CardsStatusEnum; deps: readonly { dependsOnCardId: string }[] },
  lane: { roleId?: string | null; agentId?: string | null } | undefined,
  onBoard: DepStatus[],
): CardHealth {
  if (needsAttention(card.status)) return "attention";
  if (card.status === CardsStatusEnum.Running) return "running";
  if (card.status === CardsStatusEnum.Done) return "done";
  if (!lane || !isStation(lane)) return "parked";
  return blockingDeps([...card.deps], onBoard).length ? "blocked" : "waiting";
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

/** What a board knows about a card it might be waiting on. */
export interface DepStatus {
  id: string;
  title: string;
  status: CardsStatusEnum;
}

/**
 * Which of a card's dependencies are actually still in its way, named.
 *
 * The board draws `deps` as they are stored, and a stored edge never expires — so a card whose
 * blocker finished last week went on reading "After Schema audit" for good, which is precisely
 * the staleness `blockers` exists on the server to avoid. This is that rule, `status !== "done"
 * && !archivedAt`, run against the board the client already has in hand rather than asked for
 * per card: the board is 500 rows polled every three seconds, and a query each to answer a
 * hint would be 500 more.
 *
 * A dependency this list cannot find is one the `Board` query filtered out, which means it is
 * archived — and an archived card is not in the way, so it is dropped rather than named. That
 * is the same answer the server gives, and `tests/card-deps.test.ts` holds the two together.
 */
export function blockingDeps(deps: { dependsOnCardId: string }[], onBoard: DepStatus[]): string[] {
  if (!deps.length) return [];
  const byId = new Map(onBoard.map((card) => [card.id, card]));
  return deps
    .map((dep) => byId.get(dep.dependsOnCardId))
    .filter((card): card is DepStatus => !!card && card.status !== CardsStatusEnum.Done)
    .map((card) => card.title);
}
