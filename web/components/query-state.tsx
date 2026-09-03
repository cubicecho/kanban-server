import { QueryError } from "@/components/query-error";
import { RowSkeleton } from "@/components/row-skeleton";

/**
 * The three things a list of rows can be before it is a list of rows.
 *
 * Six pages drew this same ladder — failed, loading, empty — and each wrote the last rung its
 * own way: `data?.roles.length === 0` on the pages that read straight off the query, and
 * `shown.length === 0 && !q.isPending && !q.isError` on the ones that had already defaulted the
 * list to `[]`. Both are right, which is the problem: the next page copies whichever it lands
 * next to, and the guard has to be re-derived every time. Here the three are exclusive by
 * construction and the page passes a count.
 */
export function QueryState({
  query,
  what,
  rows = 3,
  count,
  empty,
}: {
  query: { isPending: boolean; isError: boolean; error: Error | null; refetch: () => unknown };
  /** What could not be fetched, in the user's words: "your agents", "the archive". */
  what: string;
  /** How many skeleton rows to stand in for it. */
  rows?: number;
  /** How many rows the page is about to draw. */
  count: number;
  /** What to say when there are none — an `EmptyState`, with whatever invites the first one. */
  empty: React.ReactNode;
}) {
  if (query.isError)
    return <QueryError error={query.error} onRetry={() => query.refetch()} what={what} />;
  if (query.isPending) return <RowSkeleton rows={rows} />;
  if (count === 0) return <>{empty}</>;
  return null;
}
