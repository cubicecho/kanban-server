import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { compactTokens } from "@/lib/runs";
import { cn } from "@/lib/utils";

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * What one run has cost, drawn the same way whether it is happening or finished.
 *
 * The compact total is what a person glances at; the split between what was sent and what came
 * back is what tells them *why* — a run that spent ninety per cent of itself on prompt is a
 * context problem, and one that spent it on completion is a model talking too long. That
 * difference was in the database from the first run and has never been shown anywhere.
 *
 * `seconds` is only known for a run that has ended, and the rate is the completion tokens over
 * it: prompt tokens are not generated, so counting them would flatter a long context into
 * looking fast.
 */
export function TokenStats({
  usage,
  seconds,
  className,
}: {
  usage: Usage;
  seconds?: number | null;
  className?: string;
}) {
  const rate = seconds && seconds > 0 ? Math.round(usage.completionTokens / seconds) : 0;
  return (
    <Tooltip>
      <TooltipTrigger className={cn("text-muted-foreground text-xs", className)}>
        {compactTokens(usage.totalTokens)} tokens
      </TooltipTrigger>
      <TooltipContent>
        {usage.promptTokens.toLocaleString()} prompt + {usage.completionTokens.toLocaleString()}{" "}
        completion = {usage.totalTokens.toLocaleString()} tokens
        {rate ? ` · ${rate.toLocaleString()} completion tokens a second` : ""}
      </TooltipContent>
    </Tooltip>
  );
}
