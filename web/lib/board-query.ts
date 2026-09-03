import { BoardDocument } from "@/__generated__/graphql";
import { request } from "@/lib/gql";

/**
 * How many cards a board will draw.
 *
 * One more than this is asked for and the first `BOARD_LIMIT` are shown, which is how a page
 * knows there are others: a board that quietly stopped at five hundred looked exactly like a
 * board with five hundred cards on it.
 *
 * There is no "show more" behind it, because a board is not a list — the cards come back in
 * `position` order across the whole project, so what a higher limit would add is the tail of
 * the longest lanes, and the answer to a board this size is the archive.
 */
export const BOARD_LIMIT = 500;

/**
 * The one question about a project's board, asked in one place.
 *
 * The board draws these rows and the status page counts them, and the two share a cache entry
 * rather than keeping one each: the same query under two limits would have each page's poll
 * throwing the other's answer away every few seconds, and moving between them would draw a
 * skeleton over an answer this process already had.
 *
 * The poll interval is the caller's, because it is the one thing the two pages disagree about
 * — the board stops refetching while a card is in the air, and nothing on a status page is
 * ever in the air.
 */
export const boardQuery = (projectId: string) => ({
  queryKey: ["board", projectId],
  queryFn: () => request(BoardDocument, { projectId, limit: BOARD_LIMIT + 1 }),
  enabled: Boolean(projectId),
});
