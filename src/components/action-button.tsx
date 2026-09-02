import type { VariantProps } from "class-variance-authority";
import { Button, type buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * A button whose reason can always be read — including when it cannot be pressed.
 *
 * The app was full of `title="Empty the lane first"` on controls disabled for exactly that
 * reason, and `Button` sets `disabled:pointer-events-none`: the browser never fires the
 * hover, so the one explanation a person needed was the one they could not get. A `disabled`
 * button is also out of the tab order entirely, so a keyboard user could not reach the
 * answer by any route at all.
 *
 * So `disabled` here is `aria-disabled` instead: the control keeps its focus ring, its hover
 * and its tooltip, and the press is refused in the handler. Assistive tech reads it as
 * unavailable either way.
 *
 * `label` is not optional. Nearly every icon-only control in here had no accessible name at
 * all — `title` is a hint, not a label — and making it a required prop is what stops the next
 * one arriving the same way.
 */
export function ActionButton({
  label,
  hint,
  side = "top",
  disabled,
  className,
  onClick,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** The accessible name, and the tooltip when there is nothing more to say. */
    label: string;
    /** Why it is unavailable, or what it will do — shown instead of `label` when given. */
    hint?: string;
    side?: "top" | "right" | "bottom" | "left";
  }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          aria-disabled={disabled || undefined}
          className={cn(disabled && "opacity-50", className)}
          onClick={(event) => {
            if (disabled) {
              event.preventDefault();
              return;
            }
            onClick?.(event);
          }}
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={side}>{hint ?? label}</TooltipContent>
    </Tooltip>
  );
}
