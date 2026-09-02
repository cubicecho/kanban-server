import { CardsStatusEnum } from "@/gql/graphql";

/**
 * How a card's status is drawn, wherever one is drawn — the board and the archive both.
 *
 * The two of them kept their own copy of this map until `rejected` arrived, and a status that
 * means one thing on the board and another in the archive is worse than no colour at all.
 */

/** The base badge for each status. Grey unless there is a reason not to be. */
export const CARD_STATUS_VARIANT: Record<CardsStatusEnum, "destructive" | "outline" | "secondary"> =
  {
    [CardsStatusEnum.Error]: "destructive",
    [CardsStatusEnum.Rejected]: "outline",
    [CardsStatusEnum.Running]: "outline",
    [CardsStatusEnum.Done]: "secondary",
    [CardsStatusEnum.Idle]: "secondary",
  };

/**
 * The two statuses worth spotting from across a board, and they are deliberately only two: a
 * board where everything is coloured says nothing.
 *
 * `running` is green, the colour the run stream already uses for a live run. `rejected` is
 * amber and not red, because that is the whole point of it being its own word — a reviewer
 * saying no is the board working and wants a decision, where red is a fault and wants looking
 * at. Telling the two apart at a glance is what a person comes to the board for.
 */
export const CARD_STATUS_CLASS: Partial<Record<CardsStatusEnum, string>> = {
  [CardsStatusEnum.Running]:
    "border-emerald-600/30 bg-emerald-500/15 text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-400",
  [CardsStatusEnum.Rejected]:
    "border-amber-600/30 bg-amber-500/15 text-amber-700 dark:border-amber-400/30 dark:text-amber-400",
};

/** A card waiting on a person: one that was turned down, or one that broke. */
export const needsAttention = (status: CardsStatusEnum) =>
  status === CardsStatusEnum.Error || status === CardsStatusEnum.Rejected;
