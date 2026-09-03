import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Clock,
  GripVertical,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Play,
  Radio,
  RotateCcw,
  Square,
  ThumbsDown,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ActionButton } from "@/components/action-button";
import { RunStream } from "@/components/run-stream";
import { CardStatusBadge } from "@/components/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BoardQuery } from "@/gql/graphql";
import { needsAttention } from "@/lib/cards";
import { plural } from "@/lib/text";
import { cn } from "@/lib/utils";

type Lane = BoardQuery["lanes"][number];
type BoardCard = BoardQuery["cards"][number];

/** Which face of the card dialog to open on. */
export type CardTab = "details" | "deps" | "notes" | "history";

/** What a card looks like while it is under the cursor, and nothing it can be clicked with. */
export function CardGhost({ card }: { card: BoardCard }) {
  return (
    <Card className="w-72 gap-2 p-3 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 flex-1 text-sm font-medium">{card.title}</span>
        <CardStatusBadge status={card.status} />
      </div>
    </Card>
  );
}

/**
 * One card on the board, draggable by its grip.
 *
 * The grip is a handle rather than the whole card being one, and that is about the keyboard as
 * much as the mouse: a card carries buttons, and a drag listener on the card would take the
 * space bar off every one of them. On the handle, the keyboard sensor gets a focusable element
 * of its own — tab to it, space to lift, arrows to move, space to drop — and the buttons
 * inside stay buttons.
 *
 * There used to be eight of those buttons, all icons, all identical grey, in 288px of lane,
 * with `title` for a label and Delete four pixels from Archive. What a card wants is nearly
 * always one thing — run it, stop it, or put it back in play — so that one is a button with a
 * word on it and the rest are behind the overflow. The lane arrows moved in there with them,
 * where they can say *which* lane rather than pointing at one.
 */
