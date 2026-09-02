import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
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
  type ProjectsQuery,
  UpdateProjectDocument,
} from "@/gql/graphql";
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
  decomposeAgentId: string;
}

const toDraft = (project?: Project | null): Draft => ({
  name: project?.name ?? "",
  description: project?.description ?? "",
  context: project?.context ?? "",
  autoRun: project?.autoRun ?? false,
  refineAgentId: project?.refineAgentId ?? "",
  decomposeAgentId: project?.decomposeAgentId ?? "",
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

  const agents = useQuery({ queryKey: ["agents"], queryFn: () => request(AgentsDocument) });
  const byStage = (stage: string) =>
    (agents.data?.agents ?? []).filter((agent) => agent.role.stage === stage);

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
        decomposeAgentId: draft.decomposeAgentId || null,
      };
      if (!values.name) throw new Error("A project needs a name.");
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

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>
            A project is a board and the standing context every agent working it is given.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={draft.name}
              onChange={(event) => set({ name: event.target.value })}
              placeholder="Billing rewrite"
            />
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
              <Label>Board</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger className="w-full">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Refining agent</Label>
              <Select
                value={draft.refineAgentId || ANY}
                onValueChange={(value) => set({ refineAgentId: value === ANY ? "" : value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any enabled refiner</SelectItem>
                  {byStage("refine").map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Decomposing agent</Label>
              <Select
                value={draft.decomposeAgentId || ANY}
                onValueChange={(value) => set({ decomposeAgentId: value === ANY ? "" : value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any enabled decomposer</SelectItem>
                  {byStage("decompose").map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
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
