import { useMemo } from "react";
import type { CardsStatusEnum } from "@/__generated__/graphql";
import { FormField } from "@/components/form-field";
import { MultiSelect, type MultiSelectOption } from "@/components/multi-select";
import { cyclingCards, type DepGraph } from "@/lib/cards";

/** A card as this field needs to know it, which is the same for a live one and an archived one. */
export interface DepCard {
  id: string;
  title: string;
  status: CardsStatusEnum;
  laneId: string;
  archived?: boolean;
}

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
 * load without it and drop it on the next save — it is offered here, marked in its own label,
 * and kept. And a card that would close a **loop** is not offered at all, rather than offered and
 * then refused by the server after the card has already been written.
 *
 * Two things the old list said that this one does not, both being an option that is a row rather
 * than a string: which lane a card sits in, drawn as a heading over its group, and its status,
 * drawn as a badge on the end of it (cubicecho/cubeui#13). They are keywords on the option
 * meanwhile, so searching for a lane or for `done` still finds the cards in it. The reason a
 * looping card cannot be picked is the same shape of gap (cubicecho/cubeui#6) and is said once
 * under the field until an option can say it itself — which is better than nowhere, and was
 * where a count of them belonged anyway.
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
  /** Lane id to lane name, for the search keywords. */
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

  const options: MultiSelectOption[] = useMemo(
    () =>
      cards.map((card) => ({
        value: card.id,
        // The archive is part of what the card *is* here rather than a decoration on it: it is
        // the difference between a dependency you can find on the board and one you cannot.
        label: card.archived ? `${card.title || "Untitled"} (archived)` : card.title || "Untitled",
        keywords: [laneNames.get(card.laneId) ?? "Archived", card.status],
        // Never the ones already held: a card that has come to close a loop must still be one
        // you can stop waiting on, which is the only way out of it.
        disabled: cycles.has(card.id) && !value.includes(card.id),
      })),
    [cards, cycles, laneNames, value],
  );

  const refused = options.filter((option) => option.disabled).length;

  return (
    <FormField
      label="Waits for"
      description={
        <>
          This card is skipped until every one of these is done. An expanding station sets them from
          the order it proposed; this is where a wrong one is corrected. Search matches the lane and
          the status as well as the title.
          {refused
            ? ` ${refused} ${refused === 1 ? "card is" : "cards are"} greyed out: each already waits on this one, directly or through others.`
            : null}
        </>
      }
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