export function SortableCard({
  card,
  lane,
  previous,
  next,
  agentLabel,
  dragDisabled,
  waitingOn,
  mark,
  focused,
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
  /**
   * The board is showing a subset — a search — so the row a card sits in is not the row it
   * occupies, and dropping it would land it somewhere nobody aimed at. The arrows in the
   * overflow still work: they name a lane rather than a position.
   */
  dragDisabled?: boolean;
  waitingOn: string[];
  /**
   * What is written on this card that is not the card — a person's notes, and the reason a
   * reviewer sent it back. Absent for a card nobody has said anything about, which is most.
   */
  mark?: { notes: number; rejection: string };
  /** Arrived at from a link. Ringed and scrolled to, for a few seconds. */
  focused?: boolean;
  watching: boolean;
  runId?: string;
  busy: { move: boolean; run: boolean; retry: boolean; archive: boolean; remove: boolean };
  on: {
    edit: (tab?: CardTab) => void;
    move: (laneId: string) => void;
    archive: () => void;
    retry: () => void;
    run: () => void;
    stop: () => void;
    remove: () => void;
    watch: () => void;
  };
}) {
  const [confirming, setConfirming] = useState(false);

  // A card an agent is working cannot be moved out from under it — the server refuses, so the
  // board should not offer.
  const pinned = card.status === "running";
  const locked = pinned || Boolean(dragDisabled);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: locked,
  });

  // A second reference to the same node: dnd-kit owns `setNodeRef`, and a linked card has to be
  // scrolled to — the board is a wide horizontal scroll and a lane is a tall one, so a card
  // navigated to is very often not on screen at all.
  const node = useRef<HTMLDivElement | null>(null);
  const hold = (element: HTMLDivElement | null) => {
    node.current = element;
    setNodeRef(element);
  };
  useEffect(() => {
    if (focused) node.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [focused]);

  return (
    <Card
      ref={hold}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // Left in place and faded, not removed: the gap it leaves is where the ghost will land.
      className={cn(
        "group/card gap-2 p-3",
        isDragging && "opacity-40",
        focused && "ring-2 ring-primary",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              // Dim until the card is under the cursor or something on it has focus: a grip on
              // every card at full contrast is twenty pieces of furniture on a full board.
              className={cn(
                "-ml-1 shrink-0 touch-none rounded text-muted-foreground/40 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none group-focus-within/card:text-muted-foreground group-hover/card:text-muted-foreground",
                locked ? "cursor-not-allowed opacity-40" : "cursor-grab active:cursor-grabbing",
              )}
              aria-label={locked ? `${card.title} cannot be dragged` : `Drag ${card.title}`}
              disabled={locked}
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-4" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {pinned
              ? "An agent is working this card"
              : dragDisabled
                ? "Clear the search to drag cards"
                : "Drag, or press space to lift"}
          </TooltipContent>
        </Tooltip>
        <button
          type="button"
          className="min-w-0 flex-1 rounded text-left text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          onClick={() => on.edit()}
        >
          {card.title}
        </button>
        <CardStatusBadge status={card.status} />
      </div>

      {card.error ? (
        <p className="line-clamp-3 text-xs text-destructive">{card.error}</p>
      ) : card.body ? (
        <p className="line-clamp-3 text-xs text-muted-foreground">{card.body}</p>
      ) : null}

      {/* Why the card came back, on its face. `cards.error` holds faults and only faults, so
          until now a rejected card said "rejected" on the board and kept the reason two clicks
          away in its history — which is the one thing a person needs in order to decide what to
          do about it. Amber rather than red for the same reason the badge is: a reviewer saying
          no is the board working. */}
      {card.status === "rejected" && mark?.rejection ? (
        <p className="flex items-start gap-1 text-xs text-status-rejected-foreground">
          <ThumbsDown className="mt-0.5 size-3 shrink-0" aria-hidden />
          <span className="line-clamp-3">{mark.rejection}</span>
        </p>
      ) : null}

      {/* That somebody has written on this card. A count rather than the note itself: a note is
          written to be read in full by whoever works the card next, and three of them would be
          the whole lane. Opens the card on the tab they are on. */}
      {mark?.notes ? (
        <button
          type="button"
          className="flex items-center gap-1 self-start rounded text-xs text-muted-foreground hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          onClick={() => on.edit("notes")}
        >
          <MessageSquare className="size-3 shrink-0" aria-hidden />
          {plural(mark.notes, "note")}
        </button>
      ) : null}

      {/* An ordering is only useful if it is visible before it bites: a card shows what it
          waits on whether or not it has been asked to run yet. */}
      {waitingOn.length ? (
        <p className="flex items-start gap-1 text-xs text-muted-foreground">
          <Clock className="mt-0.5 size-3 shrink-0" aria-hidden />
          <span>After {waitingOn.join(", ")}</span>
        </p>
      ) : null}

      {/* A card that has been round the loop looks like any other one, and the difference
          matters: it is why an idle card is idle for the second time. Not counted against the
          lane's budget here — the attempts were spent by whichever station failed it. */}
      {card.attempts ? (
        <p className="text-xs text-muted-foreground">{plural(card.attempts, "failed attempt")}</p>
      ) : null}

      <div className="flex items-center gap-1">
        <PrimaryAction
          card={card}
          lane={lane}
          agentLabel={agentLabel}
          busy={busy}
          on={{ run: on.run, stop: on.stop, retry: on.retry }}
        />
        <ActionButton
          variant="ghost"
          size="icon-sm"
          label={`Edit ${card.title}`}
          hint="Edit"
          onClick={() => on.edit()}
        >
          <Pencil className="size-4" aria-hidden />
        </ActionButton>

        {/* Not in the overflow. What an agent is doing right now is the thing a person came to
            the board to see, and it was two clicks behind a menu whose other items are all
            about moving the card. It only appears while there is something to watch. */}
        {card.status === "running" ? (
          <ActionButton
            variant="ghost"
            size="icon-sm"
            label={`Watch the run working ${card.title}`}
            hint="Watch the run"
            onClick={on.watch}
          >
            <Radio className="size-4 text-status-running" aria-hidden />
          </ActionButton>
        ) : null}

        {/* Everything a card can do that is not the one thing it usually wants. In a menu
            rather than in a row, because eight ghost icons at 32px in a 288px lane is a
            guessing game, and a menu can spell out which lane an arrow meant. */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="ml-auto"
                  aria-label={`More actions for ${card.title}`}
                >
                  <MoreHorizontal className="size-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>More</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              disabled={!previous || pinned || busy.move}
              onSelect={() => previous && on.move(previous.id)}
            >
              <ArrowLeft className="size-4" aria-hidden />
              {previous ? `Move to ${previous.name}` : "Nowhere to the left"}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!next || pinned || busy.move}
              onSelect={() => next && on.move(next.id)}
            >
              <ArrowRight className="size-4" aria-hidden />
              {next ? `Move to ${next.name}` : "Nowhere to the right"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={pinned || busy.archive} onSelect={on.archive}>
              <Archive className="size-4" aria-hidden />
              Archive — off the board, not gone
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              disabled={pinned || busy.remove}
              onSelect={() => setConfirming(true)}
            >
              <Trash2 className="size-4" aria-hidden />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* The middle of the run — what the agent is thinking and which tools it is reaching for
          — without leaving the board for the Runs page. In a dialog rather than in the card:
          model output is prose and tool calls are paths, and 288px of lane wrapped both to
          three words a line while shoving every card below it down the column. The stream
          replays from the start, so opening it late costs nothing. */}
      <Dialog open={watching} onOpenChange={(open) => !open && on.watch()}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate">{card.title}</DialogTitle>
            <DialogDescription>
              The run as it happens. Closing this leaves it running.
            </DialogDescription>
          </DialogHeader>
          {runId ? (
            <RunStream runId={runId} className="max-h-[60vh]" />
          ) : (
            <p className="text-sm text-muted-foreground">Looking for the run…</p>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{card.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              The card goes, along with whatever the agent wrote on it and its history of moves.
              Archiving keeps all of that and still takes it off the board.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogCancel onClick={on.archive}>Archive instead</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={on.remove}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/**
 * The one thing this card wants, with a word on it.
 *
 * A card is running, or it is waiting on somebody, or it is ready — three states and three
 * verbs, and which one is showing says more about the card at a glance than the status badge
 * beside it. It is the only control on a card wide enough to read, which is what makes the
 * icons around it legible as the secondary things they are.
 */
function PrimaryAction({
  card,
  lane,
  agentLabel,
  busy,
  on,
}: {
  card: BoardCard;
  lane: Lane;
  agentLabel?: string;
  busy: { run: boolean; retry: boolean };
  on: { run: () => void; stop: () => void; retry: () => void };
}) {
  if (card.status === "running") {
    return (
      <ActionButton
        variant="outline"
        size="sm"
        label={`Stop the agent working ${card.title}`}
        hint="Stop the agent"
        onClick={on.stop}
      >
        <Square className="size-3.5" aria-hidden />
        Stop
      </ActionButton>
    );
  }

  // A card a reviewer turned down is put back in play by the same button as one that broke:
  // both are stopped, and both are waiting on somebody to say try again.
  if (needsAttention(card.status)) {
    return (
      <ActionButton
        variant="outline"
        size="sm"
        label={`Put ${card.title} back in play`}
        hint={
          card.status === "rejected"
            ? "Put it back in play, keeping the reason it came back"
            : "Clear the error and put it back in play"
        }
        disabled={busy.retry}
        onClick={on.retry}
      >
        <RotateCcw className="size-3.5" aria-hidden />
        Retry
      </ActionButton>
    );
  }

  return (
    <ActionButton
      variant="outline"
      size="sm"
      label={`Run ${card.title}`}
      hint={
        lane.agentId
          ? `Run with ${agentLabel}`
          : `${lane.name} has no agent — a lane without one is a resting place`
      }
      disabled={!lane.agentId || busy.run}
      onClick={on.run}
    >
      <Play className="size-3.5" aria-hidden />
      Run
    </ActionButton>
  );
}
