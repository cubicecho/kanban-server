import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AgentDialog } from "@/components/agent-dialog";
import { Page } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  AgentsDocument,
  type AgentsQuery,
  DeleteAgentDocument,
  UpdateAgentDocument,
} from "@/gql/graphql";
import { request } from "@/lib/gql";

type Agent = AgentsQuery["agents"][number];

/**
 * Which models are available to work with.
 *
 * An agent is an endpoint, a model, a set of tools and nothing else — it does not know what job
 * it does, and finds out at the lane. That is why there is one list here and the kinds of lane
 * live on their own page: two agents are two models, not two jobs, and one agent can staff every
 * station on a board.
 */
export function AgentsRoute() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Agent | null>(null);
  const [creating, setCreating] = useState(false);

  const agents = useQuery({ queryKey: ["agents"], queryFn: () => request(AgentsDocument) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["agents"] });
  const onError = (error: Error) => toast.error(error.message);

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      request(UpdateAgentDocument, { id, set: { enabled } }),
    onSuccess: refresh,
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => request(DeleteAgentDocument, { id }),
    onSuccess: refresh,
    onError,
  });

  const servers = agents.data?.mcpServers ?? [];

  return (
    <Page
      title="Agents"
      description="Each one is its own endpoint, model and set of tools. What it does is the lane's business."
      actions={
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          New agent
        </Button>
      }
    >
      {agents.data?.agents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No agents yet. Without one, no lane on any board can run.
        </p>
      ) : null}

      {agents.data?.agents.map((agent) => (
        <Card key={agent.id} className="gap-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{agent.name}</span>
                {agent.servers.length ? (
                  <span className="text-xs text-muted-foreground">
                    {agent.servers.length} server{agent.servers.length === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">no tools</span>
                )}
              </div>
              <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                {agent.model || "model from Settings"} · {agent.baseUrl || "endpoint from Settings"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Switch
                checked={agent.enabled}
                onCheckedChange={(enabled) => toggle.mutate({ id: agent.id, enabled })}
                title={agent.enabled ? "Disable" : "Enable"}
              />
              <Button variant="ghost" size="icon" title="Edit" onClick={() => setEditing(agent)}>
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Delete"
                onClick={() => remove.mutate(agent.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
          {agent.systemPrompt ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">{agent.systemPrompt}</p>
          ) : null}
        </Card>
      ))}

      {creating || editing ? (
        <AgentDialog
          agent={editing ?? undefined}
          servers={servers}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      ) : null}
    </Page>
  );
}
