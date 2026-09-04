import { DialogLayout } from "@/components/dialog-layout";
import { useDiscardGuard } from "@/components/discard-guard";
import { Button } from "@/components/ui/button";

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
 *
 * The chassis is cubeui's `DialogLayout`, which is where the header and the footer stay put
 * while the body scrolls between them — this had `overflow-y-auto` on the whole dialog, so a
 * long form took its own title off the screen before its Save button. The guard stays here
 * rather than moving to the shell's `hasUnsavedChanges`, because that prop covers the three
 * doors Radix owns and not the Cancel button, which is the most-clicked way out of these seven
 * (cubicecho/cubeui#2). One guard over all four doors is the property worth keeping; when the
 * shell can cover Cancel this file is a `DialogLayout` call and nothing else.
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

  return (
    <>
      <DialogLayout
        open
        onOpenChange={(open) => !open && close()}
        title={title}
        description={description}
        className={width && WIDTH[width]}
        content={children}
        footer={aside}
        footerActions={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={!canSave || saving}>
              {saving ? savingLabel : saveLabel}
            </Button>
          </>
        }
      />
      {guard}
    </>
  );
}
