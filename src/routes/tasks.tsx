import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { SquarePlus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Page } from "@/components/app-shell";
import { Spend } from "@/components/spend";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DeleteTaskDocument, MakeCardDocument, TasksDocument } from "@/gql/graphql";
import { request } from "@/lib/gql";
import { useProjectId } from "@/lib/project";

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
                  <Button
                    variant="ghost"
                    size="icon"
                    title={
                      task.brief ? "Make a card at the front door" : "Nothing to make a card of"
                    }
                    disabled={!task.brief.trim() || make.isPending}
                    onClick={() => make.mutate(task.id)}
                  >
                    <SquarePlus className="size-4" />
                  </Button>
                )}
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
