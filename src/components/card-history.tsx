import { useQuery } from "@tanstack/react-query";
import { ArrowDownUp, ChevronRight } from "lucide-react";
import { useState } from "react";
import { RunStream } from "@/components/run-stream";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CardRunsDocument, type CardRunsQuery, RunsVerdictEnum } from "@/gql/graphql";
import { request } from "@/lib/gql";
import { duration, RUN_STATUS_VARIANT } from "@/lib/runs";
import { cn } from "@/lib/utils";

type Run = CardRunsQuery["runs"][number];
type Move = CardRunsQuery["cardEvents"][number];

/** One line of the story: a run, the move it caused, or a move nothing ran for. */
type Entry = { id: string; at: string; run?: Run; event?: Move };

/**
 * What became of this card, and why — the two records merged into the one story they tell.
 *
 * `runs` are what agents did; `cardEvents` are what happened to the card. They overlap where an
 * agent's verdict moved it, and each has something the other cannot say: a run knows what was
 * output and what it cost, and only an event knows that a person dragged the card back on a
 * Tuesday. An event naming a run is folded into that run's line rather than drawn twice.
 */
const merge = (runs: Run[], events: Move[]): Entry[] => {
  const byRun = new Map<string, Move>();
  for (const event of events)
    if (event.runId && !byRun.has(event.runId)) byRun.set(event.runId, event);

  const folded = new Set<string>();
  const entries: Entry[] = runs.map((run) => {
    const event = byRun.get(run.id);
    if (event) folded.add(event.id);
    return { id: run.id, at: run.startedAt, run, event };
  });
  // Whatever is left is a move with no run beside it: a person's, or one whose run has fallen
  // out of the window the query asks for. Both are still things that happened to the card.
  for (const event of events)
    if (!folded.has(event.id)) entries.push({ id: event.id, at: event.createdAt, event });

  return entries.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
};

/** Where a move took the card, in the words a person would use for it. */
const moved = (event: Move): string => {
  const from = event.fromLane?.name;
  const to = event.toLane?.name;
  if (!from && to) return `added to ${to}`;
  if (from && !to) return `archived from ${from}`;
  if (from && to && from !== to) return `${from} → ${to}`;
  return to ? `judged in ${to}` : "moved";
};

/**
 * A verdict is the one thing worth a colour of its own here: it is why the card moved.
 *
 * It said so and then drew both of them grey. They take the board's own two status colours —
 * a FAIL is amber like a `rejected` card, because it is the same event seen from the run's
 * side, and red stays what it has always been here, which is a fault.
 */
function VerdictBadge({ verdict }: { verdict: RunsVerdictEnum }) {
  if (verdict === RunsVerdictEnum.None) return null;
  const failed = verdict === RunsVerdictEnum.Fail;
  return (
    <Badge
      variant="outline"
      className={
        failed
          ? "border-status-rejected/30 bg-status-rejected/15 text-status-rejected-foreground"
          : "border-status-running/30 bg-status-running/15 text-status-running-foreground"
      }
    >
      {failed ? "FAIL" : "PASS"}
    </Badge>
  );
}

/**
 * A card's history, oldest first.
 *
 * Oldest first because it is a story and a story only reads forwards — a rejection makes sense
 * after the attempt it was about, and nonsense before it. The Runs page is the other way round
 * on purpose: it is a firehose across a whole board, where the last thing to happen is the one
 * being looked for. The order is said out loud rather than left to be worked out, and the
 * button inverts it.
 */
export function CardHistory({ cardId }: { cardId: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const [oldestFirst, setOldestFirst] = useState(true);
  const history = useQuery({
    queryKey: ["card-runs", cardId],
    queryFn: () => request(CardRunsDocument, { cardId }),
    // A card open while an agent is working it is the one time this changes under the reader.
    refetchInterval: (query) =>
      query.state.data?.runs.some((run) => run.status === "running") ? 3000 : false,
  });

  const entries = merge(history.data?.runs ?? [], history.data?.cardEvents ?? []);
  if (!entries.length) return null;
  const rows = oldestFirst ? entries : [...entries].reverse();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>History</Label>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-muted-foreground"
          onClick={() => setOldestFirst((current) => !current)}
        >
          <ArrowDownUp className="size-3" />
          {oldestFirst ? "oldest first" : "newest first"}
        </Button>
      </div>
      <div className="flex max-h-72 flex-col gap-2 overflow-y-auto rounded-md border p-3">
        {rows.map(({ id, at, run, event }) => {
          const running = run?.status === "running";
          // The reason a card moved is the whole value of a review, so the first line of it is
          // read without opening anything. The rest is behind the click, with the output.
          const reason = event?.note?.body.split("\n")[0] ?? "";
          return (
            <div key={id} className="flex flex-col gap-1">
              <button
                type="button"
                className="flex w-full items-center gap-2 text-left"
                disabled={!run}
                aria-expanded={run ? open === id : undefined}
                onClick={() => run && setOpen(open === id ? null : id)}
              >
                <ChevronRight
                  aria-hidden
                  className={cn(
                    "size-3 shrink-0 text-muted-foreground transition-transform",
                    !run && "invisible",
                    open === id && "rotate-90",
                  )}
                />
                {run ? (
                  <>
                    <VerdictBadge verdict={run.verdict} />
                    <Badge variant={RUN_STATUS_VARIANT[run.status] ?? "secondary"}>
                      {run.status}
                    </Badge>
                  </>
                ) : (
                  <Badge variant="secondary">{event?.actor === "user" ? "you" : "moved"}</Badge>
                )}
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {run?.lane?.name ? `${run.lane.name} · ` : ""}
                  {run?.agent?.name ? `${run.agent.name} · ` : ""}
                  {event ? `${moved(event)} · ` : ""}
                  {new Date(at).toLocaleString()}
                  {run ? ` · ${duration(run.startedAt, run.finishedAt)}` : ""}
                  {run?.totalTokens ? ` · ${run.totalTokens} tokens` : ""}
                </span>
              </button>
              {reason ? <p className="pl-1 text-xs">{reason}</p> : null}
              {open === id && run ? (
                running ? (
                  <RunStream runId={run.id} />
                ) : (
                  <pre className="max-h-48 overflow-auto rounded-md bg-muted/30 p-2 text-xs whitespace-pre-wrap">
                    {run.error || run.output || "(no output)"}
                  </pre>
                )
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
