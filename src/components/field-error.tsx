import { useState } from "react";

/**
 * A required field's complaint, said next to the field.
 *
 * The pattern this replaces was `throw new Error("A card needs a title.")` from inside the
 * mutation: the message arrived as a toast in the far corner, a second after the button was
 * pressed, while the field it was about sat unmarked at the top of the dialog. Some of those
 * messages named a database column rather than the label above the box.
 *
 * It waits for a blur before it says anything, because a form that opens already telling you
 * off for the thing you have not typed yet is not helping. The submit button is disabled
 * throughout either way — `invalid` is true from the first render, `error` only once the field
 * has been visited.
 */
export function useFieldError(id: string, message: string) {
  const [touched, setTouched] = useState(false);
  const showing = touched && Boolean(message);

  return {
    invalid: Boolean(message),
    /** Spread onto the input or textarea. */
    field: {
      "aria-invalid": Boolean(message) || undefined,
      "aria-describedby": showing ? `${id}-error` : undefined,
      onBlur: () => setTouched(true),
    },
    error: showing ? (
      <p id={`${id}-error`} className="text-xs text-destructive">
        {message}
      </p>
    ) : null,
  };
}
