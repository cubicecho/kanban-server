import { CardsStatusEnum, RunsStatusEnum, RunsVerdictEnum } from "@/__generated__/graphql";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Everything on this board that wears a status wears it the same way.
 *
 * A card, a run and a verdict are three different words for how a thing is going, and each of
 * them was drawn by whichever page happened to be drawing it: a `running` card was green on the
 * board and grey outline on Runs, a card's status in the Tasks list was grey whatever it said,
 * and the two verdict colours were written out by hand in the one file that used them. A colour
 * that means one thing on one page and another on the next is worse than no colour at all.
 *
 * So there is one vocabulary of *tones* here, and each domain maps its own words onto it. The
 * tones are five and the colours are two, on purpose: `running` is the green the run stream
 * already pulses in, `attention` is amber and not red because a reviewer saying no is the board
 * working rather than the board broken, and everything else is grey. A board where everything
 * is coloured says nothing.
 */
export type StatusTone = "running" | "attention" | "fault" | "settled" | "plain";

/**
 * The hues are `--status-*` tokens rather than `emerald-*`/`amber-*` utilities, because a green
 * that reads on a near-black card is not the green that reads on a white one.
 */
const SURFACE = {
  running: "border-status-running/30 bg-status-running/15 text-status-running-foreground",
  attention: "border-status-rejected/30 bg-status-rejected/15 text-status-rejected-foreground",
};

/**
 * The two coloured tones, for the thing that wears one without being a badge.
 *
 * A badge is a `h-5 overflow-hidden` span, which is right for a word and wrong for a control —
 * the auto-run switch is a pill with a switch in it and would have its focus ring clipped. It
 * still has to be the same green and the same amber as everything else saying the same thing,
 * so it asks for a tone here rather than writing the classes out again.
 */
export const toneSurface = (tone: "running" | "attention") => SURFACE[tone];

const TONE: Record<
  StatusTone,
  { variant: "destructive" | "outline" | "secondary"; className?: string }
> = {
  running: { variant: "outline", className: SURFACE.running },
  attention: { variant: "outline", className: SURFACE.attention },
  fault: { variant: "destructive" },
  settled: { variant: "secondary" },
  plain: { variant: "outline" },
};

/** A badge in one of the five tones. Everything below is this with the mapping done for it. */
export function StatusBadge({
  tone,
  className,
  children,
}: {
  tone: StatusTone;
  className?: string;
  children: React.ReactNode;
}) {
  // A tone the map has not got is a status this client is older than: grey, rather than a
  // destructure of `undefined` taking the page down.
  const { variant, className: toneClass } = TONE[tone] ?? TONE.settled;
  return (
    <Badge variant={variant} className={cn(toneClass, className)}>
      {children}
    </Badge>
  );
}

/** A card is stopped in two ways and they want different things: `error` is a fault, `rejected` a decision. */
const CARD_TONE: Record<CardsStatusEnum, StatusTone> = {
  [CardsStatusEnum.Error]: "fault",
  [CardsStatusEnum.Rejected]: "attention",
  [CardsStatusEnum.Running]: "running",
  [CardsStatusEnum.Done]: "settled",
  [CardsStatusEnum.Idle]: "settled",
};

/** How a card's status is drawn, wherever one is drawn — the board, the archive, Status, Tasks. */
export function CardStatusBadge({
  status,
  className,
}: {
  status: CardsStatusEnum;
  className?: string;
}) {
  return (
    <StatusBadge tone={CARD_TONE[status]} className={className}>
      {status}
    </StatusBadge>
  );
}

/** `stopped` is grey rather than red: somebody called it off, which is not a failure. */
const RUN_TONE: Record<RunsStatusEnum, StatusTone> = {
  [RunsStatusEnum.Error]: "fault",
  [RunsStatusEnum.Running]: "running",
  [RunsStatusEnum.Stopped]: "plain",
  [RunsStatusEnum.Ok]: "settled",
};

/** How a run's status is drawn, on the Runs page and in a card's own history alike. */
export function RunStatusBadge({ status }: { status: RunsStatusEnum }) {
  return <StatusBadge tone={RUN_TONE[status]}>{status}</StatusBadge>;
}

/**
 * A verdict is the one thing worth a colour of its own beside a run: it is why the card moved.
 *
 * A FAIL is amber like a `rejected` card, because it is the same event seen from the run's side,
 * and a PASS is the green a working board is drawn in. `none` is not a ruling and draws nothing.
 */
export function VerdictBadge({ verdict }: { verdict: RunsVerdictEnum }) {
  if (verdict === RunsVerdictEnum.None) return null;
  const failed = verdict === RunsVerdictEnum.Fail;
  return (
    <StatusBadge tone={failed ? "attention" : "running"}>{failed ? "FAIL" : "PASS"}</StatusBadge>
  );
}
