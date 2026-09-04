import { Button } from "@/components/ui/button";

/**
 * The end of a page that has more behind it.
 *
 * Runs, Tasks and the archive all ask for one row more than they draw, which is how each of them
 * knows there is anything left; this is what they do about it, once rather than three times.
 */
export function ShowMore({ count, onMore }: { count: number; onMore: () => void }) {
  return (
    <Button variant="outline" className="self-center" onClick={onMore}>
      Show {count} more
    </Button>
  );
}
