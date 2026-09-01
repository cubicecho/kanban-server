import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Page } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AcceptTaskDocument,
  DecomposeTaskDocument,
  DeleteTaskDocument,
  TasksDocument,
} from "@/gql/graphql";
import { request } from "@/lib/gql";
import { useProjectId } from "@/lib/project";

const STATUS_VARIANT = {
  error: "destructive",
  decomposing: "outline",
  draft: "outline",
  ready: "secondary",
  decomposed: "secondary",
} as const;

/**
 * What has been asked for, and what became of it.
 *
 * The cards are the work and this is the record of where they came from — which is the thing a
 * board on its own cannot tell you: two dozen cards, and no way to see that eight of them were
 * one sentence somebody typed on Tuesday.
 */
export function TasksRoute() {
  const projectId = useProjectId();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);

  const tasks = useQuery({
    queryKey: ["tasks", projectId],
    queryFn: () => request(TasksDocument, { projectId }),
    enabled: Boolean(projectId),
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    queryClient.invalidateQueries({ queryKey: ["board", projectId] });
  };
  const onError = (error: Error) => toast.error(error.message);

  const decompose = useMutation({
    mutationFn: async (taskId: string) => {
      await request(AcceptTaskDocument, { taskId });
      return request(DecomposeTaskDocument, { taskId });
    },
    onSuccess: (run) => {
      if (run.decomposeTask.status === "ok") toast.success("On the board");
      else toast.error(run.decomposeTask.error || "The decomposer failed.");
      refresh();
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => request(DeleteTaskDocument, { id }),
    onSuccess: refresh,
    onError,
  });

  if (!projectId) {
    return (
      <Page title="Tasks" description="Pick a project first.">
        <p className="text-sm text-muted-foreground">No project selected.</p>
      </Page>
    );
  }

  return (
    <Page title="Tasks" description="What was asked for, and the cards it became.">
      {tasks.data?.tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing asked for yet.</p>
      ) : null}

      {tasks.data?.tasks.map((task) => {
        const expanded = open === task.id;
        return (
          <Card key={task.id} className="gap-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => setOpen(expanded ? null : task.id)}
              >
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[task.status] ?? "secondary"}>{task.status}</Badge>
                  <span className="truncate font-medium">{task.title || "Untitled task"}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {task.cards.length} card{task.cards.length === 1 ? "" : "s"} ·{" "}
                    {new Date(task.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {task.error || task.brief || "(no brief)"}
                </p>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  title={task.brief ? "Decompose into cards" : "No brief to decompose"}
                  disabled={!task.brief.trim() || decompose.isPending}
                  onClick={() => decompose.mutate(task.id)}
                >
                  <Sparkles className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Delete the task — its cards stay"
                  onClick={() => remove.mutate(task.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>

            {expanded ? (
              <div className="flex flex-col gap-3 border-t pt-3">
                <pre className="overflow-x-auto text-sm whitespace-pre-wrap">
                  {task.brief || "(no brief)"}
                </pre>
                {task.cards.length ? (
                  <ul className="flex flex-col gap-1">
                    {task.cards.map((card) => (
                      <li key={card.id} className="flex items-center gap-2 text-sm">
                        <Badge variant="secondary">{card.status}</Badge>
                        {card.title}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {task.messages.length ? (
                  <div className="flex flex-col gap-2 border-t pt-3">
                    {task.messages.map((message) => (
                      <p
                        key={message.id}
                        className={
                          message.role === "user"
                            ? "self-end rounded-lg bg-accent px-3 py-2 text-sm whitespace-pre-wrap"
                            : "text-sm whitespace-pre-wrap text-muted-foreground"
                        }
                      >
                        {message.content}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </Card>
        );
      })}
    </Page>
  );
}
