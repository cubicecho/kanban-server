import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ListChecks, SquarePlus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/action-button";
import { Page, useCurrentProject } from "@/components/app-shell";
import { ConfirmButton } from "@/components/confirm-button";
import { DisclosureRow } from "@/components/disclosure-row";
import { EmptyState, NoProject } from "@/components/empty-state";
import { MetaLine } from "@/components/meta-line";
import { QueryError } from "@/components/query-error";
import { RowSkeleton } from "@/components/row-skeleton";
import { ShowMore } from "@/components/show-more";
import { Spend } from "@/components/spend";
import { CardStatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteTaskDocument, MakeCardDocument, TasksDocument } from "@/gql/graphql";
import { request } from "@/lib/gql";
import { useProjectId } from "@/lib/project";
import { plural } from "@/lib/text";

/**
 * How many conversations are asked for at a time — one more than is drawn, as on Runs and in the
 * archive, so that the end of the page can be told from the end of the list.
 *
 * Smaller than either of those, because a task carries its whole message thread: a hundred of
 * these is a hundred transcripts, and this was the one list in the app that asked for all of them.
 */
const PAGE = 25;

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
  const [limit, setLimit] = useState(PAGE);

  const tasks = useQuery({
    // A prefix of the key everything else invalidates, as on Runs, so a longer page still
    // refreshes rather than becoming an entry nothing updates.
    queryKey: ["tasks", projectId, limit],
    queryFn: () => request(TasksDocument, { projectId, limit: limit + 1 }),
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

  const rows = tasks.data?.tasks ?? [];
  const more = rows.length > limit;
  const shown = more ? rows.slice(0, limit) : rows;

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
      {shown.length === 0 && !tasks.isPending && !tasks.isError ? (
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

      {shown.map((task) => {
        // Where "on the board" actually goes: a card that is still on it. All of them archived
        // and the link would scroll to nothing, so it says so instead.
        const onBoard = task.cards.find((card) => !card.archivedAt);
        return (
          <DisclosureRow
            key={task.id}
            open={open === task.id}
            onOpenChange={(next) => setOpen(next ? task.id : null)}
            badges={
              <Badge variant={task.cards.length ? "secondary" : "outline"}>
                {task.cards.length ? "on the board" : "being talked about"}
              </Badge>
            }
            title={task.title || "Untitled task"}
            meta={
              <MetaLine
                className="shrink-0"
                parts={[
                  plural(task.cards.length, "card"),
                  new Date(task.createdAt).toLocaleString(),
                ]}
              />
            }
            summary={task.brief || "(no brief)"}
            actions={
              <>
                {/* A conversation is not finished when it produces a card, and until now there
                    was no way back into one: the composer opened whichever task had no cards
                    yet, and everything else was read-only history. */}
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/" search={{ task: task.id }}>
                    Continue
                  </Link>
                </Button>
                {/* Making a second card out of the same thread is a thing somebody means to do
                    rarely and almost never means to do by pressing the button twice. */}
                {task.cards.length ? (
                  <Button variant="ghost" size="sm" asChild>
                    {/* At the card, not merely at the board — the board draws five lanes and up
                        to five hundred cards, and "it is somewhere over there" is not an answer. */}
                    <Link to="/board" search={onBoard ? { card: onBoard.id } : {}}>
                      {onBoard ? "On the board" : "In the archive"}
                    </Link>
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
                      ? `The ${plural(task.cards.length, "card")} it became stay on the board. The conversation behind them goes.`
                      : "The conversation goes. Nothing has come of it yet."
                  }
                  onConfirm={() => remove.mutate(task.id)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </ConfirmButton>
              </>
            }
          >
            <pre className="overflow-x-auto text-sm whitespace-pre-wrap">
              {task.brief || "(no brief)"}
            </pre>
            {/* Beside the cards, because the cards are where the tokens went: a task's total is
                its refinement and every run of every card it became. */}
            <Spend projectId={projectId} taskId={task.id} days={0} />
            {task.cards.length ? (
              <ul className="flex flex-col gap-1">
                {task.cards.map((card) => (
                  <li key={card.id} className="flex items-center gap-2 text-sm">
                    <CardStatusBadge status={card.status} />
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
          </DisclosureRow>
        );
      })}

      {more ? <ShowMore count={PAGE} onMore={() => setLimit(limit + PAGE)} /> : null}
    </Page>
  );
}
