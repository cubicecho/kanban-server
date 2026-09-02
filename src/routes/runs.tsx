import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Square, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Page } from "@/components/app-shell";
import { RunStream } from "@/components/run-stream";
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
import { duration, RUN_STATUS_VARIANT } from "@/lib/runs";

type Run = RunsQuery["runs"][number];

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
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);

  const runs = useQuery({
    queryKey: ["runs", projectId],
    queryFn: () => request(RunsDocument, { projectId }),
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

  if (!projectId) {
    return (
      <Page title="Runs" description="Pick a project first.">
        <p className="text-sm text-muted-foreground">No project selected.</p>
      </Page>
    );
  }

  return (
    <Page
      title="Runs"
      description="Every execution, newest first."
      actions={
        <Button variant="outline" onClick={refresh}>
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      }
    >
      {runs.data?.runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing has run yet.</p>
      ) : null}

      {runs.data?.runs.map((run) => {
        const expanded = open === run.id;
        const running = run.status === "running";
        return (
          <Card key={run.id} className="gap-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => setOpen(expanded ? null : run.id)}
              >
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
                    {run.totalTokens ? ` · ${run.totalTokens} tokens` : ""}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {run.error || run.output || "(no output)"}
                </p>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                {running ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Stop this run"
                    disabled={stop.isPending}
                    onClick={() => stop.mutate(run)}
                  >
                    <Square className="size-4" />
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  title={running ? "Stop the run before deleting" : "Delete"}
                  disabled={running}
                  onClick={() => remove.mutate(run.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>

            {expanded ? (
              <div className="flex flex-col gap-2 border-t pt-3">
                {/* A run in flight has no stored output yet — this is the run itself, live. */}
                {running ? (
                  <RunStream runId={run.id} />
                ) : (
                  <>
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
    </Page>
  );
}
