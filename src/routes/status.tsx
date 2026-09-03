import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CircleCheck, Play, RefreshCw, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/action-button";
import { Page, useCurrentProject } from "@/components/app-shell";
import { CardDialog } from "@/components/card-dialog";
import { EmptyState, NoProject } from "@/components/empty-state";
import { useProjectActions } from "@/components/project-actions";
import { QueryError } from "@/components/query-error";
import { RowSkeleton } from "@/components/row-skeleton";
import { Spend } from "@/components/spend";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  type BoardQuery,
  CardsStatusEnum,
  ProjectIssuesDocument,
  type ProjectIssuesQuery,
  RetryCardDocument,
  RunCardDocument,
} from "@/gql/graphql";
import { BOARD_LIMIT, boardQuery } from "@/lib/board-query";
import {
  blockingDeps,
  CARD_HEALTH,
  CARD_STATUS_CLASS,
  CARD_STATUS_VARIANT,
  type CardHealth,
  cardHealth,
  isStation,
} from "@/lib/cards";
import { request } from "@/lib/gql";
import { useProjectId } from "@/lib/project";
import { cn } from "@/lib/utils";

type BoardCard = BoardQuery["cards"][number];
type Lane = BoardQuery["lanes"][number];
type Failure = ProjectIssuesQuery["failures"][number];

/**
 * What each heap of cards is called, and what it means that a card is in it.
 *
 * The words are deliberately not the status words. `error` and `rejected` are two ways of
 * being stopped and one thing to do about them, and `idle` is four situations wearing one
 * word — so a page counting statuses would put the number that matters in two piles and hide
 * it in a third.
 */
