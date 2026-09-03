import { CheckCircle2, XCircle } from "lucide-react";
import { ToolList, toolCount } from "@/components/tool-list";
import { cn } from "@/lib/utils";

/** What `testMcpServer` answered: the tools, or why there were none. */
export type Probe =
  | { ok: true; tools: { name: string; description?: string | null }[]; error?: string | null }
  | { ok: false; tools?: { name: string; description?: string | null }[]; error?: string | null };

/**
 * Whether a server answered, and with what.
 *
 * The dialog probes one before it is saved and the Servers page probes one that already is, and
 * the answer is the same answer: a tick and the tools, or a cross and what went wrong. It was
 * written out twice, and the two had already started to differ over which of them drew a border.
 */
export function ProbeResult({ probe, className }: { probe: Probe; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2 text-sm", className)}>
      <div className="flex items-center gap-2">
        {probe.ok ? (
          <CheckCircle2 className="size-4 shrink-0 text-status-running" aria-hidden />
        ) : (
          <XCircle className="size-4 shrink-0 text-destructive" aria-hidden />
        )}
        {probe.ok ? `Connected — ${toolCount(probe.tools?.length ?? 0)}` : "Could not connect"}
      </div>
      {probe.ok ? (
        <ToolList tools={probe.tools ?? []} />
      ) : (
        <p className="whitespace-pre-wrap font-mono text-xs text-destructive">{probe.error}</p>
      )}
    </div>
  );
}
