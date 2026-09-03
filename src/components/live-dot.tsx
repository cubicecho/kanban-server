import { cn } from "@/lib/utils";

/**
 * That something is happening right now, in the smallest thing that can say it.
 *
 * The rail says it beside a nav item, the run stream says it above the output, and both had
 * written out their own pulsing green circle. It is the same fact and the same green — the one
 * a `running` card is badged in — so it is one component, and a page that wants to say a run
 * has ended says it by turning the dot grey rather than by taking it away.
 *
 * `fault` is the same dot in red, and it says the other thing worth interrupting somebody for:
 * not that work is moving but that it has stopped and is waiting on them. Two tones and no
 * more, for the reason the badges have two colours — a page where everything pulses is a page
 * where nothing does.
 */
export function LiveDot({
  tone = "running",
  live = true,
  className,
}: {
  /** `running` is the board's green; `fault` is red, and means somebody is needed. */
  tone?: "running" | "fault";
  /** False draws the same dot, still and grey: this happened, and it is over. */
  live?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-2 shrink-0 rounded-full",
        !live && "bg-muted-foreground",
        live && tone === "running" && "animate-pulse bg-status-running",
        live && tone === "fault" && "animate-pulse bg-destructive",
        className,
      )}
    />
  );
}
