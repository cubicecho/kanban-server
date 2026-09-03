import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { CardDepsField, type DepCard } from "@/components/card-deps-field";
import { CardHistory } from "@/components/card-history";
import { CardNotes } from "@/components/card-notes";
import { useDiscardGuard } from "@/components/discard-guard";
import { useFieldError } from "@/components/field-error";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  type BoardQuery,
  CardDepsDocument,
  CreateCardDocument,
  SetCardDepsDocument,
  UpdateCardDocument,
} from "@/gql/graphql";
import type { DepGraph } from "@/lib/cards";
import { useDirty } from "@/lib/dirty";
import { request } from "@/lib/gql";
import { toastError } from "@/lib/toast";

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
  tab,
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
  /**
   * Which face to open on. The board's note marker opens the notes, because a person who
   * clicked "2 notes" has said what they came to read; so does every row on the status page,
   * each of which is a card opened because of something said about it. A card that does not
   * exist yet has neither notes nor a history, so it opens on `details` whatever is asked for.
   */
  tab?: "details" | "deps" | "notes" | "history";
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

  // `dependsOn` is null until the query lands, so the snapshot waits for it — otherwise the
  // answer arriving would count as an edit. Sorted, because the picker's order is the order
  // things were clicked in and nobody means anything by it.
  const { close, guard } = useDiscardGuard(
    useDirty(
      { title, body, acceptance, dependsOn: dependsOn && [...dependsOn].sort() },
      dependsOn !== null,
    ),
    onClose,
  );
  const titleError = useFieldError("card-title", title.trim() ? "" : "A card needs a title.");

  const save = useMutation({
    mutationFn: async () => {
      const values = { title: title.trim(), body, acceptance };

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
    onError: toastError,
  });

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{card ? "Edit card" : "New card"}</DialogTitle>
          <DialogDescription>
            What one agent is asked to do, and how anyone can tell it is done.
          </DialogDescription>
        </DialogHeader>

        {/* Four things a card is: what to do, what it waits on, what has been said about it
            and what has happened to it. They were one scroll, which meant the deps picker
            appearing when its query landed shoved the history down the page under whoever was
            reading it. */}
        <Tabs defaultValue={card ? (tab ?? "details") : "details"}>
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="deps">
              Dependencies
              {dependsOn?.length ? (
                <span className="ml-1.5 text-muted-foreground">{dependsOn.length}</span>
              ) : null}
            </TabsTrigger>
            {/* A card that does not exist yet has neither notes nor a history, and asking
                for either would be a query for the id of a row nobody has written. */}
            {card ? <TabsTrigger value="notes">Notes</TabsTrigger> : null}
            {card ? <TabsTrigger value="history">History</TabsTrigger> : null}
          </TabsList>

          <TabsContent value="details" className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="card-title">Title</Label>
              <Input
                id="card-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="One thing an agent can finish"
                {...titleError.field}
              />
              {titleError.error}
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
          </TabsContent>

          <TabsContent value="deps" className="flex flex-col gap-4">
            {choices.length && dependsOn ? (
              <CardDepsField
                cardId={card?.id}
                cards={choices}
                laneNames={laneNames}
                graph={graph}
                value={dependsOn}
                onChange={setDependsOn}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {dependsOn
                  ? "There is nothing else on this board for this card to wait on."
                  : "Reading this card's dependencies…"}
              </p>
            )}

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
          </TabsContent>

          {card ? (
            <TabsContent value="notes">
              <CardNotes cardId={card.id} />
            </TabsContent>
          ) : null}

          {card ? (
            <TabsContent value="history">
              <CardHistory cardId={card.id} />
            </TabsContent>
          ) : null}
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={titleError.invalid || save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
        {guard}
      </DialogContent>
    </Dialog>
  );
}
