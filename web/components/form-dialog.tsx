import type { ComponentType, ReactNode } from "react";
import { useId } from "react";
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
 * As much of a `useAppForm` form as this shell touches, described structurally so that this file
 * imports no form library — `app-form.tsx` is the only one that may.
 */
type DialogForm = {
  state: { isDefaultValue: boolean };
  handleSubmit: () => unknown;
  AppForm: ComponentType<{ children?: ReactNode }>;
  SubmitButton: ComponentType<{ form?: string; children?: ReactNode; pendingLabel?: ReactNode }>;
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
 * cubeui says there is no `FormDialog` — a form in a dialog is a `DialogLayout` with a `<form>`
 * as its `content` and the submit in `footerActions`, which is exactly what this is underneath.
 * What it adds is the guard over all four ways out: the shell's own `hasUnsavedChanges` covers
 * the three doors Radix owns and not the Cancel button, which is the most-clicked way out of
 * these seven (cubicecho/cubeui#2). When it can cover Cancel this file goes away.
 *
 * Whether there is anything to lose is the form's own answer — `isDefaultValue`, not `isDirty`,
 * because a field typed into and then typed back out of has nothing in it to throw away — and it
 * is read at the click rather than watched, so a keystroke does not re-render the dialog to
 * maintain a boolean nothing is drawing.
 */
export function FormDialog({
  form,
  title,
  description,
  width,
  onClose,
  alsoUnsaved,
  saveLabel = "Save",
  savingLabel = "Saving…",
  aside,
  children,
}: {
  form: DialogForm;
  title: React.ReactNode;
  description: React.ReactNode;
  width?: keyof typeof WIDTH;
  onClose: () => void;
  /**
   * Anything held outside the form that closing would also lose — the card dialog's dependency
   * picker is loaded and saved as a resource of its own, so it is not a field. Asked at the
   * click, like the form's own answer.
   */
  alsoUnsaved?: () => boolean;
  saveLabel?: React.ReactNode;
  savingLabel?: React.ReactNode;
  /**
   * Whatever belongs at the far end of the footer, away from Cancel and Save: a second action
   * of its own, or a word about why Save is refusing. Its presence is what splits the footer.
   */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  // The `<form>` is the dialog's body and the submit is in its footer, so the two are tied by
  // the `form` attribute rather than by containment.
  const formId = useId();
  const { close, guard } = useDiscardGuard(
    () => !form.state.isDefaultValue || (alsoUnsaved?.() ?? false),
    onClose,
  );

  return (
    <>
      <DialogLayout
        open
        onOpenChange={(open) => !open && close()}
        title={title}
        description={description}
        className={width && WIDTH[width]}
        content={
          <form
            id={formId}
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              form.handleSubmit();
            }}
          >
            {children}
          </form>
        }
        footer={aside}
        footerActions={
          <>
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <form.AppForm>
              <form.SubmitButton form={formId} pendingLabel={savingLabel}>
                {saveLabel}
              </form.SubmitButton>
            </form.AppForm>
          </>
        }
      />
      {guard}
    </>
  );
}
