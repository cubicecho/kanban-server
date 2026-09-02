import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CardDepsField, type DepCard } from "@/components/card-deps-field";
import { CardHistory } from "@/components/card-history";
import { Badge } from "@/components/ui/badge";
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
import {
  type BoardQuery,
  CardDepsDocument,
  CreateCardDocument,
  SetCardDepsDocument,
  UpdateCardDocument,
} from "@/gql/graphql";
import type { DepGraph } from "@/lib/cards";
import { request } from "@/lib/gql";

type Card = BoardQuery["cards"][number];
type Lane = BoardQuery["lanes"][number];

/**
 * A card, written or edited by hand.
 *
 * Most cards are written by an expanding station, so this is the exception rather than the rule
 * — but a board you cannot add a card to is a report, not a board.
 */
export function CardDialog({
  card,
  cards,
  lanes,
  projectId,
  laneId,
  onClose,
}: {
  card?: Card;
  /** Every card on this board, which is what a dependency may point at. */
  cards: Card[];
  /** The board's lanes, in order — what the dependency list is grouped by. */
  lanes: Lane[];
  projectId: string;
  /** Which lane a new card lands in. Ignored when editing. */
  laneId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(card?.title ?? "");
  const [body, setBody] = useState(card?.body ?? "");
  const [acceptance, setAcceptance] = useState(card?.acceptance ?? "");

  // The board query filters archived cards out, so the deps it carries are only the visible
  // half. Asked for separately rather than added to `Board`, which polls every three seconds
  // over up to five hundred cards: this is one card's answer, wanted once, when a dialog opens.
  const links = useQuery({
    queryKey: ["card-deps", card?.id],
    queryFn: () => request(CardDepsDocument, { cardId: card?.id ?? "" }),
    enabled: !!card,
  });

  const [dependsOn, setDependsOn] = useState<string[] | null>(card ? null : []);
  // Held until the real answer lands, because seeding from the board's half and then correcting
  // it is how an archived dependency gets dropped: a save in that window writes the short list.
  useEffect(() => {
    if (links.data) setDependsOn(links.data.cardDeps.map((link) => link.dependsOnCardId));
  }, [links.data]);

  const laneNames = useMemo(() => new Map(lanes.map((lane) => [lane.id, lane.name])), [lanes]);

  // Everything on the board, plus whatever archived cards this one already waits on — a dep you
  // cannot see is a dep you cannot deliberately keep, and the board query cannot show them.
  const choices: DepCard[] = useMemo(() => {
    const rows: DepCard[] = cards
      .filter((row) => row.id !== card?.id)
      .map((row) => ({ id: row.id, title: row.title, status: row.status, laneId: row.laneId }));
    const known = new Set(rows.map((row) => row.id));
    for (const link of links.data?.cardDeps ?? []) {
      if (known.has(link.dependsOn.id) || link.dependsOn.id === card?.id) continue;
      rows.push({
        id: link.dependsOn.id,
        title: link.dependsOn.title,
        status: link.dependsOn.status,
        laneId: link.dependsOn.laneId,
        archived: !!link.dependsOn.archivedAt,
      });
    }
    return rows;
  }, [cards, card?.id, links.data]);

  const graph: DepGraph = useMemo(
    () =>
      cards.flatMap((row) =>
        row.deps.map((dep) => ({ cardId: row.id, dependsOnCardId: dep.dependsOnCardId })),
      ),
    [cards],
  );

  // The other direction, and read-only: editing another card's list from inside this one is a
  // change with no visible cause. Knowing what is held up by this card is worth saying, though
  // — it is the answer to "why does this one matter".
  const blocking = links.data?.blockedBy ?? [];

  const save = useMutation({
    mutationFn: async () => {
      const values = { title: title.trim(), body, acceptance };
      if (!values.title) throw new Error("A card needs a title.");

      const before = (links.data?.cardDeps ?? []).map((link) => link.dependsOnCardId);
      const wanted = dependsOn ?? before;
      const changed =
        before.length !== wanted.length || before.some((held) => !wanted.includes(held));

      // Dependencies first, because the server refuses a set that would close a loop and a
      // refusal after the card was written leaves half the dialog saved. A new card has to be
      // written first — there is no id to hang a dependency on — but it is a new card, so
      // there is nothing it could be looping back through.
      if (card) {
        if (changed) await request(SetCardDepsDocument, { cardId: card.id, dependsOn: wanted });
        await request(UpdateCardDocument, { id: card.id, set: values });
      } else {
        const created = await request(CreateCardDocument, {
          values: { ...values, projectId, laneId },
        });
        if (wanted.length)
          await request(SetCardDepsDocument, { cardId: created.createCard.id, dependsOn: wanted });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", projectId] });
      queryClient.invalidateQueries({ queryKey: ["card-deps", card?.id] });
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

          {choices.length && dependsOn ? (
            <CardDepsField
              cardId={card?.id}
              cards={choices}
              laneNames={laneNames}
              graph={graph}
              value={dependsOn}
              onChange={setDependsOn}
            />
          ) : null}

          {blocking.length ? (
            <div className="flex flex-col gap-2">
              <Label>Holding up</Label>
              <div className="flex flex-wrap gap-1">
                {blocking.map((link) => (
                  <Badge key={link.cardId} variant="outline">
                    {link.card.title || "Untitled"}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                These wait on this card. Change that from their own dialogs — a card that edited
                other cards' dependencies would be a change with no visible cause.
              </p>
            </div>
          ) : null}

          {card?.result ? (
            <div className="flex flex-col gap-2">
              <Label>Last result</Label>
              <pre className="max-h-60 overflow-auto rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                {card.result}
              </pre>
            </div>
          ) : null}

          {/* A card that does not exist yet has no history, and asking for one would be a query
              for the id of a row nobody has written. */}
          {card ? <CardHistory cardId={card.id} /> : null}
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
