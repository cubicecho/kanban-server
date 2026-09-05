/**
 * The two crossings between a picker and a column that holds an id.
 *
 * A picker says "nothing" with a sentinel, Radix refusing an empty item value; a column says it
 * with null. Both of these use `||` rather than `??` on purpose: an empty string is neither a
 * sentinel nor an id, and one that survives the crossing is written straight into a foreign key,
 * where the database refuses it with a message the browser reports as an internal error.
 */
export const forPicker = (id: string | null | undefined, sentinel: string) => id || sentinel;

/** The other way: whatever the picker holds, as an id or as no row at all. */
export const idOrNone = (value: string, ...sentinels: readonly string[]) =>
  value && !sentinels.includes(value) ? value : null;
