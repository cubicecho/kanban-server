import { Item, ItemContent } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * What a list page shows before its first answer.
 *
 * Only ever on `isPending` — no data at all. The query client is cache-and-network
 * (`main.tsx`), so a page returned to keeps rendering what it had while it refetches, and
 * putting this behind `isFetching` would flash a skeleton over a perfectly good list.
 *
 * Drawn as the row it stands in for — `Item variant="outline"`, the same primitive every list
 * page is a list of — so the page does not change shape underneath the reader when the answer
 * lands.
 */
export function RowSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholders, in a list with no identity
        <Item key={index} variant="outline" aria-hidden>
          <ItemContent>
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </ItemContent>
        </Item>
      ))}
      <span className="sr-only" role="status">
        Loading
      </span>
    </>
  );
}
