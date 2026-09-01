import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  Square,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Page } from "@/components/app-shell";
import { CardDialog } from "@/components/card-dialog";
import { LaneDialog } from "@/components/lane-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AgentsDocument,
  BoardDocument,
  type BoardQuery,
  DeleteCardDocument,
  DeleteLaneDocument,
  MoveCardDocument,
  ProjectsDocument,
  RetryCardDocument,
  RunCardDocument,
  StopCardDocument,
} from "@/gql/graphql";
import { request } from "@/lib/gql";
import { useProjectId } from "@/lib/project";

type Lane = BoardQuery["lanes"][number];
type BoardCard = BoardQuery["cards"][number];

const STATUS_VARIANT = {
  error: "destructive",
  running: "outline",
  blocked: "outline",
  done: "secondary",
  idle: "secondary",
} as const;

/**
 * The board: lanes across, cards down, and the pipeline drawn between them.
 *
 * Cards are moved with the arrows rather than dragged. Dragging is what everyone expects of a
 * kanban board and it is also a drag-and-drop library, a touch story and a keyboard story — and
 * a card here mostly moves because an agent finished with it, not because someone pushed it.
 * The arrows are honest about that, and they work everywhere.
 */
export function BoardRoute() {
  const projectId = useProjectId();
  const queryClient = useQueryClient();
  const [editingCard, setEditingCard] = useState<{ card?: BoardCard; laneId: string } | null>(null);
  const [editingLane, setEditingLane] = useState<{ lane?: Lane } | null>(null);

  const projects = useQuery({ queryKey: ["projects"], queryFn: () => request(ProjectsDocument) });
  const project = projects.data?.projects.find((row) => row.id === projectId);

  const board = useQuery({
    queryKey: ["board", projectId],
    queryFn: () => request(BoardDocument, { projectId }),
    enabled: Boolean(projectId),
    // A card an agent is working changes without anyone here doing anything.
    refetchInterval: 3000,
  });
  const agents = useQuery({ queryKey: ["agents"], queryFn: () => request(AgentsDocument) });
  const agentName = (id?: string | null) =>
    agents.data?.agents.find((agent) => agent.id === id)?.name;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["board", projectId] });
  const onError = (error: Error) => toast.error(error.message);

  const move = useMutation({
    mutationFn: (variables: { cardId: string; laneId: string }) =>
      request(MoveCardDocument, { ...variables, position: null }),
    onSuccess: refresh,
    onError,
  });

  const run = useMutation({
    mutationFn: (cardId: string) => request(RunCardDocument, { cardId }),
    onSuccess: (result) => {
      if (result.runCard.status !== "ok") toast.error(result.runCard.error || "The agent failed.");
      refresh();
    },
    onError,
  });

  const stop = useMutation({
    mutationFn: (cardId: string) => request(StopCardDocument, { cardId }),
    onSuccess: (result) => {
      if (result.stopCard) toast.success("Stopping…");
      refresh();
    },
    onError,
  });

  // A card a reviewer rejected sits in `error` on purpose, and nothing but a person gets it
  // out. Moving it does too, which is why this exists: the move that retries a card in Doing is
  // a move to the lane it is already in, and nobody finds that.
  const retry = useMutation({
    mutationFn: (cardId: string) => request(RetryCardDocument, { cardId }),
    onSuccess: refresh,
    onError,
  });

  const removeCard = useMutation({
    mutationFn: (id: string) => request(DeleteCardDocument, { id }),
    onSuccess: refresh,
    onError,
  });

  const removeLane = useMutation({
    mutationFn: (id: string) => request(DeleteLaneDocument, { id }),
    onSuccess: refresh,
    onError,
  });

  const lanes = board.data?.lanes ?? [];
  const cards = board.data?.cards ?? [];
  const title = (cardId: string) => cards.find((card) => card.id === cardId)?.title ?? "";

  if (!projectId) {
    return (
      <Page title="Board" description="Pick a project first.">
        <p className="text-sm text-muted-foreground">No project selected.</p>
      </Page>
    );
  }

  return (
    <Page
      title={project?.name ?? "Board"}
      description={
        project?.autoRun
          ? "On auto — cards are picked up as they land."
          : "Manual — cards run when you ask them to."
      }
      wide
      actions={
        <Button variant="outline" onClick={() => setEditingLane({})}>
          <Plus className="size-4" />
          Lane
        </Button>
      }
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {lanes.map((lane, index) => {
          const here = cards.filter((card) => card.laneId === lane.id);
          const previous = lanes[index - 1];
          const next = lanes[index + 1];
          return (
            <section key={lane.id} className="flex w-72 shrink-0 flex-col gap-2">
              <header className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold">
                    {lane.name}
                    <span className="ml-2 text-muted-foreground">{here.length}</span>
                  </h2>
                  <p className="truncate text-xs text-muted-foreground">
                    {agentName(lane.agentId) ?? "no agent"}
                    {lane.intake ? " · intake" : ""}
                  </p>
                </div>
                <div className="flex shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Add a card"
                    onClick={() => setEditingCard({ laneId: lane.id })}
                  >
                    <Plus className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Edit this lane"
                    onClick={() => setEditingLane({ lane })}
                  >
                    <Settings2 className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title={here.length ? "Empty the lane first" : "Delete this lane"}
                    disabled={here.length > 0}
                    onClick={() => removeLane.mutate(lane.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </header>

              <div className="flex flex-col gap-2">
                {here.map((card) => (
                  <Card key={card.id} className="gap-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left text-sm font-medium"
                        onClick={() => setEditingCard({ card, laneId: lane.id })}
                      >
                        {card.title}
                      </button>
                      <Badge variant={STATUS_VARIANT[card.status] ?? "secondary"}>
                        {card.status}
                      </Badge>
                    </div>

                    {card.error ? (
                      <p className="line-clamp-3 text-xs text-destructive">{card.error}</p>
                    ) : card.body ? (
                      <p className="line-clamp-3 text-xs text-muted-foreground">{card.body}</p>
                    ) : null}

                    {/* An ordering is only useful if it is visible before it bites: a card
                        shows what it waits on whether or not it has been asked to run yet. */}
                    {card.deps.length ? (
                      <p className="text-xs text-muted-foreground">
                        After{" "}
                        {card.deps
                          .map((dep) => title(dep.dependsOnCardId))
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    ) : null}

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title={previous ? `Move to ${previous.name}` : "Nowhere to the left"}
                        disabled={!previous || move.isPending}
                        onClick={() =>
                          previous && move.mutate({ cardId: card.id, laneId: previous.id })
                        }
                      >
                        <ChevronLeft className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={next ? `Move to ${next.name}` : "Nowhere to the right"}
                        disabled={!next || move.isPending}
                        onClick={() => next && move.mutate({ cardId: card.id, laneId: next.id })}
                      >
                        <ChevronRight className="size-4" />
                      </Button>
                      {card.status === "error" ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Clear the error and put it back in play"
                          disabled={retry.isPending}
                          onClick={() => retry.mutate(card.id)}
                        >
                          <RotateCcw className="size-4" />
                        </Button>
                      ) : null}
                      {card.status === "running" ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Stop the agent"
                          onClick={() => stop.mutate(card.id)}
                        >
                          <Square className="size-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          title={
                            lane.agentId
                              ? `Run with ${agentName(lane.agentId)}`
                              : "This lane has no agent"
                          }
                          disabled={!lane.agentId || run.isPending}
                          onClick={() => run.mutate(card.id)}
                        >
                          <Play className="size-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit"
                        onClick={() => setEditingCard({ card, laneId: lane.id })}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        disabled={card.status === "running"}
                        onClick={() => removeCard.mutate(card.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          );
        })}

        {lanes.length === 0 && !board.isLoading ? (
          <p className="text-sm text-muted-foreground">
            This board has no lanes. Add one — a lane with an agent is where work happens.
          </p>
        ) : null}
      </div>

      {editingCard ? (
        <CardDialog
          card={editingCard.card}
          cards={cards}
          projectId={projectId}
          laneId={editingCard.laneId}
          onClose={() => setEditingCard(null)}
        />
      ) : null}

      {editingLane ? (
        <LaneDialog
          lane={editingLane.lane}
          lanes={lanes}
          projectId={projectId}
          onClose={() => setEditingLane(null)}
        />
      ) : null}
    </Page>
  );
}
