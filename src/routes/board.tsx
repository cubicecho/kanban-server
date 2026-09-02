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
import { KanbanSquare, Plus, Save, Search, Settings2, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/action-button";
import { Page, useCurrentProject } from "@/components/app-shell";
import { CardGhost, SortableCard } from "@/components/board-card";
import { CardDialog } from "@/components/card-dialog";
import { ConfirmButton } from "@/components/confirm-button";
import { EmptyState, NoProject } from "@/components/empty-state";
import { LaneDialog } from "@/components/lane-dialog";
import { QueryError } from "@/components/query-error";
import { SaveTemplateDialog } from "@/components/save-template-dialog";
import { Spend } from "@/components/spend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
  RestoreCardDocument,
  RetryCardDocument,
  RolesDocument,
  RunCardDocument,
  StopCardDocument,
} from "@/gql/graphql";
import { landing, laneOrder, placement } from "@/lib/board-order";
import { request } from "@/lib/gql";
import { useProjectId } from "@/lib/project";
import { cn } from "@/lib/utils";

type Lane = BoardQuery["lanes"][number];
type BoardCard = BoardQuery["cards"][number];

/**
 * How many cards the board will draw.
 *
 * It asks for one more than this and shows the first `LIMIT`, which is how it knows there are
 * others: a board that quietly stopped at five hundred looked exactly like a board with five
 * hundred cards on it. There is no "show more" here because a board is not a list — the cards
 * come back in `position` order across the whole project, so what a higher limit would add is
 * the tail of the longest lanes, and the answer to a board this size is the archive.
 */
const LIMIT = 500;

/**
 * The whole lane is a drop target, so a card can be put in an empty one.
 *
 * A hovered lane used to say so in `bg-muted` alone, which on a dark board is one step of
 * lightness against the card behind it — a difference you can only see if you already know it
 * is there. A ring in the accent colour is the same statement made at a contrast somebody can
 * act on, and an empty lane says in words that it will take the card.
 */
