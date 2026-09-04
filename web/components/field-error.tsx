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
 *
 * What is left here is that timing. The wiring it used to carry — the id, the
 * `aria-describedby`, the `aria-invalid`, the paragraph the two point at — belongs to
 * `FormField`, which mints the id and is the only thing that knows where the message is drawn.
 */
export function useFieldError(message: string) {
  const [touched, setTouched] = useState(false);

  return {
    invalid: Boolean(message),
    /** Spread onto the input or textarea. */
    field: { onBlur: () => setTouched(true) },
    /** The message, once the field has been visited. Falsy leaves the field unmarked. */
    error: touched ? message : "",
  };
}
