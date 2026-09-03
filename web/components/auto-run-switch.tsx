import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PauseCircle } from "lucide-react";
import { toast } from "sonner";
import { type ProjectsQuery, UpdateProjectDocument } from "@/__generated__/graphql";
import { LiveDot } from "@/components/live-dot";
import { toneSurface } from "@/components/status-badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { request } from "@/lib/gql";
import { toastError } from "@/lib/toast";
import { cn } from "@/lib/utils";

type Project = ProjectsQuery["projects"][number];

/**
 * Whether this board picks cards up by itself.
 *
 * `autoRun` was reachable only through project settings, which is where a thing you decide once
 * belongs — and this is not that. A board working on the wrong understanding of what you wanted
 * is stopped in a hurry, from whatever page you noticed it on, and a dialog behind two clicks
 * stands between the noticing and the stopping.
 *
 * The update is optimistic because a switch that does not move until a round trip lands reads as
 * a switch that did not work. Everything that shows `autoRun` reads this same query, so they all
 * turn over together.
 *
 * It is drawn as a pill in the status tones rather than as a bare switch and a grey `text-xs`
 * word. The strip it sits on is `bg-muted/40`, so a muted label on it was one step of lightness
 * against the background — and the state it drew faintest was `Paused`, which is the one worth
 * noticing: a board that is not going to do anything until somebody says so. So paused takes the
 * amber the badges use for "this is waiting on you" and says it with an icon as well as a word,
 * and running takes the green and the pulse a run wears everywhere else. Two tones and no more,
 * for the reason the badges have two.
 */
export function AutoRunSwitch({ project }: { project: Project }) {
  const queryClient = useQueryClient();

  const toggle = useMutation({
    mutationFn: (autoRun: boolean) =>
      request(UpdateProjectDocument, { id: project.id, set: { autoRun } }),
    onMutate: async (autoRun) => {
      await queryClient.cancelQueries({ queryKey: ["projects"] });
      const previous = queryClient.getQueryData<ProjectsQuery>(["projects"]);
      if (previous) {
        queryClient.setQueryData<ProjectsQuery>(["projects"], {
          projects: previous.projects.map((row) =>
            row.id === project.id ? { ...row, autoRun } : row,
          ),
        });
      }
      return { previous };
    },
    // Pausing stops the worker picking anything else up; it does not reach into a run already
    // going. Somebody hitting this to stop a board wants told which of the two they just got.
    onSuccess: (_result, autoRun) =>
      toast.success(
        autoRun
          ? "On auto — cards are picked up as they land."
          : "Paused. Cards already running will finish; nothing new is picked up.",
      ),
    onError: (error: Error, _autoRun, context) => {
      if (context?.previous) queryClient.setQueryData(["projects"], context.previous);
      toastError(error);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });

  const on = project.autoRun;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex items-center gap-2 rounded-full border py-1 pr-1.5 pl-2.5",
            toneSurface(on ? "running" : "attention"),
          )}
        >
          {on ? <LiveDot /> : <PauseCircle className="size-3.5" aria-hidden />}
          <Label htmlFor="auto-run" className="font-medium text-sm">
            {on ? "Auto-run" : "Paused"}
          </Label>
          <Switch
            id="auto-run"
            checked={on}
            onCheckedChange={(next) => toggle.mutate(next)}
            // The track's own off colour is `bg-input`, which on a tinted pill is barely a
            // shape. Off is the state this control most has to be readable in.
            className="data-unchecked:bg-status-rejected-foreground/50 dark:data-unchecked:bg-status-rejected-foreground/40"
            // Naming the action rather than the state, which is the switch's own job to say.
            aria-label={on ? `Pause ${project.name}` : `Let ${project.name} run itself`}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {on
          ? "Cards in a lane with an agent are picked up on their own. Pause to stop that."
          : "Cards sit where they are put and run when you ask. Switch on to work the board."}
      </TooltipContent>
    </Tooltip>
  );
}
