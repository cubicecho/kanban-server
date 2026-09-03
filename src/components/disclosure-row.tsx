import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * One row in a list of things you can open: a run, a task, an archived card.
 *
 * The three pages that draw these had written the same forty lines each — a `Card`, a button
 * carrying a rotating chevron and `aria-expanded`, badges and a title and a grey line of facts,
 * two clipped lines of whatever the thing said, the buttons on the right, and the whole of it
 * behind a border when open. They had drifted in the ways a copy drifts: a chevron that did not
 * turn, a summary that clipped at three lines on one page and two on the next, an `aria-expanded`
 * on the row that also sat on something inside it.
 *
 * The shape is fixed here and the contents are the caller's. What is *not* the caller's is the
 * disclosure itself: the whole heading is the button, so opening a row never depends on hitting
 * the chevron, and the actions sit outside it because a button inside a button is neither.
 */
export function DisclosureRow({
  open,
  onOpenChange,
  badges,
  title,
  meta,
  summary,
  actions,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whatever this row is wearing: a status, a kind, a state. Drawn before the title. */
  badges?: React.ReactNode;
  title: React.ReactNode;
  /** The grey line of facts beside the title — a `MetaLine`, usually. */
  meta?: React.ReactNode;
  /** Two clipped lines of what the thing said, drawn under the title whether open or not. */
  summary?: React.ReactNode;
  /** Buttons, outside the disclosure: a row is opened by its heading and acted on by these. */
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Card className="gap-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-2 rounded text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-expanded={open}
          onClick={() => onOpenChange(!open)}
        >
          <ChevronRight
            aria-hidden
            className={cn(
              "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-90",
            )}
          />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              {badges}
              <span className="truncate font-medium">{title}</span>
              {meta}
            </span>
            {summary ? (
              <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">
                {summary}
              </span>
            ) : null}
          </span>
        </button>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>

      {open && children ? (
        <div className="flex flex-col gap-2 border-t pt-3">{children}</div>
      ) : null}
    </Card>
  );
}
