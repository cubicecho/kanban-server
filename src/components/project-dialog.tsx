import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useDiscardGuard } from "@/components/discard-guard";
import { useFieldError } from "@/components/field-error";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AgentsDocument,
  ApplyBoardTemplateDocument,
  BoardTemplatesDocument,
  CreateProjectDocument,
  DeleteProjectDocument,
  type ProjectsQuery,
  UpdateProjectDocument,
} from "@/gql/graphql";
import { useDirty } from "@/lib/dirty";
import { request } from "@/lib/gql";
import { selectProject } from "@/lib/project";

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

  const { close, guard } = useDiscardGuard(useDirty({ ...draft, templateId }), onClose);
  const nameError = useFieldError(
    "project-name",
    draft.name.trim() ? "" : "A project needs a name.",
  );

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
    onError: (error: Error) => toast.error(error.message),
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
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>
            A project is a board and the standing context every agent working it is given.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={draft.name}
              onChange={(event) => set({ name: event.target.value })}
              placeholder="Billing rewrite"
              {...nameError.field}
            />
            {nameError.error}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={draft.description}
              onChange={(event) => set({ description: event.target.value })}
              placeholder="One line, for the picker."
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="context">Context</Label>
            <Textarea
              id="context"
              rows={6}
              value={draft.context}
              onChange={(event) => set({ context: event.target.value })}
              placeholder="The stack, the conventions, where things live — whatever every agent working this project needs to know before its own prompt."
            />
          </div>

          {project ? null : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-board">Board</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger id="project-board" className="w-full">
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
              <p className="text-xs text-muted-foreground">
                {templateId === SEEDED
                  ? "The default four, wired to whichever agents this server has."
                  : ((templates.data?.boardTemplates ?? []).find((one) => one.id === templateId)
                      ?.description ?? "A board saved from another project.")}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 rounded-md border p-3">
            <div>
              <Label htmlFor="autoRun">Run cards automatically</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Off, cards sit where they are put and run when you ask. On, a card that lands in a
                lane with an agent is picked up, worked and moved along on its own.
              </p>
            </div>
            <Switch
              id="autoRun"
              checked={draft.autoRun}
              onCheckedChange={(autoRun) => set({ autoRun })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-refiner">Refining agent</Label>
              <Select
                value={draft.refineAgentId || ANY}
                onValueChange={(value) => set({ refineAgentId: value === ANY ? "" : value })}
              >
                <SelectTrigger id="project-refiner" className="w-full">
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
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          {project ? (
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
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={nameError.invalid || save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>

        {project ? (
          <AlertDialog open={deleting} onOpenChange={setDeleting}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete “{project.name}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  Its lanes go, and its cards with them — along with the conversations they came
                  from, their dependencies, their history of moves and every run of the lot. This is
                  the whole project, not a board you can draw again.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirm-project">
                  Type <span className="font-medium text-foreground">{project.name}</span> to
                  confirm
                </Label>
                <Input
                  id="confirm-project"
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  autoComplete="off"
                />
              </div>
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
        {guard}
      </DialogContent>
    </Dialog>
  );
}
