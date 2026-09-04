import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BoardTemplatesDocument, SaveBoardTemplateDocument } from "@/__generated__/graphql";
import { useAppForm } from "@/components/app-form";
import { FormDialog } from "@/components/form-dialog";
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
  const templates = useQuery({
    queryKey: ["board-templates"],
    queryFn: () => request(BoardTemplatesDocument),
  });
  const taken = (name: string) =>
    (templates.data?.boardTemplates ?? []).some((template) => template.name === name.trim());

  const save = useMutation({
    mutationFn: (values: { name: string; description: string }) =>
      request(SaveBoardTemplateDocument, {
        projectId,
        name: values.name.trim(),
        description: values.description.trim(),
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["board-templates"] });
      toast.success(`Saved as “${result.saveBoardTemplate.name}”.`);
      onClose();
    },
  });

  const form = useAppForm({
    defaultValues: { name: "", description: "" },
    // The rejection is caught here rather than in an `onError`, because the submit has to await
    // the request to say "Saving…" and an awaited failure has to land somewhere.
    onSubmit: ({ value }) => save.mutateAsync(value).catch(toastError),
  });

  return (
    <FormDialog
      form={form}
      title="Save this board"
      description="The lanes, their agents, their WIP limits and the arrows between them — kept under a name, for the next project to start with. The cards stay here."
      onClose={onClose}
      saveLabel={
        <form.Subscribe selector={(state) => taken(state.values.name)}>
          {(replacing) => (replacing ? "Replace" : "Save")}
        </form.Subscribe>
      }
    >
      <form.AppField
        name="name"
        validators={{
          onChange: ({ value }) => (value.trim() ? undefined : "A template needs a name."),
        }}
      >
        {(field) => (
          <field.InputField
            label="Name"
            required
            placeholder="Review-heavy"
            description={
              taken(field.state.value)
                ? "A template is already called that. Saving replaces it."
                : undefined
            }
          />
        )}
      </form.AppField>

      <form.AppField name="description">
        {(field) => (
          <field.InputField
            label="Description"
            placeholder="One line, for whoever picks it later."
          />
        )}
      </form.AppField>
    </FormDialog>
  );
}
