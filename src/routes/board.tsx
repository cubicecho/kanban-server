import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Settings2, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { Page } from "@/components/app-shell";
import { CardGhost, SortableCard } from "@/components/board-card";
import { CardDialog } from "@/components/card-dialog";
import { LaneDialog } from "@/components/lane-dialog";
import { SaveTemplateDialog } from "@/components/save-template-dialog";
import { Spend } from "@/components/spend";
import { Button } from "@/components/ui/button";
import {
  ActiveRunsDocument,
  AgentsDocument,
  ArchiveCardDocument,
  BoardDocument,
  type BoardQuery,
  CardsStatusEnum,
  DeleteCardDocument,
  DeleteLaneDocument,
  MoveCardDocument,
  ProjectsDocument,
  RetryCardDocument,
  RunCardDocument,
  StopCardDocument,
} from "@/gql/graphql";
import { landing, laneOrder, placement } from "@/lib/board-order";
import { request } from "@/lib/gql";
import { useProjectId } from "@/lib/project";

type Lane = BoardQuery["lanes"][number];
type BoardCard = BoardQuery["cards"][number];

/** The whole lane is a drop target, so a card can be put in an empty one. */
function LaneDrop({ laneId, children }: { laneId: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `lane:${laneId}` });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-24 flex-col gap-2 rounded-md p-1 transition-colors ${
        isOver ? "bg-muted" : ""
      }`}
    >
      {children}
    </div>
  );
}

/**
 * The board as it would look once a move lands, worked out on the client.
 *
 * The arithmetic is `placement`, which is the server's — pull the card out of wherever it was,
 * put it back at `position`, renumber the lane it lands in from zero — so the optimistic board
 * and the one the refetch brings back agree. A moved card comes back to `idle` with its error
 * cleared, unless it was `done`, which is the one status a move does not disturb.
 */
function placed(
  data: BoardQuery,
  moved: { cardId: string; laneId: string; position?: number | null },
) {
  const card = data.cards.find((row) => row.id === moved.cardId);
  if (!card) return data;
  const order = placement(data.cards, moved);

  const settled = {
    ...card,
    laneId: moved.laneId,
    status: card.status === CardsStatusEnum.Done ? card.status : CardsStatusEnum.Idle,
    error: "",
  };
  const cards = data.cards
    .map((row) => (row.id === card.id ? settled : row))
    .map((row) => (order.includes(row.id) ? { ...row, position: order.indexOf(row.id) } : row));
  // The query asks for cards in `position` order, and so does every reader of this cache.
  cards.sort((a, b) => a.position - b.position);
  return { ...data, cards };
}

/**
 * The board: lanes across, cards down, and the pipeline drawn between them.
 *
 * Cards drag, by the grip on their left, and they also move with the arrows — the arrows are
 * two lanes' worth of keystrokes against a dozen, and they are what a card mostly needs anyway,
 * since most cards here move because an agent finished with them rather than because someone
 * pushed them. A drop lands on `moveCard` with an explicit position and is applied to the cache
 * first, so the card stays where it was dropped instead of flicking back until the refetch.
 *
 * A card being worked is drawn at the top of its lane — see `laneOrder`. It is the one thing on
 * a board that is happening rather than waiting, and hunting for it down a column of twenty is
 * the wrong way to find out what a project is doing.
 */
export function BoardRoute() {
  const projectId = useProjectId();
  const queryClient = useQueryClient();
  const [editingCard, setEditingCard] = useState<{ card?: BoardCard; laneId: string } | null>(null);
  const [editingLane, setEditingLane] = useState<{ lane?: Lane } | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [watching, setWatching] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const projects = useQuery({ queryKey: ["projects"], queryFn: () => request(ProjectsDocument) });
  const project = projects.data?.projects.find((row) => row.id === projectId);

  const board = useQuery({
    queryKey: ["board", projectId],
    queryFn: () => request(BoardDocument, { projectId }),
    enabled: Boolean(projectId),
    // A card an agent is working changes without anyone here doing anything — but not while a
    // card is in the air, because a lane that renumbers itself under the cursor is a card
    // dropped somewhere nobody aimed at.
    refetchInterval: dragging ? false : 3000,
  });
  // A card knows it is running; it does not know which run is running it, and the stream is
  // named by the run. This is the join, and it is only worth asking for while something is up.
  const active = useQuery({
    queryKey: ["active-runs", projectId],
    queryFn: () => request(ActiveRunsDocument, { projectId }),
    enabled: Boolean(projectId),
    refetchInterval: () =>
      board.data?.cards.some((card) => card.status === "running") ? 3000 : false,
  });
  const runFor = (cardId: string) => active.data?.runs.find((run) => run.cardId === cardId)?.id;

  const agents = useQuery({ queryKey: ["agents"], queryFn: () => request(AgentsDocument) });
  const agentName = (id?: string | null) =>
    agents.data?.agents.find((agent) => agent.id === id)?.name;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["board", projectId] });
    queryClient.invalidateQueries({ queryKey: ["active-runs", projectId] });
    queryClient.invalidateQueries({ queryKey: ["spend"] });
    // A card's dialog may be open over the board it is on, and a run or a move it did not
    // start is exactly what its history is for showing.
    queryClient.invalidateQueries({ queryKey: ["card-runs"] });
  };
  const onError = (error: Error) => toast.error(error.message);

  // Optimistic, because a dropped card that jumps back for a moment reads as broken. The cache
  // is rewritten with the same arithmetic the server does, the refetch reconciles it, and a
  // refusal — a card an agent picked up between the drop and the request — puts the board back
  // as it was rather than leaving the card somewhere the server does not have it.
  const move = useMutation({
    mutationFn: (variables: { cardId: string; laneId: string; position?: number | null }) =>
      request(MoveCardDocument, { position: null, ...variables }),
    onMutate: async (variables) => {
      const key = ["board", projectId];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<BoardQuery>(key);
      if (previous) queryClient.setQueryData<BoardQuery>(key, placed(previous, variables));
      return { previous };
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(["board", projectId], context.previous);
      onError(error);
    },
    onSettled: refresh,
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

  // Off the board rather than gone: the Done pile that has served its purpose, and the card
  // nobody is going to do. The archive page is where they are read and where they come back.
  const archive = useMutation({
    mutationFn: (cardId: string) => request(ArchiveCardDocument, { cardId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["archive", projectId] });
      refresh();
    },
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
  // The board draws only the cards on it, so a dependency that has been archived is not in
  // this list — and dropping it silently told a card it was waiting on nothing when it was
  // waiting on something nobody can see. Named rather than omitted.
  const title = (cardId: string) =>
    cards.find((card) => card.id === cardId)?.title ?? "an archived card";

  const dragged = cards.find((card) => card.id === dragging);
  // A few pixels of slop before a drag begins, so that pressing a button on a card is still
  // pressing a button. The keyboard sensor needs none of that: space on the grip lifts.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    if (!over) return;
    const to = landing(
      cards,
      lanes.map((lane) => lane.id),
      String(active.id),
      String(over.id),
    );
    if (to) move.mutate({ cardId: String(active.id), ...to });
  };

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
        <div className="flex items-center gap-3">
          {/* Beside the project's own controls, because turning `autoRun` on is the decision
              this number is about. */}
          <Spend projectId={projectId} />
          <Button variant="outline" onClick={() => setSavingTemplate(true)}>
            <Save className="size-4" />
            Save as template
          </Button>
          <Button variant="outline" onClick={() => setEditingLane({})}>
            <Plus className="size-4" />
            Lane
          </Button>
        </div>
      }
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={({ active }: DragStartEvent) => setDragging(String(active.id))}
        onDragCancel={() => setDragging(null)}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {lanes.map((lane, index) => {
            const here = laneOrder(cards, lane.id);
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

                <LaneDrop laneId={lane.id}>
                  <SortableContext
                    items={here.map((card) => card.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {here.map((card) => (
                      <SortableCard
                        key={card.id}
                        card={card}
                        lane={lane}
                        previous={previous}
                        next={next}
                        agentLabel={agentName(lane.agentId)}
                        waitingOn={card.deps.map((dep) => title(dep.dependsOnCardId))}
                        watching={watching === card.id}
                        runId={runFor(card.id)}
                        busy={{
                          move: move.isPending,
                          run: run.isPending,
                          retry: retry.isPending,
                        }}
                        on={{
                          edit: () => setEditingCard({ card, laneId: lane.id }),
                          move: (laneId) => move.mutate({ cardId: card.id, laneId }),
                          archive: () => archive.mutate(card.id),
                          retry: () => retry.mutate(card.id),
                          run: () => run.mutate(card.id),
                          stop: () => stop.mutate(card.id),
                          remove: () => removeCard.mutate(card.id),
                          watch: () => setWatching(watching === card.id ? null : card.id),
                        }}
                      />
                    ))}
                  </SortableContext>
                </LaneDrop>
              </section>
            );
          })}

          {lanes.length === 0 && !board.isLoading ? (
            <p className="text-sm text-muted-foreground">
              This board has no lanes. Add one — a lane with an agent is where work happens.
            </p>
          ) : null}
        </div>

        {/* The card under the cursor, drawn outside the lanes so it is not clipped by the
            board's own horizontal scroll. */}
        <DragOverlay>{dragged ? <CardGhost card={dragged} /> : null}</DragOverlay>
      </DndContext>

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

      {savingTemplate ? (
        <SaveTemplateDialog projectId={projectId} onClose={() => setSavingTemplate(false)} />
      ) : null}
    </Page>
  );
}
