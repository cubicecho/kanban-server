import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { plural } from "@/lib/text";

/**
 * The tools a server answered `tools/list` with.
 *
 * Drawn in two places — the row on Servers and the dialog that probes one before it is saved —
 * and a chip is only half an answer without what the tool does. That description arrived here
 * as `title`, which is a browser tooltip: it takes a second to appear, is unreachable by
 * keyboard, and is not read to anybody. It is a real tooltip now, in one place rather than two.
 */
export function ToolList({ tools }: { tools: { name: string; description?: string | null }[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {tools.map((tool) => (
        <Tooltip key={tool.name}>
          {/* The trigger is Radix's own button rather than a span, so the description is
              reachable by tab and not only by pointer. */}
          <TooltipTrigger className="rounded-md border px-2 py-0.5 font-mono text-muted-foreground text-xs">
            {tool.name}
          </TooltipTrigger>
          {tool.description ? <TooltipContent>{tool.description}</TooltipContent> : null}
        </Tooltip>
      ))}
    </div>
  );
}

/** "1 tool", "3 tools" — the `tool(s)` this replaces was in three places and read as unfinished. */
export const toolCount = (count: number): string => plural(count, "tool");
