import { useDiscardGuard } from "@/components/discard-guard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** How wide the form wants to be. Undefined is the primitive's own width. */
const WIDTH = {
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
  "2xl": "sm:max-w-2xl",
};

/**
 * A form in a dialog: the seven of them on this server differ in their fields and in nothing else.
 *
 * Every one had written out the same shell — the open/close wiring, a header, a scrolling body,
 * a footer with a ghost Cancel and a Save that says "Saving…" — and the thing worth noticing is
 * what that cost. Six closed through `useDiscardGuard`, so Escape or a stray click on the overlay
 * asks before it throws away what you typed; the seventh wired `onOpenChange` straight into its
 * `onClose` and quietly lost it. That is not a bug anybody introduced, it is the one copy that
 * was written before the guard existed and never caught up, and a shell is how it stops
 * happening: the guard is not a thing a caller can forget, because a caller cannot see it.
 *
 * `dirty` is asked for rather than worked out here, because only the caller knows what its
 * fields are — pass `useDirty({ ...the state })`.
 */
export function FormDialog({
  title,
  description,
  width,
  dirty,
  onClose,
  onSave,
  saving,
  canSave = true,
  saveLabel = "Save",
  savingLabel = "Saving…",
  aside,
  children,
}: {
  title: React.ReactNode;
  description: React.ReactNode;
  width?: keyof typeof WIDTH;
  /** Whether there is anything to lose, which is what decides if closing asks first. */
  dirty: boolean;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  /** Whether the form is in a state worth saving. */
  canSave?: boolean;
  saveLabel?: string;
  savingLabel?: string;
  /**
   * Whatever belongs at the far end of the footer, away from Cancel and Save: a second action
   * of its own, or a word about why Save is refusing. Its presence is what splits the footer.
   */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { close, guard } = useDiscardGuard(dirty, onClose);

  const buttons = (
    <>
      <Button variant="ghost" onClick={close}>
        Cancel
      </Button>
      <Button onClick={onSave} disabled={!canSave || saving}>
        {saving ? savingLabel : saveLabel}
      </Button>
    </>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className={cn("max-h-[90vh] overflow-y-auto", width && WIDTH[width])}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {children}

        {aside ? (
          <DialogFooter className="sm:justify-between">
            {aside}
            <div className="flex gap-2">{buttons}</div>
          </DialogFooter>
        ) : (
          <DialogFooter>{buttons}</DialogFooter>
        )}

        {guard}
      </DialogContent>
    </Dialog>
  );
}
