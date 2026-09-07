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
 * then refused by the server after the card has already been written; the reason is drawn under
 * that card, which is where the answer is wanted — a count of them under the field said how many
 * rows were greyed out and never which.
 *
 * An option is a row rather than a string, so a card is drawn here the way it is drawn
 * everywhere else: under the lane it sits in, with its status on the end in the same badge the
 * board uses. The heading is searched, so typing a lane's name still finds the cards in it; the
 * badge is not, which is why the status is still a keyword.
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
      cards.map((card) => {
        // Never the ones already held: a card that has come to close a loop must still be one
        // you can stop waiting on, which is the only way out of it.
        const loops = cycles.has(card.id) && !value.includes(card.id);
        return {
          value: card.id,
          // The archive is part of what the card *is* here rather than a decoration on it: it is
          // the difference between a dependency you can find on the board and one you cannot.
          // Said twice on purpose — the heading names the group in the list, and the suffix is
          // what the chip on the trigger carries, a chip being a string and nothing else.
          label: card.archived
            ? `${card.title || "Untitled"} (archived)`
            : card.title || "Untitled",
          // Not the lane an archived card kept: that is where restoring would put it back, not
          // somewhere you can go and find it.
          group: card.archived ? "Archived" : (laneNames.get(card.laneId) ?? "Archived"),
          meta: <CardStatusBadge status={card.status} />,
          keywords: [card.status],
          disabled: loops,
          hint: loops ? "Already waits on this card, directly or through others." : undefined,
        };
      }),
    [cards, cycles, laneNames, value],
  );

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
