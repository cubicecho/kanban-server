import { useState } from "react";
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

/**
 * The question a dialog should ask before it throws away what you typed in it.
 *
 * Escape, a click on the overlay and the Cancel button all close a dialog, and the first two are
 * things a person does by accident — Escape especially, since it is also how you dismiss the
 * select that half these forms open. Losing a paragraph of prompt to a stray keystroke is the
 * kind of small betrayal that teaches people not to trust a form.
 *
 * Used as a pair: `close` in place of the dialog's own `onClose`, and `guard` rendered inside
 * it. A clean form closes on the first press and never sees this at all.
 *
 * `dirty` is a function rather than a boolean because the only thing that ever asks is the
 * click, and a form library holds that answer in a store rather than in a render. Reading it
 * when the question is put means this hook needs no subscription of its own — and a shell that
 * subscribed would re-render every dialog on every keystroke to learn a boolean it looks at
 * once.
 */
export function useDiscardGuard(dirty: () => boolean, onClose: () => void) {
  const [asking, setAsking] = useState(false);

  return {
    /** Close, or ask first if there is anything to lose. */
    close: () => (dirty() ? setAsking(true) : onClose()),
    guard: (
      <AlertDialog open={asking} onOpenChange={setAsking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Throw away your changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Nothing here has been saved yet. Closing now leaves it as it was.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onClose}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    ),
  };
}
