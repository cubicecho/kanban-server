import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * A request that failed, said out loud.
 *
 * `retry: false` is set globally in `main.tsx`, so a failed query stays failed: nothing
 * behind it will try again on its own, and until now nothing in front of it said so either.
 * Every page rendered a failure as an absence — the board's was the worst of them, offering
 * "this board has no lanes" to somebody whose server had simply gone away, which is an
 * invitation to rebuild a board that is fine.
 */
export function QueryError({
  error,
  onRetry,
  what,
}: {
  error: Error | null;
  onRetry: () => void;
  /** What could not be fetched, in the user's words: "the board", "your agents". */
  what: string;
}) {
  return (
    // No tinted ground behind it: `bg-destructive/5` put the red heading at 4.36:1 and the grey
    // message at 4.33:1 against their own background, both under the 4.5 they need. The border
    // and the icon say "this failed" without moving the ground the words sit on.
    <Card className="gap-2 border-destructive/50 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-destructive">
        <TriangleAlert className="size-4" aria-hidden />
        Could not load {what}
      </div>
      <p className="text-sm text-muted-foreground">
        {error?.message || "The server did not answer."}
      </p>
      <div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-3.5" aria-hidden />
          Try again
        </Button>
      </div>
    </Card>
  );
}
