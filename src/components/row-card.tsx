import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * One row in a list of things you configure: an agent, a role, an MCP server.
 *
 * `DisclosureRow` is this row with a disclosure on it, and these pages are the ones with
 * nothing to open — so they had each written the heading out again, and drifted in the way
 * copies do: `gap-2` against `gap-3`, `items-start` against `items-center`, one page wrapping
 * its buttons and the next leaving them loose in the flex. A list of rows that do not line up
 * reads as a list of different kinds of thing.
 *
 * `dim` is the one thing worth a prop of its own: a switched-off agent goes quiet, but the
 * switch that turns it back on must not, so it applies to the row's own words and not to what
 * acts on them.
 */
export function RowCard({
  badges,
  title,
  meta,
  dim,
  actions,
  children,
}: {
  /** Whatever this row is wearing: a contract, a transport, a state. Drawn after the title. */
  badges?: React.ReactNode;
  title: React.ReactNode;
  /** The grey line of facts under the title — a description, an endpoint. */
  meta?: React.ReactNode;
  /** Whether this thing is switched off, and should read that way. */
  dim?: boolean;
  actions?: React.ReactNode;
  /** Anything below the heading: a probe result, a list of tools. */
  children?: React.ReactNode;
}) {
  return (
    <Card className="gap-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className={cn("min-w-0 flex-1", dim && "opacity-50")}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{title}</span>
            {badges}
          </div>
          {meta}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>
      {children}
    </Card>
  );
}
