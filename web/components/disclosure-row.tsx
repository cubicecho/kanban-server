import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemTitle,
} from "@/components/ui/item";
import { cn } from "@/lib/utils";

/**
 * One row in a list of things you can open: a run, a task, an archived card.
 *
 * The three pages that draw these had written the same forty lines each — a card, a button
 * carrying a rotating chevron and `aria-expanded`, badges and a title and a grey line of facts,
 * two clipped lines of whatever the thing said, the buttons on the right, and the whole of it
 * behind a border when open. They had drifted in the ways a copy drifts: a chevron that did not
 * turn, a summary that clipped at three lines on one page and two on the next, an `aria-expanded`
 * on the row that also sat on something inside it.
 *
 * The row itself is `ui/item` — the same primitive Agents, Roles and MCP are lists of, so a row
 * that opens and a row that does not line up down to the padding. What this adds is the opening,
 * and the two parts of it that hand-written versions get wrong: the *whole heading* is the
 * button, so a row is never opened by hitting a 16-pixel chevron, and the actions sit outside
 * that button, a control inside a button being neither.
 */
export function DisclosureRow({
  open,
  onOpenChange,
  badges,
  title,
  meta,
  summary,
  actions,
  content,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whatever this row is wearing: a status, a kind, a state. Drawn before the title. */
  badges?: ReactNode;
  title: ReactNode;
  /** The grey line of facts beside the title — a `MetaLine`, usually. */
  meta?: ReactNode;
  /** Two clipped lines of what the thing said, drawn under the title whether open or not. */
  summary?: ReactNode;
  /** Buttons, outside the disclosure: a row is opened by its heading and acted on by these. */
  actions?: ReactNode;
  /** What the row opens onto. */
  content?: ReactNode;
}) {
  return (
    <Item data-slot="disclosure-row" variant="outline" className="items-start">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-start gap-2 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        <ItemContent className="min-w-0">
          <ItemTitle className="flex-wrap">
            {badges}
            <span className="truncate">{title}</span>
            {meta}
          </ItemTitle>
          {summary ? <ItemDescription>{summary}</ItemDescription> : null}
        </ItemContent>
      </button>

      {actions ? <ItemActions className="gap-1">{actions}</ItemActions> : null}

      {open && content ? (
        <ItemFooter className="flex-col items-stretch gap-2 border-t pt-3">{content}</ItemFooter>
      ) : null}
    </Item>
  );
}
