import { useQuery } from "@tanstack/react-query";
import { SpendDocument } from "@/gql/graphql";
import { request } from "@/lib/gql";

/** 1234 → "1.2k". A board's totals get long, and nobody reads the last three digits. */
function compact(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return String(tokens);
}

const date = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/**
 * What this has cost, where the decision to spend more is made.
 *
 * The number is added up from the run rows each time it is asked for, not kept in a counter, so
 * it says the same thing the Runs page does. That also means retention can take runs out from
 * under it — which is why `from` is on the label rather than the window that was asked for: the
 * total covers the runs that still exist, and it says which ones those are.
 */
export function Spend({
  projectId,
  taskId,
  days = 30,
}: {
  projectId: string;
  taskId?: string;
  days?: number;
}) {
  const spend = useQuery({
    queryKey: ["spend", projectId, taskId ?? "", days],
    queryFn: () => request(SpendDocument, { projectId, taskId: taskId ?? null, days }),
    enabled: Boolean(projectId),
  });

  const total = spend.data?.spend;
  if (!total || total.runs === 0) return null;

  const kept =
    total.retentionDays > 0
      ? `Runs are kept ${total.retentionDays} days, so anything older is not in this.`
      : "Every run is kept, so this is the whole history.";

  return (
    <span
      className="text-xs text-muted-foreground"
      title={`${total.promptTokens.toLocaleString()} prompt + ${total.completionTokens.toLocaleString()} completion tokens over ${total.runs} run${total.runs === 1 ? "" : "s"}. Added up from the runs themselves. ${kept}`}
    >
      {compact(total.totalTokens)} tokens · {total.runs} run{total.runs === 1 ? "" : "s"}
      {total.from ? ` · since ${date(total.from)}` : ""}
    </span>
  );
}
