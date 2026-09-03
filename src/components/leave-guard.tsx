import { useBlocker } from "@tanstack/react-router";
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
 * The same question `useDiscardGuard` asks, for a page rather than a dialog.
 *
 * A dialog has one way out and it was guarded; a page has the whole sidebar, and Settings — the
 * longest form in the app, and the only one whose values every agent on the server falls back to
 * — threw away an afternoon's editing on a stray click with no more warning than the words
 * "Unsaved changes" in a corner. That is the same small betrayal the dialogs were fixed for.
 *
 * `enableBeforeUnload` covers the other two ways out, a closed tab and a reload, which the router
 * cannot intercept and the browser will only ever phrase in its own words.
 *
 * Used as a pair, like the discard guard: call it with whether there is anything to lose and
 * render what comes back somewhere inside the page.
 */
export function useLeaveGuard(dirty: boolean) {
  const blocker = useBlocker({
    shouldBlockFn: () => dirty,
    enableBeforeUnload: () => dirty,
    withResolver: true,
  });

  return (
    <AlertDialog open={blocker.status === "blocked"} onOpenChange={() => blocker.reset?.()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
          <AlertDialogDescription>
            Nothing on this page has been saved yet. Leaving now leaves it as it was.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => blocker.reset?.()}>Keep editing</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => blocker.proceed?.()}>
            Discard
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
