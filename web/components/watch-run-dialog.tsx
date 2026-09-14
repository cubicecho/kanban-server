import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { BoardQuery } from "@/__generated__/graphql";
import { RunStream } from "@/components/run-stream";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Lane = BoardQuery["lanes"][number];
type BoardCard = BoardQuery["cards"][number];

/**
 * The run working a card, followed from station to station.
 *
 * A person watching a card is watching the card, not one run of it: when Doing hands it to
 * Review, the stream they had open is over and the one worth reading has just started in the
 * next lane. So the dialog swaps to it and says so, rather than going on showing a finished run
 * — or, as it did while it lived inside the card, closing and reopening as the card was redrawn
 * in its new column and then sitting on "Looking for the run…".
 *
 * The run being shown is held here rather than read off `live`, because a finished run drops
 * out of the active list the moment it ends, and its output is still what a person was reading.
 * Which lane a run belongs to comes from the run row, not the card: the board and the active
 * runs are two polls, and whichever lands first must not decide what the toast says.
 */
export function WatchRunDialog({
  card,
  title,
  lanes,
  live,
  onClose,
}: {
  /** Absent once the card has left the board — archived by an expanding lane, or deleted. */
  card?: BoardCard;
  /** Kept by the caller, so the heading survives the card leaving the board. */
  title: string;
  lanes: Lane[];
  /** The run working this card right now, if one is. */
  live?: { id: string; laneId?: string | null };
  onClose: () => void;
}) {
  const [shown, setShown] = useState(live ? { id: live.id, laneId: live.laneId } : null);
  // The lane a toast has already been raised for, so a card resting in Done is said once and not
  // every three seconds.
  const [announced, setAnnounced] = useState(card?.laneId);
  const laneName = (id?: string | null) => lanes.find((lane) => lane.id === id)?.name;

  useEffect(() => {
    if (!live || live.id === shown?.id) return;
    // The first run found is the one that was asked for, not a swap.
    if (shown) {
      const moved = live.laneId !== shown.laneId;
      const name = lanes.find((lane) => lane.id === live.laneId)?.name;
      toast.info(
        moved
          ? `Moved to ${name ?? "another lane"} — now watching the run there`
          : "Started again — now watching the new run",
        { description: title },
      );
    }
    setShown({ id: live.id, laneId: live.laneId });
    setAnnounced(live.laneId ?? undefined);
  }, [live, shown, title, lanes]);

  // A card that lands where no run will follow gets told too, or the dialog goes on showing a
  // finished stream with nothing to say the card has gone anywhere. A station with an idle card
  // is left to the swap above, which names the lane when its run starts.
  const lane = lanes.find((candidate) => candidate.id === card?.laneId);
  useEffect(() => {
    if (!card || !shown || card.laneId === shown.laneId || card.laneId === announced) return;
    const station = Boolean(lane?.roleId && lane?.agentId);
    if (station && (card.status === "idle" || card.status === "running")) return;
    toast.info(`Moved to ${lane?.name ?? "another lane"} — no run follows it there`, {
      description: title,
    });
    setAnnounced(card.laneId);
  }, [card, shown, announced, lane, title]);

  const running = Boolean(live && live.id === shown?.id);
  const where = laneName(shown?.laneId);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate">{title}</DialogTitle>
          <DialogDescription>
            {running
              ? `The run${where ? ` in ${where}` : ""} as it happens. Closing this leaves it running.`
              : `The run${where ? ` in ${where}` : ""} has finished. A run in the card's next lane opens here when it starts.`}
          </DialogDescription>
        </DialogHeader>
        {shown ? (
          <RunStream runId={shown.id} className="max-h-[60vh]" />
        ) : (
          <p className="text-sm text-muted-foreground">Looking for the run…</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
