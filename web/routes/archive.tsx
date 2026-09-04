import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive as ArchiveIcon, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArchiveDocument,
  type ArchiveQuery,
  DeleteCardDocument,
  RestoreCardDocument,
} from "@/__generated__/graphql";
import { ActionButton } from "@/components/action-button";
import { Page, useCurrentProject } from "@/components/app-shell";
import { ConfirmButton } from "@/components/confirm-button";
import { DisclosureRow } from "@/components/disclosure-row";
import { EmptyState, NoProject } from "@/components/empty-state";
import { MetaLine } from "@/components/meta-line";
import { QueryState } from "@/components/query-state";
import { ShowMore } from "@/components/show-more";
import { CardStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { request } from "@/lib/gql";
import { useProjectId } from "@/lib/project";
import { toastError } from "@/lib/toast";

type Archived = ArchiveQuery["cards"][number];

/** As on Runs: one more is asked for than is drawn, so the end of the page is not the end. */
const PAGE = 100;

/**
 * The cards that have been put out of the way.
 *
 * An archived card keeps everything it had — its lane, its status, everything ever said about
 * it — and this is the only place any of that can still be read. Restoring puts it back at
 * the end of the lane it names, which is why the lane is shown: it is where the card is
 * going, not just where it has been.
 *
 * The board is the working surface and this is not, so nothing here drags, runs or edits.
 * There are two things to do with an archived card, and they are the two buttons.
 */
export function ArchiveRoute() {
  const projectId = useProjectId();
  const project = useCurrentProject();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const archive = useQuery({
    // A prefix of the key everything else invalidates, so a longer page still refreshes.
    queryKey: ["archive", projectId, limit],
    queryFn: () => request(ArchiveDocument, { projectId, limit: limit + 1 }),
    enabled: Boolean(projectId),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["archive", projectId] });
    // A restored card reappears on the board, and a deleted one stops being a dependency there.
    queryClient.invalidateQueries({ queryKey: ["board", projectId] });
  };

  const restore = useMutation({
    mutationFn: (cardId: string) => request(RestoreCardDocument, { cardId }),
    onSuccess: (data) => {
      const lane = archive.data?.cards.find((card) => card.id === data.restoreCard.id)?.lane?.name;
      toast.success(lane ? `Back at the end of ${lane}.` : "Back on the board.");
      refresh();
    },
    onError: toastError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => request(DeleteCardDocument, { id }),
    onSuccess: refresh,
    onError: toastError,
  });

  if (!projectId) {
    return (
      <Page title="Archive">
        <NoProject what="An archived card" />
      </Page>
    );
  }

  const rows = archive.data?.cards ?? [];
  const more = rows.length > limit;
  const cards = more ? rows.slice(0, limit) : rows;

  return (
    <Page
      title="Archive"
      project={project}
      description="Cards taken off the board, most recently archived first."
      actions={
        <Button variant="outline" onClick={refresh}>
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      }
    >
      <QueryState
        query={archive}
        what="the archive"
        rows={3}
        count={cards.length}
        empty={
          <EmptyState
            icon={ArchiveIcon}
            title="Nothing is archived"
            description="Archiving a card takes it off the board without deleting it — the Done pile, once it is long enough to be in the way."
          />
        }
      />

      {cards.map((card: Archived) => (
        <DisclosureRow
          key={card.id}
          open={open === card.id}
          onOpenChange={(next) => setOpen(next ? card.id : null)}
          badges={<CardStatusBadge status={card.status} />}
          title={card.title}
          meta={
            <MetaLine
              className="shrink-0"
              parts={[
                card.lane?.name ?? "(lane gone)",
                card.archivedAt ? new Date(card.archivedAt).toLocaleString() : null,
              ]}
            />
          }
          description={card.error || card.body || "(nothing written down)"}
          action={
            <>
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
                description="This is the only place the card and everything said about it still exists. Deleting it also removes it as a dependency from anything that was waiting on it. There is no undo."
                confirmLabel="Delete for good"
                onConfirm={() => remove.mutate(card.id)}
              >
                <Trash2 className="size-4" aria-hidden />
              </ConfirmButton>
            </>
          }
          content={
            <>
              {card.body ? (
                <pre className="overflow-x-auto text-sm whitespace-pre-wrap">{card.body}</pre>
              ) : null}
              {card.error ? (
                <pre className="overflow-x-auto text-sm whitespace-pre-wrap text-muted-foreground">
                  {card.error}
                </pre>
              ) : null}
            </>
          }
        />
      ))}

      {more ? <ShowMore count={PAGE} onMore={() => setLimit(limit + PAGE)} /> : null}
    </Page>
  );
}
