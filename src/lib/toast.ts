import { toast } from "sonner";

/**
 * How a write that failed is said, in one place.
 *
 * Every mutation on every page ended in the same line — seven files had even hoisted it to the
 * same local `const onError` — and a message a person only sees when something has gone wrong
 * is exactly the one nobody notices has drifted. Pass it as the handler itself:
 * `onError: toastError`.
 */
export const toastError = (error: Error) => toast.error(error.message);
