import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  AgentsDocument,
  ApplyBoardTemplateDocument,
  BoardTemplatesDocument,
  CreateProjectDocument,
  DeleteProjectDocument,
  type ProjectsQuery,
  UpdateProjectDocument,
} from "@/__generated__/graphql";
import {
  InputField,
  SelectField,
  SwitchField,
  TextareaField,
  useAppForm,
} from "@/components/app-form";
import { FormDialog } from "@/components/form-dialog";
import { FormField } from "@/components/form-field";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { request } from "@/lib/gql";
import { forPicker, idOrNone } from "@/lib/picker";
import { selectProject } from "@/lib/project";
import { toastError } from "@/lib/toast";

type Project = ProjectsQuery["projects"][number];

// Radix refuses an empty item value, so "whichever one is enabled" carries a sentinel.
const ANY = "__any__";
// And the same for "the four lanes every project already gets".
const SEEDED = "__seeded__";

/**
 * A project, made or edited.
 *
 * A new one arrives with four lanes already wired to this server's execute and review agents —
 * that happens on the server, so a project made over MCP is the same board as one made here.
 * A template is drawn over those four afterwards rather than instead of them: the project
 * exists either way, and a template that will not apply costs its board and not the project.
 */
export function ProjectDialog({
  project,
  onClose,
}: {
  project?: Project | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const [typed, setTyped] = useState("");

  const agents = useQuery({ queryKey: ["agents"], queryFn: () => request(AgentsDocument) });
  // Every enabled agent, for both pickers: an agent is a model, and refining is a prompt this
  // server holds rather than a job any particular agent has been minted for.
  const enabled = (agents.data?.agents ?? []).filter((agent) => agent.enabled);

  // Only offered on a new project: applying one to a board that has cards is refused, and by
  // the time a project is being edited it usually has.
  const templates = useQuery({
    queryKey: ["board-templates"],
    queryFn: () => request(BoardTemplatesDocument),
    enabled: !project,
  });

  const save = useMutation({
    mutationFn: async (draft: {
      name: string;
      description: string;
      context: string;
      autoRun: boolean;
      refineAgentId: string;
      templateId: string;
    }) => {
      const values = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        context: draft.context,
        autoRun: draft.autoRun,
        refineAgentId: idOrNone(draft.refineAgentId, ANY),
      };
      if (project) return request(UpdateProjectDocument, { id: project.id, set: values });
      const created = await request(CreateProjectDocument, { values });
      // Made from here, it is the one you meant to work in.
      selectProject(created.createProject.id);
      if (draft.templateId !== SEEDED) {
        await request(ApplyBoardTemplateDocument, {
          projectId: created.createProject.id,
          templateId: draft.templateId,
        });
      }
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      onClose();
    },
  });

  const form = useAppForm({
    defaultValues: {
      name: project?.name ?? "",
      description: project?.description ?? "",
      context: project?.context ?? "",
      autoRun: project?.autoRun ?? false,
      refineAgentId: forPicker(project?.refineAgentId, ANY),
      templateId: SEEDED,
    },
    onSubmit: ({ value }) => save.mutateAsync(value).catch(toastError),
  });

  // The one delete in this app that takes a whole body of work with it, and until now the only
  // one with no way to do it at all: `deleteProject` existed and nothing called it, so a board
  // made by mistake stayed in the picker for good. Typing the name rather than pressing a
  // second button, because everything else that is deleted here can be rebuilt in a minute and
  // this cannot — the cascade takes the lanes, the cards, the conversations that became them
  // and every run of the lot.
  const remove = useMutation({
    mutationFn: (id: string) => request(DeleteProjectDocument, { id }),
    onSuccess: () => {
      // The picker's own effect falls back to the first project that is left; this is what
      // stops it holding an id that no longer names anything when there are none.
      selectProject("");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project deleted");
      onClose();
    },
    onError: toastError,
  });

  return (
    <FormDialog
      form={form}
      title={project ? "Edit project" : "New project"}
      description="A project is a board and the standing context every agent working it is given."
      width="xl"
      onClose={onClose}
      aside={
        project ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              setTyped("");
              setDeleting(true);
            }}
          >
            Delete project
          </Button>
        ) : null
      }
    >
      <InputField
        form={form}
        name="name"
        label="Name"
        required
        placeholder="Billing rewrite"
        validators={{
          onChange: ({ value }) => (value.trim() ? undefined : "A project needs a name."),
        }}
      />

      <InputField
        form={form}
        name="description"
        label="Description"
        placeholder="One line, for the picker."
      />

      <TextareaField
        form={form}
        name="context"
        label="Context"
        rows={6}
        placeholder="The stack, the conventions, where things live — whatever every agent working this project needs to know before its own prompt."
      />

      {project ? null : (
        <form.AppField name="templateId">
          {(field) => (
            <field.SelectField
              label="Board"
              options={[
                { value: SEEDED, label: "Backlog, Doing, Review, Done" },
                ...(templates.data?.boardTemplates ?? []).map((template) => ({
                  value: template.id,
                  label: template.name,
                })),
              ]}
              description={
                field.state.value === SEEDED
                  ? "The default four, wired to whichever agents this server has."
                  : ((templates.data?.boardTemplates ?? []).find(
                      (one) => one.id === field.state.value,
                    )?.description ?? "A board saved from another project.")
              }
            />
          )}
        </form.AppField>
      )}

      <SwitchField
        form={form}
        name="autoRun"
        label="Run cards automatically"
        description="Off, cards sit where they are put and run when you ask. On, a card that lands in a lane with an agent is picked up, worked and moved along on its own."
        className="rounded-md border p-3"
      />

      <SelectField
        form={form}
        name="refineAgentId"
        label="Refining agent"
        options={[
          { value: ANY, label: "Whatever Settings says" },
          ...enabled.map((agent) => ({ value: agent.id, label: agent.name })),
        ]}
      />

      {project ? (
        <AlertDialog open={deleting} onOpenChange={setDeleting}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{project.name}”?</AlertDialogTitle>
              <AlertDialogDescription>
                Its lanes go, and its cards with them — along with the conversations they came from,
                their dependencies, their history of moves and every run of the lot. This is the
                whole project, not a board you can draw again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <FormField
              label={
                <>
                  Type <span className="font-medium text-foreground">{project.name}</span> to
                  confirm
                </>
              }
              control={
                <Input
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  autoComplete="off"
                />
              }
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button
                type="button"
                variant="destructive"
                disabled={typed.trim() !== project.name || remove.isPending}
                onClick={() => remove.mutate(project.id)}
              >
                {remove.isPending ? "Deleting…" : "Delete project"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </FormDialog>
  );
}
