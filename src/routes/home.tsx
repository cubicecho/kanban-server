import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { FolderOpen, Send, Square, SquarePlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Page } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { useProjectActions } from "@/components/project-actions";
import { RunStream } from "@/components/run-stream";
import { SetupChecklist } from "@/components/setup-checklist";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  ActiveRunsDocument,
  CreateTaskDocument,
  MakeCardDocument,
  ProjectsDocument,
  type ProjectsQuery,
  RecentTasksDocument,
  RefineTaskDocument,
  StopTaskDocument,
  SubmitCardDocument,
  TaskDocument,
  type TaskQuery,
} from "@/gql/graphql";
import { request } from "@/lib/gql";
import { useProjectId } from "@/lib/project";

type Task = TaskQuery["tasks"][number];
type Project = ProjectsQuery["projects"][number];

/**
 * The way in: describe something, and it becomes a card at the project's front door.
 *
 * Two ways, and they are the same door entered from different sides. Talking it over with the
 * refining agent is for when you know what you want but not yet what it means; the straight form
 * is for when you do, and every turn of conversation would only be you telling an agent what you
 * already wrote down. Both end at one card in intake, and what becomes of it is the board's
 * business — a lane that expands is what turns it into the cards that carry the work out.
 */
export function HomeRoute() {
  const projectId = useProjectId();
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => request(ProjectsDocument) });
  const project = projects.data?.projects.find((row) => row.id === projectId);

  const { newProject } = useProjectActions();

  return (
    <Page
      title="New task"
      crumb={project?.name}
      description="Say what you want. It lands as a card at the front of the board."
    >
      <SetupChecklist />

      {project ? (
        <TaskComposer project={project} />
      ) : projects.isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <EmptyState
          icon={FolderOpen}
          title="No project yet"
          description="A task belongs to a project. Make one — it comes with a board already wired up: intake, doing, review, done."
          action={<Button onClick={newProject}>New project</Button>}
        />
      )}
    </Page>
  );
}

