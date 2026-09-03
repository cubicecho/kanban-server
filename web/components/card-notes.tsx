import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import {
  AddCardNoteDocument,
  CardNotesDocument,
  CardNotesKindEnum,
  type CardNotesQuery,
  DeleteCardNoteDocument,
  UpdateCardNoteDocument,
} from "@/__generated__/graphql";
import { ActionButton } from "@/components/action-button";
import { ConfirmButton } from "@/components/confirm-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { request } from "@/lib/gql";
import { toastError } from "@/lib/toast";

type Note = CardNotesQuery["cardNotes"][number];

/** What each kind is called where somebody reads it, rather than where it is stored. */
const KIND: Record<CardNotesKindEnum, string> = {
  [CardNotesKindEnum.Report]: "report",
  [CardNotesKindEnum.Verdict]: "verdict",
  [CardNotesKindEnum.Note]: "note",
};

/**
 * Everything ever said about a card, and the box for saying something else.
 *
 * The three used to be three: an agent's account of the work overwrote a column on the card,
 * a reviewer's ruling went on the move it caused, and there was nowhere at all for a person to
 * write down what they knew. They are one list because they are one thing — what is known
 * about this card that is not the card — and because the useful half of that is what the next
 * agent to work it gets told, which a column holding only the most recent one could not do.
 *
 * Only a note is editable. A report and a verdict are an account of what happened, and an
 * account anybody may go back and correct is worth no more than none — the same argument the
 * ledger is generated read-only on. So they are drawn, and they are drawn without buttons.
 */
export function CardNotes({ cardId }: { cardId: string }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [edited, setEdited] = useState("");

  const notes = useQuery({
    queryKey: ["card-notes", cardId],
    queryFn: () => request(CardNotesDocument, { cardId }),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["card-notes", cardId] });

  const add = useMutation({
    mutationFn: (body: string) => request(AddCardNoteDocument, { cardId, body }),
    onSuccess: () => {
      setDraft("");
      refresh();
    },
    onError: toastError,
  });

  const update = useMutation({
    mutationFn: (note: { id: string; body: string }) => request(UpdateCardNoteDocument, note),
    onSuccess: () => {
      setEditing(null);
      refresh();
    },
    onError: toastError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => request(DeleteCardNoteDocument, { id }),
    onSuccess: refresh,
    onError: toastError,
  });

  const rows = notes.data?.cardNotes ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="card-note">Add a note</Label>
        <Textarea
          id="card-note"
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Something the next agent to work this card should take into account."
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Every note here is handed to the next agent that works this card. Reports and verdicts
            are what has already been said about it.
          </p>
          <Button
            size="sm"
            className="shrink-0"
            disabled={!draft.trim() || add.isPending}
            onClick={() => add.mutate(draft.trim())}
          >
            {add.isPending ? "Adding…" : "Add note"}
          </Button>
        </div>
      </div>

      {rows.length ? (
        <div className="flex flex-col gap-3 border-t pt-3">
          {rows.map((note: Note) => {
            const mine = note.kind === CardNotesKindEnum.Note;
            return (
              <div key={note.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Badge variant={mine ? "secondary" : "outline"}>{KIND[note.kind]}</Badge>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {note.author === "agent" ? "an agent" : "you"} ·{" "}
                    {new Date(note.createdAt).toLocaleString()}
                    {note.updatedAt !== note.createdAt ? " · edited" : ""}
                  </span>
                  {mine && editing !== note.id ? (
                    <>
                      <ActionButton
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        label="Edit this note"
                        onClick={() => {
                          setEditing(note.id);
                          setEdited(note.body);
                        }}
                      >
                        <Pencil className="size-3.5" aria-hidden />
                      </ActionButton>
                      <ConfirmButton
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        label="Delete this note"
                        hint="Delete"
                        title="Delete this note?"
                        description="The next agent to work this card stops being told it. Nothing else changes."
                        onConfirm={() => remove.mutate(note.id)}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </ConfirmButton>
                    </>
                  ) : null}
                </div>
                {editing === note.id ? (
                  <div className="flex flex-col gap-2">
                    <Textarea
                      rows={3}
                      value={edited}
                      onChange={(event) => setEdited(event.target.value)}
                      aria-label="Note"
                    />
                    <div className="flex justify-end gap-1">
                      <ActionButton
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        label="Stop editing"
                        onClick={() => setEditing(null)}
                      >
                        <X className="size-3.5" aria-hidden />
                      </ActionButton>
                      <ActionButton
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        label="Save this note"
                        disabled={!edited.trim() || update.isPending}
                        onClick={() => update.mutate({ id: note.id, body: edited.trim() })}
                      >
                        <Check className="size-3.5" aria-hidden />
                      </ActionButton>
                    </div>
                  </div>
                ) : (
                  <pre className="max-h-60 overflow-auto rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                    {note.body}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="border-t pt-3 text-sm text-muted-foreground">
          {notes.isPending
            ? "Reading what has been said about this card…"
            : "Nothing has been said about this card yet."}
        </p>
      )}
    </div>
  );
}
