import { cn } from "@/lib/utils";

/**
 * The small grey line under a title: a lane, an agent, a time, a duration, separated by dots.
 *
 * Every list in the app draws one, and each of them built it by concatenation — `agent ? \`${agent} · \` : ""`
 * over and over — which puts the separator in the hands of the part before it. The result was a
 * line that began or ended with a stray dot whenever the middle of it happened to be empty.
 * Here the parts are values and the separators are worked out from which of them survived.
 */
export function MetaLine({
  parts,
  className,
}: {
  /** Anything falsy is not a part: it is a thing there was nothing to say about. */
  parts: React.ReactNode[];
  className?: string;
}) {
  const shown = parts.filter(Boolean);
  if (!shown.length) return null;
  return (
    <span className={cn("text-xs text-muted-foreground", className)}>
      {shown.map((part, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the parts are positional by construction — a list of facts about one row, not a collection
        <span key={index}>
          {index ? <span aria-hidden> · </span> : null}
          {part}
        </span>
      ))}
    </span>
  );
}
