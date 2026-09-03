import { useQuery } from "@tanstack/react-query";
import { AutoRunSwitch } from "@/components/auto-run-switch";
import { LiveDot } from "@/components/live-dot";
import { Spend } from "@/components/spend";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ActiveRunsDocument, type ProjectsQuery } from "@/gql/graphql";
import { request } from "@/lib/gql";
import { useProjectId } from "@/lib/project";
import { plural } from "@/lib/text";

type Project = ProjectsQuery["projects"][number];

/**
 * How much of this project is in flight, for the badge on Runs and the strip under the header.
 *
 * A run started by the worker, or by an agent over MCP, is the one thing that happens on this
 * server without anybody here asking for it — and nothing outside the board and the composer
 * said so. It is the query both of those already keep, so a page that is watching a run pays
 * nothing for this, and it stops polling the moment there is nothing to count.
 */
export function useRunningCount() {
  const projectId = useProjectId();
  const active = useQuery({
    queryKey: ["active-runs", projectId],
    queryFn: () => request(ActiveRunsDocument, { projectId }),
    enabled: Boolean(projectId),
    refetchInterval: 5000,
  });
  return active.data?.runs.length ?? 0;
}

/**
 * What is true of the project rather than of the page: whether it is working, how much of it is
 * working right now, and what that has cost.
 *
 * These three were spread over two pages and a dialog. Whether a board runs itself was behind
 * project settings, which is where you put a thing decided once — but a board going at the wrong
 * work is stopped in a hurry, and it is noticed from wherever you happen to be rather than from
 * the one page that could stop it. The spend was on Board and Status alone, so the number you
 * check before letting a board spend more was absent from Runs, which is where you go to see
 * what it spent it on.
 *
 * So they sit in the frame, on every page that is about a project, and they are the same three
 * on each. It is a strip under the heading rather than more buttons in it because the heading
 * says what page you are looking at and this says what board you are looking at it from.
 *
 * The count in the middle is here for the switch beside it: pausing stops the next card being
 * picked up and does nothing to the ones already going, and "3 running" next to the switch is
 * what makes that visible at the moment somebody reaches for it.
 */
export function ProjectBar({ project }: { project: Project }) {
  const running = useRunningCount();

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b bg-muted/40 px-6 py-1.5">
      <AutoRunSwitch project={project} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {running ? (
          <Tooltip>
            <TooltipTrigger className="inline-flex items-center gap-1.5 text-status-running text-xs">
              <LiveDot className="size-1.5" />
              {plural(running, "run")} in flight
            </TooltipTrigger>
            <TooltipContent>
              {project.autoRun
                ? "Pausing leaves these to finish — it only stops the next card being picked up."
                : "Started by hand, or still going from before this board was paused."}
            </TooltipContent>
          </Tooltip>
        ) : null}
        <Spend projectId={project.id} />
      </div>
    </div>
  );
}
