/**
 * The two things every page that draws a run needs, in one place.
 *
 * The Runs page had both to itself until a card grew a history of its own, and a run drawn one
 * way on one page and another way on the next is a run somebody has to read twice. Its status
 * is the third of them and lives in `@/components/status-badge`, beside a card's.
 */

/** How long a run took, or that it is still going. */
export const duration = (from: string, to?: string | null) =>
  to ? `${((new Date(to).getTime() - new Date(from).getTime()) / 1000).toFixed(1)}s` : "running…";

/** 1234 → "1.2k". A run's totals get long, and nobody reads the last three digits. */
export function compactTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return String(tokens);
}
