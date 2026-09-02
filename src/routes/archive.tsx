import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive as ArchiveIcon, ChevronRight, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/action-button";
import { Page, useCurrentProject } from "@/components/app-shell";
import { ConfirmButton } from "@/components/confirm-button";
import { EmptyState, NoProject } from "@/components/empty-state";
import { QueryError } from "@/components/query-error";
import { RowSkeleton } from "@/components/row-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArchiveDocument,
  type ArchiveQuery,
  DeleteCardDocument,
  RestoreCardDocument,
} from "@/gql/graphql";
import { CARD_STATUS_CLASS, CARD_STATUS_VARIANT } from "@/lib/cards";
import { request } from "@/lib/gql";
import { useProjectId } from "@/lib/project";
import { cn } from "@/lib/utils";

type Archived = ArchiveQuery["cards"][number];

/**
 * The cards that have been put out of the way.
 *
 * An archived card keeps everything it had — its lane, its status, what the agent produced —
 * and this is the only place any of that can still be read. Restoring puts it back at the end
 * of the lane it names, which is why the lane is shown: it is where the card is going, not
 * just where it has been.
 *
 * The board is the working surface and this is not, so nothing here drags, runs or edits.
 * There are two things to do with an archived card, and they are the two buttons.
 */
export function ArchiveRoute() {
  const projectId = useProjectId();
  const project = useCurrentProject();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);

  const archive = useQuery({
    queryKey: ["archive", projectId],
    queryFn: () => request(ArchiveDocument, { projectId }),
    enabled: Boolean(projectId),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["archive", projectId] });
    // A restored card reappears on the board, and a deleted one stops being a dependency there.
    queryClient.invalidateQueries({ queryKey: ["board", projectId] });
  };
  const onError = (error: Error) => toast.error(error.message);

  const restore = useMutation({
    mutationFn: (cardId: string) => request(RestoreCardDocument, { cardId }),
    onSuccess: (data) => {
      const lane = archive.data?.cards.find((card) => card.id === data.restoreCard.id)?.lane?.name;
      toast.success(lane ? `Back at the end of ${lane}.` : "Back on the board.");
      refresh();
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => request(DeleteCardDocument, { id }),
    onSuccess: refresh,
    onError,
  });

  if (!projectId) {
    return (
      <Page title="Archive">
        <NoProject what="An archived card" />
      </Page>
    );
  }

  const cards = archive.data?.cards ?? [];

  return (
    <Page
      title="Archive"
      crumb={project?.name}
      description="Cards taken off the board, most recently archived first."
      actions={
        <Button variant="outline" onClick={refresh}>
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      }
    >
      {archive.isError ? (
        <QueryError error={archive.error} onRetry={() => archive.refetch()} what="the archive" />
      ) : null}
      {archive.isPending ? <RowSkeleton rows={3} /> : null}
      {cards.length === 0 && !archive.isPending && !archive.isError ? (
        <EmptyState
          icon={ArchiveIcon}
          title="Nothing is archived"
          description="Archiving a card takes it off the board without deleting it — the Done pile, once it is long enough to be in the way."
        />
      ) : null}

      {cards.map((card: Archived) => {
        const expanded = open === card.id;
        return (
          <Card key={card.id} className="gap-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-start gap-2 text-left"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : card.id)}
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
                    <Badge
                      variant={CARD_STATUS_VARIANT[card.status] ?? "secondary"}
                      className={CARD_STATUS_CLASS[card.status]}
                    >
                      {card.status}
                    </Badge>
                    <span className="truncate font-medium">{card.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {card.lane?.name ?? "(lane gone)"} ·{" "}
                      {card.archivedAt ? new Date(card.archivedAt).toLocaleString() : ""}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {card.error || card.result || card.body || "(nothing written down)"}
                  </p>
                </span>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                <ActionButton
                  variant="ghost"
                  size="icon"
                  label={`Restore ${card.title}`}
                  hint={`Put it back at the end of ${card.lane?.name ?? "its lane"}`}
                  disabled={restore.isPending && restore.variables === card.id}
                  onClick={() => restore.mutate(card.id)}
                >
                  <RotateCcw className="size-4" aria-hidden />
                </ActionButton>
                <ConfirmButton
                  variant="ghost"
                  size="icon"
                  label={`Delete ${card.title} for good`}
                  hint="Delete for good"
                  title={`Delete "${card.title}" for good?`}
                  description="This is the only place the card's result still exists. Deleting it also removes it as a dependency from anything that was waiting on it. There is no undo."
                  confirmLabel="Delete for good"
                  onConfirm={() => remove.mutate(card.id)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </ConfirmButton>
              </div>
            </div>

            {expanded ? (
              <div className="flex flex-col gap-2 border-t pt-3">
                {card.body ? (
                  <pre className="overflow-x-auto text-sm whitespace-pre-wrap">{card.body}</pre>
                ) : null}
                {card.result || card.error ? (
                  <pre className="overflow-x-auto text-sm whitespace-pre-wrap text-muted-foreground">
                    {card.error || card.result}
                  </pre>
                ) : null}
              </div>
            ) : null}
          </Card>
        );
      })}
    </Page>
  );
}
