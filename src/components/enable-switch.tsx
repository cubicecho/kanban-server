import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * The switch that turns one of a list of things on and off.
 *
 * Agents and MCP servers both have one, and both had to remember the same two things about it:
 * a `title` on a Radix switch is a hint the accessibility tree never reads, so the name has to
 * be said outright; and the label names the *action*, not the state — a toggle reading "Enable"
 * while it is on is the one thing a toggle must not do.
 */
export function EnableSwitch({
  enabled,
  onChange,
  name,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  /** What is being switched, for the label: "Disable Reviewer".  */
  name: string;
}) {
  const action = enabled ? "Disable" : "Enable";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Switch checked={enabled} onCheckedChange={onChange} aria-label={`${action} ${name}`} />
      </TooltipTrigger>
      <TooltipContent>{action}</TooltipContent>
    </Tooltip>
  );
}
