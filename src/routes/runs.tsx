import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, History, RefreshCw, Square, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/action-button";
import { Page, useCurrentProject } from "@/components/app-shell";
import { ConfirmButton } from "@/components/confirm-button";
import { EmptyState, NoProject } from "@/components/empty-state";
import { QueryError } from "@/components/query-error";
import { RowSkeleton } from "@/components/row-skeleton";
import { RunStream } from "@/components/run-stream";
import { TokenStats } from "@/components/token-stats";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DeleteRunDocument,
  RunsDocument,
  type RunsQuery,
  StopCardDocument,
  StopTaskDocument,
} from "@/gql/graphql";
import { request } from "@/lib/gql";
import { useProjectId } from "@/lib/project";
import { compactTokens, duration, RUN_STATUS_VARIANT } from "@/lib/runs";
import { cn } from "@/lib/utils";

type Run = RunsQuery["runs"][number];

/**
 * How many runs are asked for at a time.
 *
 * One page more is requested than is drawn, which is how the button below knows there is
 * anything left: a hundredth row and a hundred-and-first looked identical, and a page that
 * stops without saying so reads as a server that has forgotten.
 */
const PAGE = 100;

/** What the run was about: a card by title, or the task it was refining or breaking up. */
const subject = (run: Run) => run.card?.title || run.task?.title || "(gone)";

/** Tool names as chips, red where the call failed. */
function ToolChips({ calls }: { calls: unknown }) {
  const tools = (calls ?? []) as { name: string; ok: boolean }[];
  if (tools.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tools.map((tool, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: a finished run's tool list never changes, and the same tool may appear in it twice
          key={`${tool.name}-${index}`}
          className={`rounded-md border px-2 py-0.5 font-mono text-xs ${
            tool.ok ? "text-muted-foreground" : "border-destructive text-destructive"
          }`}
        >
          {tool.name}
        </span>
      ))}
    </div>
  );
}

/**
 * Every execution, newest first.
 *
 * A run belongs either to a card or to a task, and stopping one goes through whichever it is —
 * the runner keys what is in flight by that subject, not by the run.
 */
export function RunsRoute() {
  const projectId = useProjectId();
  const project = useCurrentProject();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const runs = useQuery({
    // The limit is part of the key, so a longer page is its own entry rather than a refetch
    // that briefly empties the list. Every `invalidateQueries(["runs", projectId])` in the app
    // still matches it — the key is a prefix.
    queryKey: ["runs", projectId, limit],
    queryFn: () => request(RunsDocument, { projectId, limit: limit + 1 }),
    enabled: Boolean(projectId),
    // A run started elsewhere — by the worker, or by an agent over MCP — should show up without
    // a reload, and this page is cheap enough to poll.
    refetchInterval: 5000,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["runs", projectId] });
    queryClient.invalidateQueries({ queryKey: ["board", projectId] });
    queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
  };
  const onError = (error: Error) => toast.error(error.message);

  const remove = useMutation({
    mutationFn: (id: string) => request(DeleteRunDocument, { id }),
    onSuccess: refresh,
    onError,
  });

  const stop = useMutation({
    mutationFn: (run: Run) =>
      run.cardId
        ? request(StopCardDocument, { cardId: run.cardId }).then((data) => data.stopCard)
        : request(StopTaskDocument, { taskId: run.taskId ?? "" }).then((data) => data.stopTask),
    onSuccess: (stopped) => {
      // False means it had already finished on its own — the refresh is what shows that.
      if (stopped) toast.success("Stopping…");
      refresh();
    },
    onError,
  });

  const rows = runs.data?.runs ?? [];
  const more = rows.length > limit;
  const shown = more ? rows.slice(0, limit) : rows;

  if (!projectId) {
    return (
      <Page title="Runs">
        <NoProject what="A run" />
      </Page>
    );
  }

  return (
    <Page
      title="Runs"
      crumb={project?.name}
      description="Every execution, newest first."
      actions={
        <Button variant="outline" onClick={refresh}>
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      }
    >
      {runs.isError ? (
        <QueryError error={runs.error} onRetry={() => runs.refetch()} what="these runs" />
      ) : null}
      {runs.isPending ? <RowSkeleton rows={3} /> : null}
      {shown.length === 0 && !runs.isPending && !runs.isError ? (
        <EmptyState
          icon={History}
          title="Nothing has run yet"
          description="Every time an agent is asked to do anything — refine a task, or work a card — it shows up here."
        />
      ) : null}

      {shown.map((run) => {
        const expanded = open === run.id;
        const running = run.status === "running";
        return (
          <Card key={run.id} className="gap-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-start gap-2 text-left"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : run.id)}
              >
                <ChevronRight
                  className={cn(
                    "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
                    expanded && "rotate-90",
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={RUN_STATUS_VARIANT[run.status] ?? "secondary"}>
                      {run.status}
                    </Badge>
                    <Badge variant="outline">{run.kind}</Badge>
                    <span className="truncate font-medium">{subject(run)}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {run.agent?.name ? `${run.agent.name} · ` : ""}
                      {new Date(run.startedAt).toLocaleString()} ·{" "}
                      {duration(run.startedAt, run.finishedAt)}
                      {run.totalTokens ? ` · ${compactTokens(run.totalTokens)} tokens` : ""}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {run.error || run.output || "(no output)"}
                  </p>
                </span>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                {running ? (
                  <ActionButton
                    variant="ghost"
                    size="icon"
                    label="Stop this run"
                    disabled={stop.isPending}
                    onClick={() => stop.mutate(run)}
                  >
                    <Square className="size-4" aria-hidden />
                  </ActionButton>
                ) : null}
                <ConfirmButton
                  variant="ghost"
                  size="icon"
                  label="Delete this run"
                  hint={running ? "Stop the run before deleting it" : "Delete"}
                  disabled={running}
                  title="Delete this run?"
                  description="The output and the tool calls go. The card's ledger keeps the moves this run caused, and the totals are read from the rows that are left."
                  onConfirm={() => remove.mutate(run.id)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </ConfirmButton>
              </div>
            </div>

            {expanded ? (
              <div className="flex flex-col gap-2 border-t pt-3">
                {/* A run in flight has no stored output yet — this is the run itself, live. */}
                {running ? (
                  <RunStream runId={run.id} />
                ) : (
                  <>
                    {/* The split and the rate live here rather than in the row above, which is
                        a button: a tooltip trigger is a button too, and one cannot sit in the
                        other. */}
                    {run.totalTokens ? (
                      <TokenStats
                        usage={run}
                        seconds={
                          run.finishedAt
                            ? (new Date(run.finishedAt).getTime() -
                                new Date(run.startedAt).getTime()) /
                              1000
                            : null
                        }
                        className="self-start"
                      />
                    ) : null}
                    <ToolChips calls={run.toolCalls} />
                    <pre className="overflow-x-auto text-sm whitespace-pre-wrap">
                      {run.error || run.output || "(no output)"}
                    </pre>
                  </>
                )}
              </div>
            ) : null}
          </Card>
        );
      })}

      {more ? (
        <Button variant="outline" className="self-center" onClick={() => setLimit(limit + PAGE)}>
          Show {PAGE} more
        </Button>
      ) : null}
    </Page>
  );
}
