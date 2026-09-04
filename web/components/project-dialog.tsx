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
import { useFieldError } from "@/components/field-error";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useDirty } from "@/lib/dirty";
import { request } from "@/lib/gql";
import { selectProject } from "@/lib/project";
import { toastError } from "@/lib/toast";

type Project = ProjectsQuery["projects"][number];

// Radix refuses an empty item value, so "whichever one is enabled" carries a sentinel.
const ANY = "__any__";
// And the same for "the four lanes every project already gets".
const SEEDED = "__seeded__";

interface Draft {
  name: string;
  description: string;
  context: string;
  autoRun: boolean;
  refineAgentId: string;
}

const toDraft = (project?: Project | null): Draft => ({
  name: project?.name ?? "",
  description: project?.description ?? "",
  context: project?.context ?? "",
  autoRun: project?.autoRun ?? false,
  refineAgentId: project?.refineAgentId ?? "",
});

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
  const [draft, setDraft] = useState<Draft>(() => toDraft(project));
  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  const [templateId, setTemplateId] = useState(SEEDED);
  const [deleting, setDeleting] = useState(false);
  const [typed, setTyped] = useState("");

  const dirty = useDirty({ ...draft, templateId });
  const nameError = useFieldError(draft.name.trim() ? "" : "A project needs a name.");

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
    mutationFn: async () => {
      const values = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        context: draft.context,
        autoRun: draft.autoRun,
        refineAgentId: draft.refineAgentId || null,
      };
      if (project) return request(UpdateProjectDocument, { id: project.id, set: values });
      const created = await request(CreateProjectDocument, { values });
      // Made from here, it is the one you meant to work in.
      selectProject(created.createProject.id);
      if (templateId !== SEEDED) {
        await request(ApplyBoardTemplateDocument, {
          projectId: created.createProject.id,
          templateId,
        });
      }
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      onClose();
    },
    onError: toastError,
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
      title={project ? "Edit project" : "New project"}
      description="A project is a board and the standing context every agent working it is given."
      width="xl"
      dirty={dirty}
      onClose={onClose}
      onSave={() => save.mutate()}
      saving={save.isPending}
      canSave={!nameError.invalid}
      aside={
        project ? (
          <Button
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
      <div className="flex flex-col gap-4">
        <FormField
          label="Name"
          required
          error={nameError.error}
          control={
            <Input
              value={draft.name}
              onChange={(event) => set({ name: event.target.value })}
              placeholder="Billing rewrite"
              {...nameError.field}
            />
          }
        />

        <FormField
          label="Description"
          control={
            <Input
              value={draft.description}
              onChange={(event) => set({ description: event.target.value })}
              placeholder="One line, for the picker."
            />
          }
        />

        <FormField
          label="Context"
          control={
            <Textarea
              rows={6}
              value={draft.context}
              onChange={(event) => set({ context: event.target.value })}
              placeholder="The stack, the conventions, where things live — whatever every agent working this project needs to know before its own prompt."
            />
          }
        />

        {project ? null : (
          <FormField
            label="Board"
            description={
              templateId === SEEDED
                ? "The default four, wired to whichever agents this server has."
                : ((templates.data?.boardTemplates ?? []).find((one) => one.id === templateId)
                    ?.description ?? "A board saved from another project.")
            }
            control={(props) => (
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger {...props} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEEDED}>Backlog, Doing, Review, Done</SelectItem>
                  {(templates.data?.boardTemplates ?? []).map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}

        <FormField
          orientation="horizontal"
          label="Run cards automatically"
          description="Off, cards sit where they are put and run when you ask. On, a card that lands in a lane with an agent is picked up, worked and moved along on its own."
          className="rounded-md border p-3"
          control={
            <Switch checked={draft.autoRun} onCheckedChange={(autoRun) => set({ autoRun })} />
          }
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Refining agent"
            control={(props) => (
              <Select
                value={draft.refineAgentId || ANY}
                onValueChange={(value) => set({ refineAgentId: value === ANY ? "" : value })}
              >
                <SelectTrigger {...props} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Whatever Settings says</SelectItem>
                  {enabled.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

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
