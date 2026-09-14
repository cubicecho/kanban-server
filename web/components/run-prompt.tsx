import { useQuery } from "@tanstack/react-query";
import { MessageSquareText } from "lucide-react";
import { RunPromptDocument } from "@/__generated__/graphql";
import { request } from "@/lib/gql";
import { type RunPrompt, readRunPrompt } from "../../shared/run-prompt.ts";

/** One of the two opening messages, closed to a line, open to all of it. */
function Message({ label, text }: { label: string; text: string }) {
  return (
    <details className="group min-w-0 rounded-md border border-dashed text-xs">
      <summary className="flex cursor-pointer items-center gap-1.5 px-2 py-1 font-mono text-muted-foreground">
        <MessageSquareText aria-hidden className="size-3 shrink-0" />
        <span className="shrink-0">{label}</span>
        <span className="min-w-0 truncate opacity-70 group-open:hidden">— {text || "(empty)"}</span>
      </summary>
      <pre className="max-h-96 overflow-auto border-t border-dashed p-2 whitespace-pre-wrap wrap-anywhere">
        {text}
      </pre>
    </details>
  );
}

/**
 * Everything the model was given before it said a word: the system prompt the lane composed, and
 * the first user message — the card, with every hook's `<context>` block ahead of it.
 *
 * The hook lines say which hook added what; this is the request as a whole, which is the only
 * place to see what the model actually read and in what order.
 */
export function RunPromptView({ prompt }: { prompt: RunPrompt }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Message label="system" text={prompt.system} />
      <Message label="user" text={prompt.user} />
    </div>
  );
}

/** A finished run's opening, fetched when the run is opened. Draws nothing for an older run. */
export function StoredRunPrompt({ runId }: { runId: string }) {
  const stored = useQuery({
    queryKey: ["run-prompt", runId],
    queryFn: () => request(RunPromptDocument, { runId }),
    // What a run was started with never changes once it has started.
    staleTime: Number.POSITIVE_INFINITY,
  });
  const prompt = readRunPrompt(stored.data?.runs[0]?.prompt);
  return prompt ? <RunPromptView prompt={prompt} /> : null;
}
