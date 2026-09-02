import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AgentsDocument, ProjectsDocument, TasksDocument } from "@/gql/graphql";
import { request } from "@/lib/gql";
import { useProjectId } from "@/lib/project";
import { cn } from "@/lib/utils";

/**
 * The three things that have to be true before anything on this server can run, ticked off as
 * they become true, and gone once they all are.
 *
 * The first is the one that needed saying. A fresh install seeds an agent called `default` with
 * no endpoint and no model, and nothing anywhere told you so: you made a project, typed what you
 * wanted, pressed Send, and got a connection error out of the depths of an HTTP client. The
 * board is not the thing that is broken there — nobody has said which model it is talking to.
 *
 * It reads the queries the rest of the app already has open, so it costs a render rather than a
 * round trip, and each row ticks itself off the live answer rather than remembering being done.
 */
export function SetupChecklist({ onNewProject }: { onNewProject: () => void }) {
  const projectId = useProjectId();
  const agents = useQuery({ queryKey: ["agents"], queryFn: () => request(AgentsDocument) });
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => request(ProjectsDocument) });
  const tasks = useQuery({
    queryKey: ["tasks", projectId],
    queryFn: () => request(TasksDocument, { projectId }),
    enabled: Boolean(projectId),
  });

  // An agent inherits whatever it does not name from Settings, so neither half is enough on its
  // own: what matters is that some enabled agent resolves to both an endpoint and a model.
  const fallback = agents.data?.settings[0];
  const ready = (agents.data?.agents ?? []).some(
    (agent) =>
      agent.enabled && (agent.baseUrl || fallback?.baseUrl) && (agent.model || fallback?.model),
  );

  const steps = [
    {
      done: ready,
      title: "Point it at a model",
      detail: ready
        ? "An agent has an endpoint and a model."
        : "No agent has both an endpoint and a model yet, so the first run will fail at the request.",
      action: (
        <Button asChild size="sm" variant={ready ? "ghost" : "default"}>
          <Link to="/settings">Settings</Link>
        </Button>
      ),
    },
    {
      done: Boolean(projects.data?.projects.length),
      title: "Make a project",
      detail: "It comes with a board already wired up: intake, doing, review, done.",
      action: (
        <Button size="sm" variant="ghost" onClick={onNewProject}>
          New project
        </Button>
      ),
    },
    {
      done: Boolean(tasks.data?.tasks.length),
      title: "Say what you want",
      detail: "Talk it over below, or write the card yourself. Either way it lands in intake.",
      action: null,
    },
  ];

  // Nothing to say once it is all true, and this is a page somebody uses every day.
  if (steps.every((step) => step.done)) return null;

  return (
    <Card className="gap-3 p-4">
      <div>
        <h2 className="font-medium">First run</h2>
        <p className="text-sm text-muted-foreground">
          Three things, once. Each ticks itself off as it becomes true.
        </p>
      </div>
      <ol className="flex flex-col gap-2">
        {steps.map((step) => (
          <li key={step.title} className="flex items-center gap-3">
            {step.done ? (
              <Check aria-label="done" className="size-4 shrink-0 text-status-running" />
            ) : (
              <Circle aria-label="not done yet" className="size-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm", step.done && "text-muted-foreground line-through")}>
                {step.title}
              </p>
              {step.done ? null : <p className="text-xs text-muted-foreground">{step.detail}</p>}
            </div>
            {step.done ? null : step.action}
          </li>
        ))}
      </ol>
    </Card>
  );
}
