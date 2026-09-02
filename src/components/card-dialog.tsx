import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  type BoardQuery,
  CardRunsDocument,
  CreateCardDocument,
  SetCardDepsDocument,
  UpdateCardDocument,
} from "@/gql/graphql";
import { request } from "@/lib/gql";
import { duration, RUN_STATUS_VARIANT } from "@/lib/runs";

type Card = BoardQuery["cards"][number];

/**
 * Every time an agent was asked to work this card, newest first.
 *
 * The board says where a card is and the last thing said about it. This says how it got there:
 * the attempt that failed, the verdict that sent it back, the run a restart interrupted. It is
 * the same rows the Runs page draws, asked for the other way round — about one card rather than
 * about a whole project, which is the question somebody has open the card to ask.
 */
function History({ cardId }: { cardId: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const runs = useQuery({
    queryKey: ["card-runs", cardId],
    queryFn: () => request(CardRunsDocument, { cardId }),
  });

  const rows = runs.data?.runs ?? [];
  if (!rows.length) return null;

  return (
    <div className="flex flex-col gap-2">
      <Label>History</Label>
      <div className="flex max-h-72 flex-col gap-2 overflow-y-auto rounded-md border p-3">
        {rows.map((run) => (
          <div key={run.id} className="flex flex-col gap-1">
            <button
              type="button"
              className="flex w-full items-center gap-2 text-left"
              onClick={() => setOpen(open === run.id ? null : run.id)}
            >
              <Badge variant={RUN_STATUS_VARIANT[run.status] ?? "secondary"}>{run.status}</Badge>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {run.agent?.name ? `${run.agent.name} · ` : ""}
                {new Date(run.startedAt).toLocaleString()} ·{" "}
                {duration(run.startedAt, run.finishedAt)}
                {run.totalTokens ? ` · ${run.totalTokens} tokens` : ""}
              </span>
            </button>
            {open === run.id ? (
              <pre className="max-h-48 overflow-auto rounded-md bg-muted/30 p-2 text-xs whitespace-pre-wrap">
                {run.error || run.output || "(no output)"}
              </pre>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A card, written or edited by hand.
 *
 * Most cards are written by the decomposer, so this is the exception rather than the rule —
 * but a board you cannot add a card to is a report, not a board.
 */
export function CardDialog({
  card,
  cards,
  projectId,
  laneId,
  onClose,
}: {
  card?: Card;
  /** Every card on this board, which is what a dependency may point at. */
  cards: Card[];
  projectId: string;
  /** Which lane a new card lands in. Ignored when editing. */
  laneId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(card?.title ?? "");
  const [body, setBody] = useState(card?.body ?? "");
  const [acceptance, setAcceptance] = useState(card?.acceptance ?? "");
  const [dependsOn, setDependsOn] = useState<string[]>(
    card?.deps.map((dep) => dep.dependsOnCardId) ?? [],
  );

  const others = cards.filter((row) => row.id !== card?.id);
  const toggle = (id: string) =>
    setDependsOn((current) =>
      current.includes(id) ? current.filter((held) => held !== id) : [...current, id],
    );

  const save = useMutation({
    mutationFn: async () => {
      const values = { title: title.trim(), body, acceptance };
      if (!values.title) throw new Error("A card needs a title.");
      let id = card?.id;
      if (id) await request(UpdateCardDocument, { id, set: values });
      else {
        const created = await request(CreateCardDocument, {
          values: { ...values, projectId, laneId },
        });
        id = created.createCard.id;
      }
      // Second, and only when it moved: the write is a whole set and the server refuses a
      // cycle, so a card that gained no dependencies has nothing to say here.
      const before = (card?.deps ?? []).map((dep) => dep.dependsOnCardId);
      const changed =
        before.length !== dependsOn.length || before.some((held) => !dependsOn.includes(held));
      if (changed) await request(SetCardDepsDocument, { cardId: id, dependsOn });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", projectId] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{card ? "Edit card" : "New card"}</DialogTitle>
          <DialogDescription>
            What one agent is asked to do, and how anyone can tell it is done.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="card-title">Title</Label>
            <Input
              id="card-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="card-body">Body</Label>
            <Textarea
              id="card-body"
              rows={6}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="What to do, in enough detail that the agent does not have to guess."
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="card-acceptance">Acceptance</Label>
            <Textarea
              id="card-acceptance"
              rows={3}
              value={acceptance}
              onChange={(event) => setAcceptance(event.target.value)}
              placeholder="What a reviewer checks against. Kept apart from the body so it does not get skipped."
            />
          </div>
          {others.length ? (
            <div className="flex flex-col gap-2">
              <Label>Waits for</Label>
              <p className="text-xs text-muted-foreground">
                This card is skipped until every one of these is done. The decomposer sets them;
                this is where a wrong order is corrected.
              </p>
              <div className="flex max-h-48 flex-col gap-2 overflow-y-auto rounded-md border p-3">
                {others.map((other) => (
                  <div key={other.id} className="flex items-center justify-between gap-3">
                    <Label htmlFor={`dep-${other.id}`} className="min-w-0 truncate font-normal">
                      {other.title}
                    </Label>
                    <Switch
                      id={`dep-${other.id}`}
                      checked={dependsOn.includes(other.id)}
                      onCheckedChange={() => toggle(other.id)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {card?.result ? (
            <div className="flex flex-col gap-2">
              <Label>Last result</Label>
              <pre className="max-h-60 overflow-auto rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                {card.result}
              </pre>
            </div>
          ) : null}

          {/* A card that does not exist yet has no history, and asking for one would be a query
              for the id of a row nobody has written. */}
          {card ? <History cardId={card.id} /> : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
