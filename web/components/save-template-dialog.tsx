import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BoardTemplatesDocument, SaveBoardTemplateDocument } from "@/__generated__/graphql";
import { FormDialog } from "@/components/form-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  const dirty = useDirty({ name, description });
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
    <FormDialog
      title="Save this board"
      description="The lanes, their agents, their WIP limits and the arrows between them — kept under a name, for the next project to start with. The cards stay here."
      dirty={dirty}
      onClose={onClose}
      onSave={() => save.mutate()}
      saving={save.isPending}
      canSave={Boolean(name.trim())}
      saveLabel={taken ? "Replace" : "Save"}
    >
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
    </FormDialog>
  );
}
