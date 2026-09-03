import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useDiscardGuard } from "@/components/discard-guard";
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
import { BoardTemplatesDocument, SaveBoardTemplateDocument } from "@/gql/graphql";
import { useDirty } from "@/lib/dirty";
import { request } from "@/lib/gql";
import { toastError } from "@/lib/toast";

/**
 * Keeps the board you are looking at under a name.
 *
 * The names already taken are listed rather than guarded against, because saving over one is
 * how a template gets corrected — there is no second copy under the same name, and pretending
 * otherwise would only mean a "five lanes (2)" nobody meant to make.
 */
export function SaveTemplateDialog({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const { close, guard } = useDiscardGuard(useDirty({ name, description }), onClose);

  const templates = useQuery({
    queryKey: ["board-templates"],
    queryFn: () => request(BoardTemplatesDocument),
  });
  const taken = (templates.data?.boardTemplates ?? []).some(
    (template) => template.name === name.trim(),
  );

  const save = useMutation({
    mutationFn: () =>
      request(SaveBoardTemplateDocument, {
        projectId,
        name: name.trim(),
        description: description.trim(),
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["board-templates"] });
      toast.success(`Saved as “${result.saveBoardTemplate.name}”.`);
      onClose();
    },
    onError: toastError,
  });

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save this board</DialogTitle>
          <DialogDescription>
            The lanes, their agents, their WIP limits and the arrows between them — kept under a
            name, for the next project to start with. The cards stay here.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="template-name">Name</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Review-heavy"
            />
            {taken && (
              <p className="text-xs text-muted-foreground">
                A template is already called that. Saving replaces it.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="template-description">Description</Label>
            <Input
              id="template-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="One line, for whoever picks it later."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={!name.trim() || save.isPending}>
            {save.isPending ? "Saving…" : taken ? "Replace" : "Save"}
          </Button>
        </DialogFooter>

        {guard}
      </DialogContent>
    </Dialog>
  );
}
