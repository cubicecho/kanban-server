import { CircleAlert, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { type HookNote, hookSummary } from "../../shared/hooks.ts";

/**
 * What one of the MCP servers' hooks did for a run: the context it added, or why it did not.
 *
 * Context opens, since it is what the model read ahead of the card and is often a page of it;
 * the first of it is shown closed so the reader can tell a recall from a blank. A failure, or a
 * hook that added nothing, is a line: there is nothing to open. The live stream and the stored
 * run both draw this, so a hook reads the same while it runs and after.
 */
export function HookLine({
  summary,
  context,
  failed,
}: {
  summary: string;
  context?: string;
  failed?: boolean;
}) {
  const Icon = failed ? CircleAlert : Zap;
  const icon = (
    <Icon
      aria-hidden
      className={cn("size-3 shrink-0", failed ? "text-destructive" : "text-muted-foreground")}
    />
  );
  if (!context) {
    return (
      <p
        className={cn(
          "flex items-start gap-1.5 font-mono text-xs wrap-anywhere",
          failed ? "text-destructive" : "text-muted-foreground",
        )}
      >
        <span className="mt-0.5">{icon}</span>
        {summary}
      </p>
    );
  }
  return (
    <details className="group min-w-0 rounded-md border border-dashed text-xs">
      <summary className="flex cursor-pointer items-center gap-1.5 px-2 py-1 font-mono text-muted-foreground">
        {icon}
        <span className="shrink-0">{summary}</span>
        <span className="min-w-0 truncate opacity-70 group-open:hidden">— {context}</span>
      </summary>
      <pre className="overflow-x-auto border-t border-dashed p-2 whitespace-pre-wrap wrap-anywhere">
        {context}
      </pre>
    </details>
  );
}

/** A stored run's hook notes, one line each. A hook that worked and added nothing is not noted. */
export function HookNotes({ notes }: { notes: unknown }) {
  const list = (Array.isArray(notes) ? notes : []) as HookNote[];
  if (list.length === 0) return null;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {list.map((note, index) => (
        <HookLine
          // biome-ignore lint/suspicious/noArrayIndexKey: one hook may note twice, and the list is only appended to
          key={index}
          summary={hookSummary(note)}
          context={note.text}
          failed={Boolean(note.error)}
        />
      ))}
    </div>
  );
}
