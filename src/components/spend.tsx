import { useQuery } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SpendDocument } from "@/gql/graphql";
import { request } from "@/lib/gql";
import { compactTokens } from "@/lib/runs";

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

  // The breakdown was a `title`, which is a slow browser tooltip no keyboard reaches — and
  // this is the one number in the app a person squints at before deciding to spend more.
  return (
    <Tooltip>
      <TooltipTrigger className="text-muted-foreground text-xs">
        {compactTokens(total.totalTokens)} tokens · {total.runs} run{total.runs === 1 ? "" : "s"}
        {total.from ? ` · since ${date(total.from)}` : ""}
      </TooltipTrigger>
      <TooltipContent>
        {total.promptTokens.toLocaleString()} prompt + {total.completionTokens.toLocaleString()}{" "}
        completion tokens over {total.runs} run{total.runs === 1 ? "" : "s"}. Added up from the runs
        themselves. {kept}
      </TooltipContent>
    </Tooltip>
  );
}
