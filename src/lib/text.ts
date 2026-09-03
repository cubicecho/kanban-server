/**
 * "1 lane", "3 lanes" — the `count === 1 ? "" : "s"` this replaces was in thirteen places.
 *
 * Thirteen copies of a ternary is not a bug until one of them is `attempt`/`attempts`, at which
 * point the shape of the thing has to be remembered rather than read.
 */
export const plural = (count: number, one: string, many = `${one}s`): string =>
  `${count} ${count === 1 ? one : many}`;

/**
 * A list of names that stops at three: "Doing on Website, Review on API and 2 more".
 *
 * Written out three times across the pages that name what a delete is about to take with it,
 * and a hint that trails off differently in each of them is a hint that reads as a different
 * kind of warning.
 */
export function nameList(names: string[], limit = 3): string {
  const rest = names.length - limit;
  const shown = names.slice(0, limit).join(", ");
  return rest > 0 ? `${shown} and ${rest} more` : shown;
}