const HEALTH: Record<CardHealth, { label: string; blurb: string }> = {
  attention: {
    label: "Needs you",
    blurb: "Turned down by a reviewer, or broken. Nothing moves these on but a person.",
  },
  running: { label: "Running", blurb: "An agent has these in hand right now." },
  blocked: { label: "Blocked", blurb: "Waiting on another card that is not finished." },
  waiting: { label: "Queued", blurb: "Ready for the station they are standing in." },
  parked: {
    label: "Parked",
    blurb: "In a lane that is not a station — a backlog, or a done pile. Nothing runs from one.",
  },
  done: { label: "Done", blurb: "Nothing further will happen to these." },
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** A tally with every heap at nought, which is what a lane holding nothing has to say. */
const noneYet = (): Record<CardHealth, number> =>
  Object.fromEntries(CARD_HEALTH.map((kind) => [kind, 0])) as Record<CardHealth, number>;

const when = (at: string) => new Date(at).toLocaleString();

/** How many of one kind, and the button that makes the list below show them. */
function Tile({
  health,
  count,
  selected,
  onSelect,
}: {
  health: CardHealth;
  count: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-pressed={selected}
          onClick={onSelect}
          className={cn(
            "rounded-md border px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            selected && "border-primary bg-accent",
          )}
        >
          {/* The one number worth a colour, and only while it is not zero: a dashboard where
              every tile is red says the same thing as one where none of them is. */}
          <span
            className={cn(
              "block text-2xl font-semibold tabular-nums",
              health === "attention" && count > 0 && "text-destructive",
            )}
          >
            {count}
          </span>
          <span className="block text-xs text-muted-foreground">{HEALTH[health].label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>{HEALTH[health].blurb}</TooltipContent>
    </Tooltip>
  );
}

/** What a lane is holding, in the same words the tiles use. */
function LaneRow({ lane, tally }: { lane: Lane; tally: Record<CardHealth, number> }) {
  const total = CARD_HEALTH.reduce((sum, kind) => sum + tally[kind], 0);
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {lane.name}
          <span className="ml-2 font-normal text-muted-foreground tabular-nums">{total}</span>
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {isStation(lane) ? "station" : "resting place"}
          {lane.intake ? " · intake" : ""}
          {lane.archiveOnSuccess ? " · archives what passes" : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {total === 0 ? <span className="text-muted-foreground">empty</span> : null}
        {CARD_HEALTH.filter((kind) => tally[kind] > 0).map((kind) => (
          <span
            key={kind}
            className={cn(
              "text-muted-foreground",
              kind === "attention" && "font-medium text-destructive",
            )}
          >
            <span className="tabular-nums">{tally[kind]}</span> {HEALTH[kind].label.toLowerCase()}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A run that broke and left nothing on the board saying so. */
function FailureRow({ failure }: { failure: Failure }) {
  return (
    <Card className="gap-1 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{failure.kind}</Badge>
        <span className="truncate font-medium">
          {failure.card?.title || failure.task?.title || "(gone)"}
        </span>
        <span className="text-xs text-muted-foreground">
          {failure.agent?.name ? `${failure.agent.name} · ` : ""}
          {failure.lane?.name ? `${failure.lane.name} · ` : ""}
          {when(failure.startedAt)}
        </span>
      </div>
      <p className="line-clamp-3 text-sm text-destructive">
        {failure.error || "It broke without saying why."}
      </p>
    </Card>
  );
}

/**
 * Where a project stands, and what is waiting on somebody.
 *
 * The board answers "where is each card", which is the question you have when you already know
 * the board. This answers the one you have when you do not: is anything stuck, how much, and
 * why — a task you described this morning became a dozen cards you never asked to see, and the
 * only thing you actually need told is which of them stopped and what they said when they did.
 *
 * It reads the board's own query rather than one of its own, so the two pages are one cache
 * entry and one poll; the second query is the half the board cannot show. A card's `error` is
 * a fault and only a fault, and a rejection's reason lives in the verdict note the move points
 * at — so a reviewer's "no" is invisible on the board and is the first thing said here.
 *
 * Every row opens the card's own dialog, which is where the whole account is: what has been
 * said about it, and everything that has happened to it. Discovering the problem and reading
 * it are one click apart on purpose.
 */
export function StatusRoute() {
  const projectId = useProjectId();
  const project = useCurrentProject();
  const queryClient = useQueryClient();
  const { editProject } = useProjectActions();
  const [focus, setFocus] = useState<CardHealth>("attention");
  const [opened, setOpened] = useState<BoardCard | null>(null);

  const board = useQuery({ ...boardQuery(projectId), refetchInterval: 5000 });
  // Slower than the board: a verdict is written once, at the end of a run measured in model
  // round-trips, and nothing on this page is watching it arrive token by token.
  const issues = useQuery({
    queryKey: ["project-issues", projectId],
    queryFn: () => request(ProjectIssuesDocument, { projectId }),
    enabled: Boolean(projectId),
    refetchInterval: 15000,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["board", projectId] });
    queryClient.invalidateQueries({ queryKey: ["project-issues", projectId] });
    queryClient.invalidateQueries({ queryKey: ["spend"] });
  };
  const onError = (error: Error) => toast.error(error.message);

  const retry = useMutation({
    mutationFn: (cardId: string) => request(RetryCardDocument, { cardId }),
    onSuccess: () => {
      toast.success("Back in play");
      refresh();
    },
    onError,
  });

  const run = useMutation({
    mutationFn: (cardId: string) => request(RunCardDocument, { cardId }),
    onSuccess: (result) => {
      if (result.runCard.status !== "ok") toast.error(result.runCard.error || "The agent failed.");
      refresh();
    },
    onError,
  });

  const lanes = useMemo(() => board.data?.lanes ?? [], [board.data]);
  const all = useMemo(() => board.data?.cards ?? [], [board.data]);
  const truncated = all.length > BOARD_LIMIT;
  const cards = useMemo(() => (truncated ? all.slice(0, BOARD_LIMIT) : all), [all, truncated]);

  const laneById = useMemo(() => new Map(lanes.map((lane) => [lane.id, lane])), [lanes]);

  const health = useMemo(
    () =>
      new Map(
        cards.map((card) => [card.id, cardHealth(card, laneById.get(card.laneId), cards)] as const),
      ),
    [cards, laneById],
  );

  const counts = useMemo(() => {
    const tally = noneYet();
    for (const kind of health.values()) tally[kind] += 1;
    return tally;
  }, [health]);

  const perLane = useMemo(() => {
    const tallies = new Map(lanes.map((lane) => [lane.id, noneYet()]));
    for (const card of cards) {
      const tally = tallies.get(card.laneId);
      const kind = health.get(card.id);
      if (tally && kind) tally[kind] += 1;
    }
    return tallies;
  }, [lanes, cards, health]);

  // The newest ruling per card is the one that stopped it. The older ones are earlier trips
  // round the same loop, and the card's own history is where those are read.
  const verdicts = useMemo(() => {
    const newest = new Map<string, string>();
    for (const note of issues.data?.verdicts ?? [])
      if (!newest.has(note.cardId)) newest.set(note.cardId, note.body);
    return newest;
  }, [issues.data]);

  /** The sentence under a card: why it is where it is, in the words that apply to it. */
  const why = (card: BoardCard): string | null => {
    switch (health.get(card.id)) {
      case "attention":
        return card.status === CardsStatusEnum.Error
          ? card.error || "It broke without saying why — its history has the run that did it."
          : verdicts.get(card.id) || "A reviewer turned it down without saying why.";
      case "blocked":
        return `Waiting on ${blockingDeps([...card.deps], cards).join(", ")}.`;
      case "parked": {
        const lane = laneById.get(card.laneId);
        if (!lane) return "This card's lane is gone.";
        if (!lane.roleId && !lane.agentId)
          return `${lane.name} is a resting place — nothing is picked up from it.`;
        return lane.roleId
          ? `${lane.name} names no agent, so nothing here runs.`
          : `${lane.name} names no role, so nothing here runs.`;
      }
      case "waiting":
        return project?.autoRun
          ? null
          : "Ready, but this project is not on auto — it waits for you to run it.";
      default:
        return null;
    }
  };

  // Down the pipeline rather than by time: the same order the board draws them in, so a list
  // read here and a board read after it are the same list.
  const position = useMemo(() => new Map(lanes.map((lane, index) => [lane.id, index])), [lanes]);
  const shown = cards
    .filter((card) => health.get(card.id) === focus)
    .sort(
      (a, b) =>
        (position.get(a.laneId) ?? 0) - (position.get(b.laneId) ?? 0) || a.position - b.position,
    );

  // A card still standing in `error` says its own fault on itself above, so what is left here
  // is the failure with nothing on the board to show for it: a refinement that never became a
  // card, and a card somebody has since moved on by hand.
  const unexplained = (issues.data?.failures ?? []).filter((failure) => {
    if (!failure.cardId) return true;
    return health.get(failure.cardId) !== "attention";
  });

  const total = cards.length;
  const clear = counts.attention === 0 && unexplained.length === 0;

  if (!projectId) {
    return (
      <Page title="Status">
        <NoProject what="A status" />
      </Page>
    );
  }

  return (
    <Page
      title="Status"
      crumb={project?.name}
      description="Where the work stands, and what is waiting on you."
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <Spend projectId={projectId} />
          <Button variant="outline" onClick={refresh}>
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        </div>
      }
    >
      {board.isError ? (
        <QueryError error={board.error} onRetry={() => board.refetch()} what="this project" />
      ) : null}
      {board.isPending ? <RowSkeleton rows={2} /> : null}

      {truncated ? (
        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          This project has more than {BOARD_LIMIT} cards on the board, so these counts cover the
          first {BOARD_LIMIT} in position order. Archive what is finished.
        </p>
      ) : null}

      {/* Nothing on this page will ever change on its own while auto is off, and a queue that
          is never picked up looks exactly like a queue that is about to be. */}
      {project && !project.autoRun && counts.waiting > 0 ? (
        <p className="flex flex-wrap items-center gap-x-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          <span>
            This project is not on auto, so {plural(counts.waiting, "card is", "cards are")} ready
            and waiting on you rather than on an agent.
          </span>
          <button
            type="button"
            className="rounded font-medium text-foreground underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            onClick={() => editProject(project)}
          >
            Turn it on
          </button>
        </p>
      ) : null}

      {total > 0 ? (
        <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
          {CARD_HEALTH.map((kind) => (
            <Tile
              key={kind}
              health={kind}
              count={counts[kind]}
              selected={focus === kind}
              onSelect={() => setFocus(kind)}
            />
          ))}
        </div>
      ) : null}

      <section className="flex flex-col gap-3">
        {/* The heading names which heap is being shown, and there are no heaps on an empty
            board — "Needs you: turned down by a reviewer" over "nothing here yet" is a
            question nobody asked answered above the one they did. */}
        {total > 0 ? (
          <div>
            <h2 className="font-medium">{HEALTH[focus].label}</h2>
            <p className="text-sm text-muted-foreground">{HEALTH[focus].blurb}</p>
          </div>
        ) : null}

        {shown.length === 0 && !board.isPending && !board.isError ? (
          <EmptyState
            icon={CircleCheck}
            title={
              total === 0
                ? "Nothing on this board yet"
                : `Nothing is ${HEALTH[focus].label.toLowerCase()}`
            }
            description={
              total === 0
                ? "Describe what you want on the New task page. It lands as a card at the front of the board, and what becomes of it shows up here."
                : "Pick another heap above to see what is in it."
            }
            action={
              total === 0 ? (
                <Button asChild>
                  <Link to="/">New task</Link>
                </Button>
              ) : null
            }
          />
        ) : null}

        {shown.map((card) => {
          const lane = laneById.get(card.laneId);
          const reason = why(card);
          const kind = health.get(card.id);
          return (
            <Card key={card.id} className="gap-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={CARD_STATUS_VARIANT[card.status] ?? "secondary"}
                      className={CARD_STATUS_CLASS[card.status]}
                    >
                      {card.status}
                    </Badge>
                    <span className="truncate font-medium">{card.title || "Untitled"}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {lane?.name ?? "(lane gone)"}
                    {card.attempts
                      ? ` · ${plural(card.attempts, "failed attempt", "failed attempts")}`
                      : ""}{" "}
                    · {when(card.updatedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {kind === "attention" ? (
                    <ActionButton
                      variant="ghost"
                      size="icon"
                      label={`Put ${card.title} back in play`}
                      hint="Clear it and start it over where it stands"
                      disabled={retry.isPending}
                      onClick={() => retry.mutate(card.id)}
                    >
                      <RotateCcw className="size-4" aria-hidden />
                    </ActionButton>
                  ) : null}
                  {kind === "waiting" ? (
                    <ActionButton
                      variant="ghost"
                      size="icon"
                      label={`Run ${card.title}`}
                      hint="Run it now, without waiting for the worker"
                      disabled={run.isPending}
                      onClick={() => run.mutate(card.id)}
                    >
                      <Play className="size-4" aria-hidden />
                    </ActionButton>
                  ) : null}
                  <Button variant="outline" size="sm" onClick={() => setOpened(card)}>
                    Open
                  </Button>
                </div>
              </div>
              {reason ? (
                <p className="line-clamp-4 text-sm whitespace-pre-wrap text-muted-foreground">
                  {reason}
                </p>
              ) : null}
            </Card>
          );
        })}
      </section>

      {lanes.length ? (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-medium">Lanes</h2>
            <p className="text-sm text-muted-foreground">
              Where the work is standing. A pile in one lane and nothing after it is a station that
              has stopped.
            </p>
          </div>
          <Card className="gap-0 overflow-hidden p-0">
            {lanes.map((lane) => (
              <LaneRow key={lane.id} lane={lane} tally={perLane.get(lane.id) ?? noneYet()} />
            ))}
          </Card>
        </section>
      ) : null}

      {unexplained.length ? (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-medium">Failures with nothing to show for them</h2>
            <p className="text-sm text-muted-foreground">
              Runs that broke and left no card standing in the way — a refinement that never reached
              the board, or a card somebody has since moved on.
            </p>
          </div>
          {unexplained.slice(0, 5).map((failure) => (
            <FailureRow key={failure.id} failure={failure} />
          ))}
          <Button asChild variant="outline" className="self-start">
            <Link to="/runs">Every run</Link>
          </Button>
        </section>
      ) : null}

      {clear && total > 0 && !board.isPending ? (
        <p className="text-sm text-muted-foreground">
          Nothing is waiting on you. {plural(counts.running, "card is", "cards are")} running and{" "}
          {plural(counts.done, "is", "are")} done.
        </p>
      ) : null}

      {opened ? (
        <CardDialog
          card={opened}
          cards={cards}
          lanes={lanes}
          projectId={projectId}
          laneId={opened.laneId}
          // Every row here is a card somebody is opening because of what was said about it, so
          // it opens where that is: the reason on the row is a line, and this is the rest of it.
          tab="notes"
          onClose={() => setOpened(null)}
        />
      ) : null}
    </Page>
  );
}
