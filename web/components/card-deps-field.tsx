import { useMemo } from "react";
import type { CardsStatusEnum } from "@/__generated__/graphql";
import { FormField } from "@/components/form-field";
import { MultiSelect, type MultiSelectOption } from "@/components/multi-select";
import { CardStatusBadge } from "@/components/status-badge";
import { cyclingCards, type DepGraph } from "@/lib/cards";

/** A card as this field needs to know it, which is the same for a live one and an archived one. */
export interface DepCard {
  id: string;
  title: string;
  status: CardsStatusEnum;
  laneId: string;
  archived?: boolean;
}

/** The heading archived cards are drawn under: they keep a `laneId`, but not a place in it. */
const ARCHIVED_GROUP = "Archived";

/**
 * The cards this one waits on, picked.
 *
 * A combobox rather than the list of switches this began as: one switch per card is fine at
 * eight cards and unusable at two hundred, because the one you have chosen scrolls away from the
 * one you are choosing. It is `MultiSelect` rather than a list written here, so the popover, the
 * roving focus and the typeahead are the ones every other picker on this server uses.
 *
 * Two states the switches could not show, and they are why it needed replacing rather than
 * restyling. An **archived** dependency is invisible to the board query, so the dialog used to
 * load without it and drop it on the next save — it is offered here, under its own heading, and
 * kept. And a card that would close a **loop** is not offered at all, rather than offered and
 * then refused by the server after the card has already been written.
 *
 * An option is a row rather than a string, so the three things a card is are each drawn as what
 * they are: its lane is the heading over its group, its status is a badge on the end of it, and
 * the reason a looping card cannot be picked is a line under it. That last is the one that had
 * nowhere else to go — a `disabled` row fires no hover, so a tooltip on it is text nobody can
 * reach, and the count of them this field used to append to its own description said how many
 * were refused without saying which, or why any particular one was.
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
  /** Every card that could be waited on. */
  cards: DepCard[];
  /** Lane id to lane name, in board order — which is the order the groups are drawn in. */
  laneNames: Map<string, string>;
  /** The board's dependency edges, for the cycle check. */
  graph: DepGraph;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  // A card with no id yet is in nobody's graph, so nothing it waits on can lead back to it.
  const cycles = useMemo(
    () => (cardId ? cyclingCards(cardId, graph) : new Set<string>()),
    [cardId, graph],
  );

  const options: MultiSelectOption[] = useMemo(() => {
    const option = (card: DepCard): MultiSelectOption => {
      // Never the ones already held: a card that has come to close a loop must still be one you
      // can stop waiting on, which is the only way out of it.
      const loops = cycles.has(card.id) && !value.includes(card.id);
      return {
        value: card.id,
        // The heading says it too, but a chip is a string and the heading is not on it — so the
        // one place a person reads their choices back would not say which of them are off the
        // board.
        label: card.archived ? `${card.title || "Untitled"} (archived)` : card.title || "Untitled",
        group: card.archived ? ARCHIVED_GROUP : (laneNames.get(card.laneId) ?? ARCHIVED_GROUP),
        // The status is drawn rather than spelt, and searched all the same: `meta` is a node, so
        // the word itself has to be a keyword or typing `done` would stop finding anything.
        meta: <CardStatusBadge status={card.status} />,
        keywords: [card.status],
        disabled: loops,
        hint: loops ? "Already waits on this card, directly or through others." : undefined,
      };
    };

    // Grouped by hand rather than left in the order the board handed them over, because
    // `MultiSelect` draws a heading per *run* of options that share one: a lane whose cards are
    // not consecutive is drawn as that lane twice. The lane order is `laneNames`', which is the
    // board's, and within a lane the incoming order is position.
    const byLane = new Map<string, DepCard[]>();
    const archived: DepCard[] = [];
    for (const card of cards) {
      if (card.archived) {
        archived.push(card);
        continue;
      }
      const lane = byLane.get(card.laneId);
      if (lane) lane.push(card);
      else byLane.set(card.laneId, [card]);
    }

    const rows: MultiSelectOption[] = [];
    for (const laneId of laneNames.keys()) {
      for (const card of byLane.get(laneId) ?? []) rows.push(option(card));
      byLane.delete(laneId);
    }
    // A lane `laneNames` has not got is one this client is older than: drawn last rather than
    // dropped, a dependency you cannot see being the bug this field exists to fix.
    for (const lane of byLane.values()) for (const card of lane) rows.push(option(card));
    for (const card of archived) rows.push(option(card));
    return rows;
  }, [cards, cycles, laneNames, value]);

  return (
    <FormField
      label="Waits for"
      description="This card is skipped until every one of these is done. An expanding station sets them from the order it proposed; this is where a wrong one is corrected. Search matches the lane and the status as well as the title."
      // The function form, because a `Popover` root renders no DOM of its own and a clone would
      // swallow the id and the description in silence.
      control={(wiring) => (
        <MultiSelect
          {...wiring}
          options={options}
          value={value}
          onValueChange={onChange}
          placeholder="Nothing — this card can start straight away"
          searchPlaceholder="Search by title, lane or status"
          searchLabel="Search cards"
          popoverLabel="Cards this one waits on"
          emptyMessage="Nothing on this board matches."
        />
      )}
    />
  );
}
