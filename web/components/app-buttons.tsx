import type { ComponentProps } from "react";
import { ActionButton as Action } from "@/components/action-button";
import { ConfirmButton as Confirm } from "@/components/confirm-button";

/**
 * How long the pointer rests on a control before its tooltip opens.
 *
 * `web/main.tsx` puts this on the root provider, which is where an app says it and where every
 * plain `Tooltip` on the board reads it from.
 */
export const TOOLTIP_DELAY = 300;

/**
 * The two icon buttons, wearing this app's tooltip timing.
 *
 * Both render a `TooltipProvider` of their own, because a component installed from a registry
 * cannot assume the app it lands in has put one at the root — and a nested provider *replaces*
 * the one above it rather than merging with it. So the thirty-one of these across the app took
 * shadcn's default of `0` and opened the instant the pointer crossed them while every other
 * tooltip on the same screen waited a third of a second, which on a card's row of five reads as
 * a flicker rather than as an answer.
 *
 * There is no reading the root's value: Radix exposes no way to ask what a provider above you was
 * set to, so the number has to be said again. Said once here rather than at thirty-one call
 * sites, which is the shape a value that must not drift wants.
 */
export function ActionButton(props: ComponentProps<typeof Action>) {
  return <Action delayDuration={TOOLTIP_DELAY} {...props} />;
}

/** The same, for the one that asks first — its extra props reach the button underneath. */
export function ConfirmButton(props: ComponentProps<typeof Confirm>) {
  return <Confirm delayDuration={TOOLTIP_DELAY} {...props} />;
}
