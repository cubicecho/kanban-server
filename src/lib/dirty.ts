import { useRef } from "react";

/**
 * Whether a form has been changed since it opened.
 *
 * Every dialog in this app is a handful of `useState` seeded from a row and written back on
 * save, so "dirty" is just: does what is on screen still match what was there when it opened?
 * That is a comparison rather than a flag, which matters because a flag set by every `onChange`
 * would call a field typed into and then typed back out of a change — and then ask whether to
 * throw away nothing.
 *
 * The snapshot is taken on the first render and never again — or, where a form is still waiting
 * on a query for part of its initial value, on the first render `ready` is true. Without that,
 * an answer arriving into a field would itself read as an edit, and closing an untouched dialog
 * would ask whether to throw away what the server had just said.
 */
export function useDirty(current: Record<string, unknown>, ready = true): boolean {
  const snapshot = JSON.stringify(current);
  const initial = useRef<string | null>(null);
  if (initial.current === null && ready) initial.current = snapshot;
  return initial.current !== null && initial.current !== snapshot;
}
