import type { VariantProps } from "class-variance-authority";
import { useState } from "react";
import { ActionButton } from "@/components/action-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { buttonVariants } from "@/components/ui/button";

/**
 * A button that asks first.
 *
 * Every delete in this app was one click and permanent — a card, a lane, an agent, a role, an
 * MCP server, a run, a task, and the archive's "delete for good". Several of them reach past
 * the board you are looking at: a role is a kind of lane on every board on the server, and a
 * lane takes its cards with it.
 *
 * `description` is required and is meant to say what is lost, not to ask again. "This cannot
 * be undone" is what the dialog already implies; "the lane takes its cards with it" is the
 * thing the person did not know.
 */
export function ConfirmButton({
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
  ...props
}: React.ComponentProps<typeof ActionButton> &
  VariantProps<typeof buttonVariants> & {
    /** The question, as a heading. */
    title: string;
    /** What happens if they say yes. */
    description: React.ReactNode;
    confirmLabel?: string;
    onConfirm: () => void;
  }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <ActionButton {...props} onClick={() => setOpen(true)} />
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onConfirm}>
              {confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
