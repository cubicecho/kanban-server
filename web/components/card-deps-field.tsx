import { Check, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { CardsStatusEnum } from "@/__generated__/graphql";
import { ActionButton } from "@/components/action-button";
import { FormField } from "@/components/form-field";
import { CardStatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cyclingCards, type DepGraph } from "@/lib/cards";
import { cn } from "@/lib/utils";

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
    <FormField
      // Chips, a search box and a list of checkboxes: a field, but not one element, so the
      // heading names the group rather than pointing a `for` at a `<div>`.
      asGroup
      label="Waits for"
      description="This card is skipped until every one of these is done. An expanding station sets them from the order it proposed; this is where a wrong one is corrected."
      control={(props) => (
        <div {...props} className="flex flex-col gap-2">
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
                    <ActionButton
                      variant="ghost"
                      size="icon"
                      className="-my-1 -mr-1 size-6"
                      label={`Stop waiting on ${card?.title || "an archived card"}`}
                      hint="Stop waiting on this"
                      onClick={() => toggle(id)}
                    >
                      <X className="size-3.5" />
                    </ActionButton>
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
                  // The tooltip hangs off the label rather than the input, for the reason
                  // `ActionButton` exists: a disabled control never fires the hover, and why this
                  // row cannot be picked is the one thing a person wants off it.
                  const row = (
                    <label
                      key={card.id}
                      className={cn(
                        "flex w-full items-center gap-2 rounded px-1 py-1 text-left text-sm",
                        looping && !held
                          ? "cursor-not-allowed opacity-40"
                          : "cursor-pointer hover:bg-muted/60",
                      )}
                    >
                      {/* A real checkbox, kept off-screen: the row used to say "chosen" with a
                      filled 12px square, which is colour alone — nothing to a screen reader,
                      and little to anyone who cannot tell the two greys apart. */}
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={held}
                        disabled={looping && !held}
                        onChange={() => toggle(card.id)}
                      />
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-sm border",
                          "peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
                          held && "border-primary bg-primary text-primary-foreground",
                        )}
                      >
                        {held ? <Check className="size-3" /> : null}
                      </span>
                      <span className="min-w-0 truncate">{card.title || "Untitled"}</span>
                      <CardStatusBadge status={card.status} className="ml-auto shrink-0" />
                      {card.archived ? (
                        <span className="shrink-0 text-xs text-muted-foreground italic">
                          archived
                        </span>
                      ) : null}
                    </label>
                  );
                  return looping && !held ? (
                    <Tooltip key={card.id}>
                      <TooltipTrigger asChild>{row}</TooltipTrigger>
                      <TooltipContent side="left">
                        That card is already waiting on this one, directly or through others.
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    row
                  );
                })}
              </div>
            ))}
            {matches.length ? null : (
              <p className="text-xs text-muted-foreground">Nothing on this board matches.</p>
            )}
            {hidden ? (
              <p className="text-xs text-muted-foreground">
                …and {hidden} more. Search to narrow it.
              </p>
            ) : null}
          </div>
        </div>
      )}
    />
  );
}
