/**
 * "1 lane", "3 lanes" — the `count === 1 ? "" : "s"` this replaces was in thirteen places.
 *
 * Thirteen copies of a ternary is not a bug until one of them is `attempt`/`attempts`, at which
 * point the shape of the thing has to be remembered rather than read.
 */
export const plural = (count: number, one: string, many = `${one}s`): string =>
  `${count} ${count === 1 ? one : many}`;
