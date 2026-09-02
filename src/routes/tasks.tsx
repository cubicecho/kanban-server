import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight, ListChecks, SquarePlus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/action-button";
import { Page, useCurrentProject } from "@/components/app-shell";
import { ConfirmButton } from "@/components/confirm-button";
import { EmptyState, NoProject } from "@/components/empty-state";
import { QueryError } from "@/components/query-error";
import { RowSkeleton } from "@/components/row-skeleton";
import { Spend } from "@/components/spend";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DeleteTaskDocument, MakeCardDocument, TasksDocument } from "@/gql/graphql";
import { request } from "@/lib/gql";
import { useProjectId } from "@/lib/project";
import { cn } from "@/lib/utils";

/**
 * What has been asked for, and what became of it.
 *
 * The cards are the work and this is the record of where they came from — which is the thing a
 * board on its own cannot tell you: two dozen cards, and no way to see that eight of them were
 * one sentence somebody typed on Tuesday.
 *
 * A task has no status of its own. Whether a conversation produced work is the card pointing
 * back at it, which is a fact about the board rather than a second copy of one — and the reason
 * this page shows the cards rather than a word about them.
 */
export function TasksRoute() {
  const projectId = useProjectId();
  const project = useCurrentProject();
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
    queryClient.invalidateQueries({ queryKey: ["spend"] });
  };
  const onError = (error: Error) => toast.error(error.message);

  // One card, at the front door. What happens to it next is the board's business: land it in
  // a lane that expands and it becomes the cards that carry the work out.
  const make = useMutation({
    mutationFn: (taskId: string) => request(MakeCardDocument, { taskId }),
    onSuccess: () => {
      toast.success("On the board");
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
      <Page title="Tasks">
        <NoProject what="A task" />
      </Page>
    );
  }

  return (
    <Page
      title="Tasks"
      crumb={project?.name}
      description="What was asked for, and the cards it became."
    >
      {tasks.isError ? (
        <QueryError error={tasks.error} onRetry={() => tasks.refetch()} what="these tasks" />
      ) : null}
      {tasks.isPending ? <RowSkeleton rows={3} /> : null}
      {tasks.data?.tasks.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Nothing asked for yet"
          description="Describe something on the New task page and it lands here, along with whatever cards it became."
          action={
            <Button asChild>
              <Link to="/">New task</Link>
            </Button>
          }
        />
      ) : null}

      {tasks.data?.tasks.map((task) => {
        const expanded = open === task.id;
        return (
          <Card key={task.id} className="gap-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-start gap-2 text-left"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : task.id)}
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
                    <Badge variant={task.cards.length ? "secondary" : "outline"}>
                      {task.cards.length ? "on the board" : "being talked about"}
                    </Badge>
                    <span className="truncate font-medium">{task.title || "Untitled task"}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {task.cards.length} card{task.cards.length === 1 ? "" : "s"} ·{" "}
                      {new Date(task.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {task.brief || "(no brief)"}
                  </p>
                </span>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                {/* Only while the conversation has not reached the board. Making a second card
                    out of the same thread is a thing somebody means to do rarely and almost
                    never means to do by pressing the button twice. */}
                {task.cards.length ? (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/board">On the board</Link>
                  </Button>
                ) : (
                  <ActionButton
                    variant="ghost"
                    size="icon"
                    label="Make a card"
                    hint={
                      task.brief.trim()
                        ? "Make a card at the front door"
                        : "There is no brief to make a card of"
                    }
                    disabled={!task.brief.trim() || make.isPending}
                    onClick={() => make.mutate(task.id)}
                  >
                    <SquarePlus className="size-4" aria-hidden />
                  </ActionButton>
                )}
                <ConfirmButton
                  variant="ghost"
                  size="icon"
                  label="Delete this task"
                  hint="Delete"
                  title="Delete this task?"
                  description={
                    task.cards.length
                      ? `The ${task.cards.length} card${task.cards.length === 1 ? "" : "s"} it became stay on the board. The conversation behind them goes.`
                      : "The conversation goes. Nothing has come of it yet."
                  }
                  onConfirm={() => remove.mutate(task.id)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </ConfirmButton>
              </div>
            </div>

            {expanded ? (
              <div className="flex flex-col gap-3 border-t pt-3">
                <pre className="overflow-x-auto text-sm whitespace-pre-wrap">
                  {task.brief || "(no brief)"}
                </pre>
                {/* Beside the cards, because the cards are where the tokens went: a task's
                    total is its refinement and every run of every card it became. */}
                <Spend projectId={projectId} taskId={task.id} days={0} />
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