function LaneDrop({
  laneId,
  empty,
  filtered,
  children,
}: {
  laneId: string;
  empty: boolean;
  /** A search is on, so this lane is showing a subset and cannot be dropped into. */
  filtered: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `lane:${laneId}`, disabled: filtered });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-24 flex-col gap-2 rounded-md p-1 transition-colors",
        isOver && "bg-primary/10 ring-2 ring-primary/50",
        empty && "border border-dashed",
      )}
    >
      {children}
      {empty ? (
        <p className="m-auto px-2 text-center text-xs text-muted-foreground">
          {filtered ? "Nothing here matches" : "Drop a card here"}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Two lanes' worth of grey while the first board loads.
 *
 * `isPending` only — the board refetches every three seconds, and gating this on `isFetching`
 * would replace a working board with shapes every time it did.
 */
function BoardSkeleton() {
  return (
    <>
      {[0, 1, 2].map((lane) => (
        <section key={lane} className="flex w-72 shrink-0 flex-col gap-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-20" />
          <div className="mt-1 flex flex-col gap-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </section>
      ))}
    </>
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
  const [search, setSearch] = useState("");

  const project = useCurrentProject();

  const board = useQuery({
    queryKey: ["board", projectId],
    queryFn: () => request(BoardDocument, { projectId, limit: LIMIT + 1 }),
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

  // A lane header said only which agent works here, which is the smaller half of what a lane
  // is: the role is the kind of station it is — whether cards get worked, ruled on or broken
  // up — and the same agent in two lanes does two different jobs.
  const roles = useQuery({ queryKey: ["roles"], queryFn: () => request(RolesDocument) });
  const roleName = (id?: string | null) => roles.data?.roles.find((role) => role.id === id)?.name;

  const laneSummary = (lane: Lane) => {
    const role = lane.roleId ? (roleName(lane.roleId) ?? "unknown role") : null;
    const agent = agentName(lane.agentId);
    // It takes both to be a station. One without the other never runs, so name the half that
    // is missing rather than only ever the agent — and a lane with neither is a resting place,
    // which is one thing to say rather than two absences.
    const parts = role || agent ? [role ?? "no role", agent ?? "no agent"] : ["resting place"];
    // A cap on how many run at once is only worth saying where something runs.
    if (role && agent && lane.wipLimit) parts.push(`${lane.wipLimit} at a time`);
    if (lane.intake) parts.push("intake");
    return parts.join(" · ");
  };

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

  const restore = useMutation({
    mutationFn: (cardId: string) => request(RestoreCardDocument, { cardId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["archive", projectId] });
      refresh();
    },
    onError,
  });

  // Off the board rather than gone: the Done pile that has served its purpose, and the card
  // nobody is going to do. The archive page is where they are read and where they come back —
  // but the wrong card archived is noticed here, a second later, so the way back is on the
  // toast rather than a page away. It is `restoreCard` either way, which puts the card at the
  // end of its lane rather than the place it held; the toast says so, because an undo that
  // does not quite undo is worse for going unremarked.
  const archive = useMutation({
    mutationFn: (cardId: string) => request(ArchiveCardDocument, { cardId }),
    onSuccess: (_data, cardId) => {
      toast.success("Archived", {
        description: "Undo puts it back at the end of its lane.",
        action: { label: "Undo", onClick: () => restore.mutate(cardId) },
      });
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
  const all = board.data?.cards ?? [];
  const truncated = all.length > LIMIT;
  const cards = truncated ? all.slice(0, LIMIT) : all;

  // Title and body, because half of what distinguishes two cards called "Migrate the tables"
  // is in the brief underneath. Nothing here is sent to the server: the board is already in
  // hand, and a query per keystroke over five hundred rows this process already has would be
  // slower than reading them.
  const filter = search.trim().toLowerCase();
  const matches = (card: BoardCard) =>
    card.title.toLowerCase().includes(filter) || card.body.toLowerCase().includes(filter);
  const matched = filter ? cards.filter(matches).length : cards.length;
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

  // dnd-kit's defaults read the draggable's id, which here is a uuid: a keyboard user heard
  // "picked up draggable item 3f2a…" and then, on every arrow press, another one. What a person
  // needs told is which card is in the air and which lane it is over.
  const announcements = useMemo(() => {
    const cardTitle = (id: string) => cards.find((card) => card.id === id)?.title ?? "a card";
    const laneName = (id: string) => {
      const laneId = id.startsWith("lane:")
        ? id.slice("lane:".length)
        : cards.find((card) => card.id === id)?.laneId;
      return lanes.find((lane) => lane.id === laneId)?.name ?? "a lane";
    };
    return {
      onDragStart: ({ active }: { active: { id: string | number } }) =>
        `Picked up ${cardTitle(String(active.id))}.`,
      onDragOver: ({
        active,
        over,
      }: {
        active: { id: string | number };
        over: { id: string | number } | null;
      }) =>
        over
          ? `${cardTitle(String(active.id))} is over ${laneName(String(over.id))}.`
          : `${cardTitle(String(active.id))} is not over a lane.`,
      onDragEnd: ({
        active,
        over,
      }: {
        active: { id: string | number };
        over: { id: string | number } | null;
      }) =>
        over
          ? `Dropped ${cardTitle(String(active.id))} in ${laneName(String(over.id))}.`
          : `${cardTitle(String(active.id))} was put back.`,
      onDragCancel: ({ active }: { active: { id: string | number } }) =>
        `Left ${cardTitle(String(active.id))} where it was.`,
    };
  }, [cards, lanes]);

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
      <Page title="Board">
        <NoProject what="A board" />
      </Page>
    );
  }

  return (
    <Page
      title="Board"
      crumb={project?.name}
      description={
        project?.autoRun
          ? "On auto — cards are picked up as they land."
          : "Manual — cards run when you ask them to."
      }
      wide
      actions={
        <div className="flex flex-wrap items-center gap-3">
          {/* Beside the project's own controls, because turning `autoRun` on is the decision
              this number is about. */}
          <Spend projectId={projectId} />
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find a card"
              aria-label="Find a card on this board"
              className="w-44 pl-8"
            />
          </div>
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
      {/* The front door is a guess when nobody has marked one: `submitCard` and `makeCard` fall
          back to the leftmost lane so nothing throws, and a guess that works silently is a guess
          nobody ever corrects. Say it on the board, where the lane it would pick is visible. */}
      {lanes.length && !lanes.some((lane) => lane.intake) ? (
        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          No lane is marked <span className="font-medium">intake</span>, so work arriving without a
          lane lands in <span className="font-medium">{lanes[0].name}</span> — whichever column
          happens to be leftmost. Mark the one you meant.
        </p>
      ) : null}

      {/* A board that stopped at the limit looked like a board that ended there. Said once,
          above the lanes, with the thing to do about it. */}
      {truncated ? (
        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          This project has more than {LIMIT} cards on the board and only the first {LIMIT} are drawn
          — they come back in position order, so what is missing is the tail of the longest lanes.
          Archive what is finished.
        </p>
      ) : null}

      {/* Filtering hides cards from the lanes, and the drop arithmetic counts positions within
          a lane as the board has them — so a card dropped two rows down a filtered lane would
          land two rows down the real one, somewhere nobody aimed at. Off, and said out loud. */}
      {filter ? (
        <p className="flex flex-wrap items-center gap-x-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          <span>
            {matched} of {cards.length} cards match “{search.trim()}”. Dragging is off while the
            board is filtered.
          </span>
          <button
            type="button"
            className="rounded font-medium text-foreground underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            onClick={() => setSearch("")}
          >
            Clear
          </button>
        </p>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        accessibility={{ announcements }}
        onDragStart={({ active }: DragStartEvent) => setDragging(String(active.id))}
        onDragCancel={() => setDragging(null)}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {lanes.map((lane, index) => {
            const inLane = laneOrder(cards, lane.id);
            const here = filter ? inLane.filter(matches) : inLane;
            const previous = lanes[index - 1];
            const next = lanes[index + 1];
            return (
              <section key={lane.id} className="flex w-72 shrink-0 flex-col gap-2">
                <header className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold">
                      {lane.name}
                      <span className="ml-2 font-normal text-muted-foreground">
                        {filter ? `${here.length} of ${inLane.length}` : inLane.length}
                      </span>
                    </h2>
                    <p className="truncate text-xs text-muted-foreground">{laneSummary(lane)}</p>
                  </div>
                  <div className="flex shrink-0">
                    <ActionButton
                      variant="ghost"
                      size="icon"
                      label={`Add a card to ${lane.name}`}
                      hint="Add a card"
                      onClick={() => setEditingCard({ laneId: lane.id })}
                    >
                      <Plus className="size-4" aria-hidden />
                    </ActionButton>
                    <ActionButton
                      variant="ghost"
                      size="icon"
                      label={`Edit ${lane.name}`}
                      hint="What happens here: the role, the agent, and where cards go next"
                      onClick={() => setEditingLane({ lane })}
                    >
                      <Settings2 className="size-4" aria-hidden />
                    </ActionButton>
                    <ConfirmButton
                      variant="ghost"
                      size="icon"
                      label={`Delete ${lane.name}`}
                      hint={
                        inLane.length ? "Move its cards somewhere else first" : "Delete this lane"
                      }
                      disabled={inLane.length > 0}
                      title={`Delete the lane "${lane.name}"?`}
                      description="Any other lane whose success or failure arrow pointed here stops pointing anywhere, and cards that land in it will sit still."
                      onConfirm={() => removeLane.mutate(lane.id)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </ConfirmButton>
                  </div>
                </header>

                <LaneDrop laneId={lane.id} empty={here.length === 0} filtered={Boolean(filter)}>
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
                        dragDisabled={Boolean(filter)}
                        waitingOn={card.deps.map((dep) => title(dep.dependsOnCardId))}
                        watching={watching === card.id}
                        runId={runFor(card.id)}
                        // Per card, not per mutation: these are one mutation object shared by
                        // the whole board, so `move.isPending` alone greyed out every card's
                        // controls because one of them was moving.
                        busy={{
                          move: move.isPending && move.variables?.cardId === card.id,
                          run: run.isPending && run.variables === card.id,
                          retry: retry.isPending && retry.variables === card.id,
                          archive: archive.isPending && archive.variables === card.id,
                          remove: removeCard.isPending && removeCard.variables === card.id,
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

          {/* Three ways to have no lanes on screen, and they want different things done about
              them. A failed request that reads as an empty board invites somebody to rebuild a
              board that was never broken. */}
          {board.isPending ? <BoardSkeleton /> : null}
          {board.isError ? (
            <QueryError error={board.error} onRetry={() => board.refetch()} what="this board" />
          ) : null}
          {lanes.length === 0 && !board.isPending && !board.isError ? (
            <EmptyState
              icon={KanbanSquare}
              title="This board has no lanes"
              description="A lane is a column; a lane that names a role and an agent is a station, and stations are where work actually happens."
              action={<Button onClick={() => setEditingLane({})}>Add a lane</Button>}
            />
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
          lanes={lanes}
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