function TaskComposer({ project }: { project: Project }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // `?task=` is a conversation somebody asked to carry on — the way back into one, which the
  // Tasks page had no way to offer. Without it this page could only ever guess, and its guess
  // was the newest task with no cards: every older conversation was unreachable for good.
  const linked = useSearch({ from: "/" }).task;
  const [draftId, setDraftId] = useState<string | null>(linked ?? null);
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");

  // Which conversation, and then that conversation — two queries rather than one, because the
  // question "is anything still being talked about?" is about card counts and this page was
  // answering it by fetching every task in the project with every message in it.
  const recent = useQuery({
    queryKey: ["tasks", project.id, "recent"],
    queryFn: () => request(RecentTasksDocument, { projectId: project.id, limit: 25 }),
  });
  // On a reload, the most recent conversation that never reached the board. A task has no status
  // to ask; whether it produced work is the card pointing back at it.
  // An empty string is somebody asking for a blank one, and it has to be distinguishable from
  // `null`: the fallback below would otherwise hand back the very conversation being left.
  const openId =
    draftId === ""
      ? null
      : (draftId ?? recent.data?.tasks.find((task) => task.cards.length === 0)?.id ?? null);

  const conversation = useQuery({
    queryKey: ["task", openId],
    queryFn: () => request(TaskDocument, { id: openId ?? "" }),
    enabled: Boolean(openId),
  });
  const draft: Task | undefined = conversation.data?.tasks[0];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["tasks", project.id] });
    queryClient.invalidateQueries({ queryKey: ["task", openId] });
    queryClient.invalidateQueries({ queryKey: ["board", project.id] });
  };

  // A refining turn can take a minute, and until now the only thing this page did about that
  // was disable the box. `stopTask` has existed the whole time and only the Runs page called it,
  // which is a page away from where the wait is actually being felt.
  const stop = useMutation({
    mutationFn: (taskId: string) => request(StopTaskDocument, { taskId }),
    onSuccess: (data) => {
      // False means the turn had already finished on its own, and the answer is on its way.
      if (data.stopTask) toast.success("Stopping…");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Arriving here from a Continue link while this page is already mounted changes the search
  // rather than mounting it again, and so does the back button.
  useEffect(() => {
    if (linked) setDraftId(linked);
  }, [linked]);

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

  // Ending the conversation is a write, not a run: one card in intake, and nothing to wait for.
  // The chat is left where it is — a brief can be talked about further and made again.
  const make = useMutation({
    mutationFn: (taskId: string) => request(MakeCardDocument, { taskId }),
    onSuccess: () => {
      toast.success("On the board");
      setDraftId(null);
      refresh();
      navigate({ to: "/board" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submit = useMutation({
    mutationFn: () => request(SubmitCardDocument, { projectId: project.id, title, body: brief }),
    onSuccess: () => {
      toast.success("On the board");
      setTitle("");
      setBrief("");
      refresh();
      navigate({ to: "/board" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const working = say.isPending || make.isPending || submit.isPending;
  const talking = say.isPending;

  // A refining model that takes twenty seconds to answer should not spend them saying nothing.
  // The mutation only resolves at the end of the turn, so the run is found by the task it is
  // about — the one id this page has while the turn is still going.
  const watched = openId;
  const active = useQuery({
    queryKey: ["active-runs", project.id],
    queryFn: () => request(ActiveRunsDocument, { projectId: project.id }),
    enabled: talking && Boolean(watched),
    refetchInterval: 1000,
  });
  const liveRunId = active.data?.runs.find((run) => run.taskId === watched)?.id;

  // The transcript is a scroller that never scrolled: a fourth answer arrived below the fold and
  // the page sat looking at the first one. Following the newest turn is the whole of it — unlike
  // the run stream there is no token-by-token growth to fight a reader for.
  const transcript = useRef<HTMLDivElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new turn is what scrolls it.
  useEffect(() => {
    const element = transcript.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [draft?.messages.length, talking]);

  return (
    <Tabs defaultValue="refine">
      <TabsList>
        <TabsTrigger value="refine">Talk it over</TabsTrigger>
        <TabsTrigger value="straight">Straight to the board</TabsTrigger>
      </TabsList>

      <TabsContent value="refine" className="flex flex-col gap-4">
        <Card ref={transcript} className="flex max-h-[26rem] flex-col gap-3 overflow-y-auto p-4">
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
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (message.trim() && !working) say.mutate(message.trim());
          }}
        >
          {/* A textarea, because what you say here is a paragraph about what you want and the
              other tab gives the same thing eight rows. Enter still sends — this is a chat —
              and shift-enter is the newline. */}
          <Textarea
            rows={3}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.shiftKey) return;
              event.preventDefault();
              if (message.trim() && !working) say.mutate(message.trim());
            }}
            placeholder="What needs doing? Shift-enter for a new line."
            disabled={working}
            className="min-h-0 resize-y"
          />
          {/* One button, and which one it is says what the page is doing — the same swap a
              running card makes on the board. Stopping needs the task's id, which only exists
              once there is a conversation to stop. */}
          {talking && watched ? (
            <Button
              type="button"
              variant="outline"
              disabled={stop.isPending}
              onClick={() => stop.mutate(watched)}
            >
              <Square className="size-4" />
              Stop
            </Button>
          ) : (
            <Button type="submit" disabled={working || !message.trim()}>
              <Send className="size-4" />
              Send
            </Button>
          )}
        </form>

        {draft ? (
          <Card className="gap-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate font-medium">{draft.title || "Untitled task"}</h2>
                <Badge variant="outline" className="mt-1">
                  {draft.cards.length
                    ? `${draft.cards.length} card${draft.cards.length === 1 ? "" : "s"}`
                    : "being talked about"}
                </Badge>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {/* Leaving a conversation open is what carrying one on means, so there has to be
                    a way out of it that is not making a card of it. */}
                <Button
                  variant="ghost"
                  disabled={working}
                  onClick={() => {
                    setDraftId("");
                    navigate({ to: "/", search: {} });
                  }}
                >
                  Start a new one
                </Button>
                <Button
                  disabled={working || !draft.brief.trim()}
                  onClick={() => make.mutate(draft.id)}
                >
                  <SquarePlus className="size-4" />
                  {make.isPending ? "Making…" : "Make a card"}
                </Button>
              </div>
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
              placeholder="Everything the first agent should know. It gets this and the project's context, and nothing else."
            />
          </div>
          <Button
            className="self-start"
            disabled={working || !title.trim() || !brief.trim()}
            onClick={() => submit.mutate()}
          >
            <SquarePlus className="size-4" />
            {submit.isPending ? "Adding…" : "Put it on the board"}
          </Button>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
