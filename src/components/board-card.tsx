import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Pencil,
  Play,
  Radio,
  RotateCcw,
  Square,
  Trash2,
} from "lucide-react";
import { RunStream } from "@/components/run-stream";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { BoardQuery } from "@/gql/graphql";

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
 * The one status worth spotting from across a board, in the colour the run stream already uses
 * for a live one. Every other status is grey by design — a board where everything is coloured
 * says nothing — so this is the exception rather than the start of a palette.
 */
const RUNNING_BADGE =
  "border-emerald-600/30 bg-emerald-500/15 text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-400";

function StatusBadge({ status }: { status: BoardCard["status"] }) {
  return (
    <Badge
      variant={STATUS_VARIANT[status] ?? "secondary"}
      className={status === "running" ? RUNNING_BADGE : undefined}
    >
      {status}
    </Badge>
  );
}

/** What a card looks like while it is under the cursor, and nothing it can be clicked with. */
export function CardGhost({ card }: { card: BoardCard }) {
  return (
    <Card className="w-72 gap-2 p-3 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 flex-1 text-sm font-medium">{card.title}</span>
        <StatusBadge status={card.status} />
      </div>
    </Card>
  );
}

/**
 * One card on the board, draggable by its grip.
 *
 * The grip is a handle rather than the whole card being one, and that is about the keyboard as
 * much as the mouse: a card carries eight buttons, and a drag listener on the card would take
 * the space bar off every one of them. On the handle, the keyboard sensor gets a focusable
 * element of its own — tab to it, space to lift, arrows to move, space to drop — and the
 * buttons inside stay buttons.
 *
 * The lane arrows stay too. Dragging is what a board is, but "two lanes to the right" is one
 * keystroke on an arrow and a dozen on a drag, and the arrows are what a screen reader meets.
 */
export function SortableCard({
  card,
  lane,
  previous,
  next,
  agentLabel,
  waitingOn,
  watching,
  runId,
  busy,
  on,
}: {
  card: BoardCard;
  lane: Lane;
  previous?: Lane;
  next?: Lane;
  agentLabel?: string;
  waitingOn: string[];
  watching: boolean;
  runId?: string;
  busy: { move: boolean; run: boolean; retry: boolean };
  on: {
    edit: () => void;
    move: (laneId: string) => void;
    archive: () => void;
    retry: () => void;
    run: () => void;
    stop: () => void;
    remove: () => void;
    watch: () => void;
  };
}) {
  // A card an agent is working cannot be moved out from under it — the server refuses, so the
  // board should not offer.
  const pinned = card.status === "running";
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: pinned,
  });

  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // Left in place and faded, not removed: the gap it leaves is where the ghost will land.
      className={`gap-2 p-3 ${isDragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          className={`-ml-1 shrink-0 touch-none text-muted-foreground ${
            pinned ? "cursor-not-allowed opacity-40" : "cursor-grab"
          }`}
          title={pinned ? "An agent is working this card" : "Drag, or press space to lift"}
          disabled={pinned}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <button
          type="button"
          className="min-w-0 flex-1 text-left text-sm font-medium"
          onClick={on.edit}
        >
          {card.title}
        </button>
        <StatusBadge status={card.status} />
      </div>

      {card.error ? (
        <p className="line-clamp-3 text-xs text-destructive">{card.error}</p>
      ) : card.body ? (
        <p className="line-clamp-3 text-xs text-muted-foreground">{card.body}</p>
      ) : null}

      {/* An ordering is only useful if it is visible before it bites: a card shows what it
          waits on whether or not it has been asked to run yet. */}
      {waitingOn.length ? (
        <p className="text-xs text-muted-foreground">After {waitingOn.join(", ")}</p>
      ) : null}

      {/* A card that has been round the loop looks like any other one, and the difference
          matters: it is why an idle card is idle for the second time. Not counted against the
          lane's budget here — the attempts were spent by whichever station failed it. */}
      {card.attempts ? (
        <p className="text-xs text-muted-foreground">
          {card.attempts} failed {card.attempts === 1 ? "attempt" : "attempts"}
        </p>
      ) : null}

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          title={previous ? `Move to ${previous.name}` : "Nowhere to the left"}
          disabled={!previous || busy.move}
          onClick={() => previous && on.move(previous.id)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title={next ? `Move to ${next.name}` : "Nowhere to the right"}
          disabled={!next || busy.move}
          onClick={() => next && on.move(next.id)}
        >
          <ChevronRight className="size-4" />
        </Button>
        {card.status === "error" ? (
          <Button
            variant="ghost"
            size="icon"
            title="Clear the error and put it back in play"
            disabled={busy.retry}
            onClick={on.retry}
          >
            <RotateCcw className="size-4" />
          </Button>
        ) : null}
        {card.status === "running" ? (
          <Button
            variant="ghost"
            size="icon"
            title={watching ? "Hide the run" : "Watch this run"}
            onClick={on.watch}
          >
            <Radio className="size-4" />
          </Button>
        ) : null}
        {card.status === "running" ? (
          <Button variant="ghost" size="icon" title="Stop the agent" onClick={on.stop}>
            <Square className="size-4" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            title={lane.agentId ? `Run with ${agentLabel}` : "This lane has no agent"}
            disabled={!lane.agentId || busy.run}
            onClick={on.run}
          >
            <Play className="size-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" title="Edit" onClick={on.edit}>
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title={pinned ? "Stop the agent before archiving" : "Archive — off the board, not gone"}
          disabled={pinned}
          onClick={on.archive}
        >
          <Archive className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" title="Delete" disabled={pinned} onClick={on.remove}>
          <Trash2 className="size-4" />
        </Button>
      </div>

      {/* The middle of the run, where the run is: what the agent is thinking and which tools it
          is reaching for, without leaving the board for the Runs page. The stream replays from
          the start, so opening it late costs nothing. */}
      {watching ? (
        runId ? (
          <RunStream runId={runId} />
        ) : (
          <p className="text-xs text-muted-foreground">Looking for the run…</p>
        )
      ) : null}
    </Card>
  );
}
