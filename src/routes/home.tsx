import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Send, Settings2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Page } from "@/components/app-shell";
import { ProjectDialog } from "@/components/project-dialog";
import { RunStream } from "@/components/run-stream";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AcceptTaskDocument,
  ActiveRunsDocument,
  CreateTaskDocument,
  DecomposeTaskDocument,
  ProjectsDocument,
  type ProjectsQuery,
  RefineTaskDocument,
  SubmitTaskDocument,
  TasksDocument,
  type TasksQuery,
} from "@/gql/graphql";
import { request } from "@/lib/gql";
import { useProjectId } from "@/lib/project";

type Task = TasksQuery["tasks"][number];
type Project = ProjectsQuery["projects"][number];

/**
 * The way in: describe something, and it becomes cards on a board.
 *
 * Two ways, really, and they are the same pipeline entered at different points. Talking it over
 * with the refining agent is for when you know what you want but not yet what it means; the
 * straight form is for when you do, and every turn of conversation would only be you telling an
 * agent what you already wrote down. Both end at the decomposer.
 */
export function HomeRoute() {
  const projectId = useProjectId();
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => request(ProjectsDocument) });
  const project = projects.data?.projects.find((row) => row.id === projectId);

  const [editing, setEditing] = useState<Project | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <Page
      title="New task"
      description="Say what you want. The decomposer turns it into cards."
      actions={
        <div className="flex gap-2">
          {project ? (
            <Button variant="outline" onClick={() => setEditing(project)}>
              <Settings2 className="size-4" />
              Project
            </Button>
          ) : null}
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            New project
          </Button>
        </div>
      }
    >
      {project ? (
        <TaskComposer project={project} />
      ) : (
        <p className="text-sm text-muted-foreground">
          {projects.isLoading
            ? "Loading…"
            : "No project yet. Make one — it comes with a board already wired up."}
        </p>
      )}

      {creating || editing ? (
        <ProjectDialog
          project={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      ) : null}
    </Page>
  );
}

function TaskComposer({ project }: { project: Project }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [draftId, setDraftId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");

  const tasks = useQuery({
    queryKey: ["tasks", project.id],
    queryFn: () => request(TasksDocument, { projectId: project.id }),
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["tasks", project.id] });
    queryClient.invalidateQueries({ queryKey: ["board", project.id] });
  };

  // The draft in hand: the one this page started, or — on a reload — the latest one still open.
  const draft: Task | undefined = draftId
    ? tasks.data?.tasks.find((task) => task.id === draftId)
    : tasks.data?.tasks.find((task) => task.status === "draft");

  const say = useMutation({
    mutationFn: async (text: string) => {
      let id = draft?.id;
      if (!id) {
        const created = await request(CreateTaskDocument, {
          values: { projectId: project.id, title: "", brief: text },
        });
        id = created.createTask.id;
        setDraftId(id);
      }
      return request(RefineTaskDocument, { taskId: id, message: text });
    },
    onSuccess: (run) => {
      setMessage("");
      if (run.refineTask.status !== "ok") toast.error(run.refineTask.error || "The agent failed.");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const decompose = useMutation({
    mutationFn: async (taskId: string) => {
      await request(AcceptTaskDocument, { taskId });
      return request(DecomposeTaskDocument, { taskId });
    },
    onSuccess: (run) => {
      if (run.decomposeTask.status === "ok") {
        toast.success("On the board");
        setDraftId(null);
        navigate({ to: "/board" });
      } else {
        toast.error(run.decomposeTask.error || "The decomposer failed.");
      }
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submit = useMutation({
    mutationFn: () => request(SubmitTaskDocument, { projectId: project.id, title, brief }),
    onSuccess: (result) => {
      if (result.submitTask.status === "decomposed") {
        toast.success("On the board");
        setTitle("");
        setBrief("");
        navigate({ to: "/board" });
      } else {
        toast.error(result.submitTask.error || "The decomposer failed.");
      }
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const working = say.isPending || decompose.isPending || submit.isPending;
  const talking = say.isPending || decompose.isPending;

  // A refining model that takes twenty seconds to answer should not spend them saying nothing.
  // The mutation only resolves at the end of the turn, so the run is found by the task it is
  // about — the one id this page has while the turn is still going.
  const watched = draftId ?? draft?.id;
  const active = useQuery({
    queryKey: ["active-runs", project.id],
    queryFn: () => request(ActiveRunsDocument, { projectId: project.id }),
    enabled: talking && Boolean(watched),
    refetchInterval: 1000,
  });
  const liveRunId = active.data?.runs.find((run) => run.taskId === watched)?.id;

  return (
    <Tabs defaultValue="refine">
      <TabsList>
        <TabsTrigger value="refine">Talk it over</TabsTrigger>
        <TabsTrigger value="straight">Straight to the board</TabsTrigger>
      </TabsList>

      <TabsContent value="refine" className="flex flex-col gap-4">
        <Card className="flex max-h-[26rem] flex-col gap-3 overflow-y-auto p-4">
          {draft?.messages.length ? (
            draft.messages.map((entry) => (
              <div
                key={entry.id}
                className={
                  entry.role === "user"
                    ? "self-end rounded-lg bg-accent px-3 py-2 text-sm whitespace-pre-wrap"
                    : "text-sm whitespace-pre-wrap"
                }
              >
                {entry.content}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Describe what you want. The refining agent will ask about the parts you left out, and
              keep a brief of what you have settled on.
            </p>
          )}
          {/* Until the run is found — and if the stream cannot be opened at all — this is the
              old blocking path: the answer still arrives when the mutation resolves. */}
          {talking ? (
            liveRunId ? (
              <RunStream runId={liveRunId} />
            ) : (
              <p className="text-sm text-muted-foreground">Thinking…</p>
            )
          ) : null}
        </Card>

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (message.trim()) say.mutate(message.trim());
          }}
        >
          <Input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="What needs doing?"
            disabled={working}
          />
          <Button type="submit" disabled={working || !message.trim()}>
            <Send className="size-4" />
            Send
          </Button>
        </form>

        {draft ? (
          <Card className="gap-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate font-medium">{draft.title || "Untitled task"}</h2>
                <Badge variant="outline" className="mt-1">
                  {draft.status}
                </Badge>
              </div>
              <Button
                disabled={working || !draft.brief.trim()}
                onClick={() => decompose.mutate(draft.id)}
              >
                <Sparkles className="size-4" />
                {decompose.isPending ? "Decomposing…" : "Accept and decompose"}
              </Button>
            </div>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">
              {draft.brief || "No brief yet — the agent writes it as you talk."}
            </p>
          </Card>
        ) : null}
      </TabsContent>

      <TabsContent value="straight" className="flex flex-col gap-4">
        <Card className="gap-4 p-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Migrate the billing tables"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="brief">Brief</Label>
            <Textarea
              id="brief"
              rows={8}
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              placeholder="Everything the decomposer should know. It gets this and the project's context, and nothing else."
            />
          </div>
          <Button
            className="self-start"
            disabled={working || !title.trim() || !brief.trim()}
            onClick={() => submit.mutate()}
          >
            <Sparkles className="size-4" />
            {submit.isPending ? "Decomposing…" : "Decompose"}
          </Button>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
