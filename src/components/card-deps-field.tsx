import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CardsStatusEnum } from "@/gql/graphql";
import { CARD_STATUS_CLASS, CARD_STATUS_VARIANT, cyclingCards, type DepGraph } from "@/lib/cards";

/** A card as this field needs to know it, which is the same for a live one and an archived one. */
export interface DepCard {
  id: string;
  title: string;
  status: CardsStatusEnum;
  laneId: string;
  archived?: boolean;
}

/** How many rows are drawn before the list says how much it is not drawing. */
const SHOWN = 50;

/**
 * The cards this one waits on, picked.
 *
 * The list it replaced was one switch per card in board order, which is fine at eight cards and
 * unusable at two hundred: the one you have chosen scrolls away from the one you are choosing.
 * So the choices are hoisted out as chips above the list rather than left in place — a selected
 * row that moved would reorder the list under the cursor, and this way nothing moves at all.
 *
 * Two states the old field could not show, and they are why it needed replacing rather than
 * restyling. An **archived** dependency is invisible to the board query, so the dialog used to
 * load without it and drop it on the next save — it is drawn here, marked, and kept. And a row
 * that would close a **loop** is disabled with the reason on it, rather than offered and then
 * refused by the server after the card has already been written.
 */
export function CardDepsField({
  cardId,
  cards,
  laneNames,
  graph,
  value,
  onChange,
}: {
  /** The card being edited, or undefined for one that does not exist yet. */
  cardId?: string;
  /** Every card that could be waited on, in board order. */
  cards: DepCard[];
  /** Lane id to lane name, for the group headings. */
  laneNames: Map<string, string>;
  /** The board's dependency edges, for the cycle check. */
  graph: DepGraph;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [search, setSearch] = useState("");

  const byId = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  // A card with no id yet is in nobody's graph, so nothing it waits on can lead back to it.
  const cycles = useMemo(
    () => (cardId ? cyclingCards(cardId, graph) : new Set<string>()),
    [cardId, graph],
  );

  const needle = search.trim().toLowerCase();
  const matches = cards.filter(
    (card) =>
      !needle ||
      card.title.toLowerCase().includes(needle) ||
      (laneNames.get(card.laneId) ?? "").toLowerCase().includes(needle),
  );

  // Grouped by lane in board order, because "has this one been done" is a question about where
  // the card is, and a flat list of two hundred titles does not answer it.
  const groups: { laneId: string; rows: DepCard[] }[] = [];
  for (const card of matches.slice(0, SHOWN)) {
    const last = groups.at(-1);
    if (last?.laneId === card.laneId) last.rows.push(card);
    else groups.push({ laneId: card.laneId, rows: [card] });
  }
  const hidden = matches.length - Math.min(matches.length, SHOWN);

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((held) => held !== id) : [...value, id]);

  return (
    <div className="flex flex-col gap-2">
      <Label>Waits for</Label>
      <p className="text-xs text-muted-foreground">
        This card is skipped until every one of these is done. An expanding station sets them from
        the order it proposed; this is where a wrong one is corrected.
      </p>

      {value.length ? (
        <div className="flex flex-wrap gap-1">
          {value.map((id) => {
            const card = byId.get(id);
            return (
              <Badge key={id} variant="secondary" className="gap-1 pr-1">
                <span className="max-w-48 truncate">{card?.title || "an archived card"}</span>
                {card?.archived ? (
                  <span className="text-muted-foreground italic">archived</span>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-4"
                  title="Stop waiting on this"
                  onClick={() => toggle(id)}
                >
                  <X className="size-3" />
                </Button>
              </Badge>
            );
          })}
        </div>
      ) : null}

      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by title or lane"
      />

      <div className="flex max-h-64 flex-col gap-3 overflow-y-auto rounded-md border p-3">
        {groups.map((group) => (
          <div key={group.laneId} className="flex flex-col gap-1">
            <p className="text-xs font-medium text-muted-foreground">
              {laneNames.get(group.laneId) ?? "Archived"}
            </p>
            {group.rows.map((card) => {
              const looping = cycles.has(card.id);
              const held = value.includes(card.id);
              return (
                <button
                  key={card.id}
                  type="button"
                  disabled={looping && !held}
                  title={
                    looping && !held
                      ? "That card is already waiting on this one, directly or through others."
                      : undefined
                  }
                  className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-sm hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                  onClick={() => toggle(card.id)}
                >
                  <span
                    className={`size-3 shrink-0 rounded-sm border ${held ? "border-primary bg-primary" : ""}`}
                  />
                  <span className="min-w-0 truncate">{card.title || "Untitled"}</span>
                  <Badge
                    variant={CARD_STATUS_VARIANT[card.status]}
                    className={`ml-auto shrink-0 ${CARD_STATUS_CLASS[card.status] ?? ""}`}
                  >
                    {card.status}
                  </Badge>
                  {card.archived ? (
                    <span className="shrink-0 text-xs text-muted-foreground italic">archived</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
        {matches.length ? null : (
          <p className="text-xs text-muted-foreground">Nothing on this board matches.</p>
        )}
        {hidden ? (
          <p className="text-xs text-muted-foreground">…and {hidden} more. Search to narrow it.</p>
        ) : null}
      </div>
    </div>
  );
}
