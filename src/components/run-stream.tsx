import { memo, useEffect, useRef, useState } from "react";
import { TokenStats, type Usage } from "@/components/token-stats";
import { RunEventsDocument, type RunEventsSubscription } from "@/gql/graphql";
import { subscribe } from "@/lib/gql";
import { cn } from "@/lib/utils";

type RunEvent = RunEventsSubscription["runEvents"];

/**
 * Consecutive tokens of the same kind are one thing being said, not hundreds of things.
 *
 * Folding them is what keeps this affordable: a reasoning model spends ten thousand tokens on a
 * one-line answer, and ten thousand list items — or ten thousand renders — is a locked-up tab.
 * Folded, that is one paragraph that grows, and the reasoning reads as prose besides.
 */
interface Block {
  seq: number;
  kind: string;
  name: string;
  ok?: boolean | null;
  text: string;
}

const mergeable = (kind: string) => kind === "thinking" || kind === "output";

/**
 * Folds one event into a list the caller already owns, in place.
 *
 * A batch is a hundred tokens at the far end of a run that is already thousands of blocks long,
 * and copying the whole list per token is quadratic in exactly the case this component exists
 * for. The list is copied once per batch instead, and every event of that batch is written into
 * it. The blocks themselves are still replaced rather than edited, so a memoised `BlockView`
 * redraws the one that grew and none of the ones that did not.
 */
function appendInto(blocks: Block[], event: RunEvent) {
  const last = blocks[blocks.length - 1];
  if (last && mergeable(event.kind) && last.kind === event.kind) {
    blocks[blocks.length - 1] = { ...last, text: last.text + event.text };
    return;
  }
  blocks.push({
    seq: event.seq,
    kind: event.kind,
    name: event.name,
    ok: event.ok,
    text: event.text,
  });
}

/** Tokens arrive faster than anyone can read them; redraw on a human timescale instead. */
const FLUSH_MS = 100;

/**
 * A run as it happens: what the model is thinking, what it is writing, and which tools it is
 * reaching for — the middle of a run, which the row it leaves behind cannot show.
 *
 * The server replays the run from the beginning, so opening this halfway through a long run is
 * the same as having watched it from the start.
 */
export function RunStream({
  runId,
  className,
}: {
  runId: string;
  /** Overrides the scroller's height, for the places with more room than a card has. */
  className?: string;
}) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  // The running totals, kept apart from the blocks: a `usage` event is not something the run
  // said, it is what the run has cost, and it belongs in the header where it can be watched
  // rather than in the log where it would scroll away.
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState("");
  const [ended, setEnded] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  // Whether the reader is at the bottom, sampled before the new output lands rather than after
  // — once it has been drawn, the answer is always no.
  const following = useRef(true);

  useEffect(() => {
    setBlocks([]);
    setUsage(null);
    setError("");
    setEnded(false);

    // A reconnect replays the run from the start, so the sequence is what says where we were.
    let seen = 0;
    let pending: RunEvent[] = [];
    const flush = () => {
      if (pending.length === 0) return;
      const batch = pending;
      pending = [];
      // Only the newest of a batch matters: each usage event carries the run's totals, not the
      // turn's, so the last one is the answer and the ones before it are history.
      const counted = batch.filter((event) => event.kind === "usage").pop();
      if (counted?.usage) setUsage(counted.usage);
      const said = batch.filter((event) => event.kind !== "usage");
      if (said.length === 0) return;
      setBlocks((prev) => {
        const next = prev.slice();
        for (const event of said) appendInto(next, event);
        return next;
      });
    };
    const timer = setInterval(flush, FLUSH_MS);

    const unsubscribe = subscribe(
      RunEventsDocument,
      { runId },
      {
        next: ({ runEvents: event }) => {
          if (event.seq <= seen) return;
          seen = event.seq;
          pending.push(event);
        },
        // A dropped connection is the end of this stream whatever the run is doing: the dot
        // said "Live" next to the error that had just killed it.
        error: (failure) => {
          setError(failure.message);
          setEnded(true);
        },
        complete: () => {
          flush();
          setEnded(true);
        },
      },
    );

    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [runId]);

  // Follow the output only for a reader who was already at the bottom. Scrolling back to
  // re-read something a long run said ten seconds ago was impossible before: the next flush,
  // a tenth of a second later, dragged the view back down again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: following new output is the point.
  useEffect(() => {
    const element = scroller.current;
    if (element && following.current) element.scrollTop = element.scrollHeight;
  }, [blocks]);

  const onScroll = () => {
    const element = scroller.current;
    if (element)
      following.current = element.scrollHeight - element.scrollTop - element.clientHeight < 40;
  };

  return (
    // `min-w-0` all the way down: a dialog lays its content out in a grid, whose items are
    // `min-width: auto` and so refuse to shrink below their longest unbreakable word. One
    // minified JSON tool result was enough to push the whole run past the dialog's edge.
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span
          className={cn(
            "size-2 rounded-full",
            ended ? "bg-muted-foreground" : "animate-pulse bg-status-running",
          )}
        />
        {ended ? "Run ended" : "Live"}
        {usage ? (
          <>
            <span aria-hidden>·</span>
            <TokenStats usage={usage} />
          </>
        ) : null}
        {error ? <span className="text-destructive">· {error}</span> : null}
      </div>

      <div
        ref={scroller}
        onScroll={onScroll}
        role="log"
        aria-live="polite"
        aria-label="Run output"
        className={cn(
          "max-h-80 min-w-0 overflow-y-auto rounded-md border bg-muted/30 p-3",
          className,
        )}
      >
        {blocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Waiting for the model…</p>
        ) : null}
        <div className="flex min-w-0 flex-col gap-2">
          {blocks.map((block) => (
            <BlockView key={`${block.kind}-${block.seq}`} block={block} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Memoised: a token arriving grows the last block and leaves every earlier one identical, so
 * a run that has said ten thousand things redraws one paragraph rather than all of them.
 */
const BlockView = memo(function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case "thinking":
      return (
        <p className="wrap-anywhere whitespace-pre-wrap border-l-2 pl-2 text-sm text-muted-foreground italic">
          {block.text}
        </p>
      );
    case "output":
      return <p className="wrap-anywhere whitespace-pre-wrap text-sm">{block.text}</p>;
    case "tool-call":
      return (
        <p className="font-mono text-xs wrap-anywhere text-muted-foreground">
          → {block.name}({block.text})
        </p>
      );
    case "tool-result":
      return (
        <p
          className={cn(
            "wrap-anywhere font-mono text-xs whitespace-pre-wrap",
            block.ok ? "text-muted-foreground" : "text-destructive",
          )}
        >
          ← {block.name}: {block.text}
        </p>
      );
    case "turn":
      return (
        <p className="wrap-anywhere border-t pt-2 text-xs tracking-wide text-muted-foreground uppercase">
          {block.text}
        </p>
      );
    default:
      // `notice` and `done`: the runner speaking rather than the model.
      return <p className="wrap-anywhere text-xs text-muted-foreground">{block.text}</p>;
  }
});
