import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type BoardQuery, CreateCardDocument, UpdateCardDocument } from "@/gql/graphql";
import { request } from "@/lib/gql";

type Card = BoardQuery["cards"][number];

/**
 * A card, written or edited by hand.
 *
 * Most cards are written by the decomposer, so this is the exception rather than the rule —
 * but a board you cannot add a card to is a report, not a board.
 */
export function CardDialog({
  card,
  projectId,
  laneId,
  onClose,
}: {
  card?: Card;
  projectId: string;
  /** Which lane a new card lands in. Ignored when editing. */
  laneId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(card?.title ?? "");
  const [body, setBody] = useState(card?.body ?? "");
  const [acceptance, setAcceptance] = useState(card?.acceptance ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const values = { title: title.trim(), body, acceptance };
      if (!values.title) throw new Error("A card needs a title.");
      if (card) await request(UpdateCardDocument, { id: card.id, set: values });
      else await request(CreateCardDocument, { values: { ...values, projectId, laneId } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", projectId] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{card ? "Edit card" : "New card"}</DialogTitle>
          <DialogDescription>
            What one agent is asked to do, and how anyone can tell it is done.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="card-title">Title</Label>
            <Input
              id="card-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="card-body">Body</Label>
            <Textarea
              id="card-body"
              rows={6}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="What to do, in enough detail that the agent does not have to guess."
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="card-acceptance">Acceptance</Label>
            <Textarea
              id="card-acceptance"
              rows={3}
              value={acceptance}
              onChange={(event) => setAcceptance(event.target.value)}
              placeholder="What a reviewer checks against. Kept apart from the body so it does not get skipped."
            />
          </div>
          {card?.result ? (
            <div className="flex flex-col gap-2">
              <Label>Last result</Label>
              <pre className="max-h-60 overflow-auto rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                {card.result}
              </pre>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
