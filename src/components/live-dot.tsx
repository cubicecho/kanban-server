import { cn } from "@/lib/utils";

/**
 * That something is happening right now, in the smallest thing that can say it.
 *
 * The rail says it beside a nav item, the run stream says it above the output, and both had
 * written out their own pulsing green circle. It is the same fact and the same green — the one
 * a `running` card is badged in — so it is one component, and a page that wants to say a run
 * has ended says it by turning the dot grey rather than by taking it away.
 */
export function LiveDot({
  live = true,
  className,
}: {
  /** False draws the same dot, still and grey: this happened, and it is over. */
  live?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-2 shrink-0 rounded-full",
        live ? "animate-pulse bg-status-running" : "bg-muted-foreground",
        className,
      )}
    />
  );
}
