import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AgentDialog } from "@/components/agent-dialog";
import { Page } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
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
 * Who does the work.
 *
 * Four roles, and a server usually wants one agent of each — but nothing stops two executors on
 * two endpoints, one lane pointed at each. The point of a row per agent rather than one set of
 * settings is that refining a sentence and working a card want different models.
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
      description="Each one is its own endpoint, model, prompt and set of tools."
      actions={
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          New agent
        </Button>
      }
    >
      {agents.data?.agents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No agents yet. Without a decomposer, a task cannot become cards.
        </p>
      ) : null}

      {agents.data?.agents.map((agent) => (
        <Card key={agent.id} className="gap-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{agent.name}</span>
                <Badge variant="secondary">{agent.role}</Badge>
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
