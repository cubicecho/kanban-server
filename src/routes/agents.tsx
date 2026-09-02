import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AgentDialog } from "@/components/agent-dialog";
import { Page } from "@/components/app-shell";
import { RoleDialog } from "@/components/role-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  AgentsDocument,
  type AgentsQuery,
  DeleteAgentDocument,
  DeleteRoleDocument,
  UpdateAgentDocument,
} from "@/gql/graphql";
import { request } from "@/lib/gql";

type Agent = AgentsQuery["agents"][number];
type Role = AgentsQuery["roles"][number];

/**
 * Who does the work.
 *
 * Two lists, because the two questions are different. A **role** is a job of work — the prompt,
 * and nothing about a model — and there are as many as somebody has written: a tester, a
 * security reviewer, a technical writer. An **agent** is a role given an endpoint to run on, so
 * nothing stops two executors on two models with a lane pointed at each.
 *
 * The split is why editing what an executor is told is one edit here rather than one per agent
 * doing the job, and why a new kind of station is a role somebody writes rather than a release.
 */
export function AgentsRoute() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Agent | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [creatingRole, setCreatingRole] = useState(false);

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

  // The foreign key is `restrict`, so a role something points at refuses to go and says so.
  const removeRole = useMutation({
    mutationFn: (id: string) => request(DeleteRoleDocument, { id }),
    onSuccess: refresh,
    onError: () => toast.error("That role could not be deleted — an agent is still filling it."),
  });

  const servers = agents.data?.mcpServers ?? [];
  const roles = agents.data?.roles ?? [];

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
                <Badge variant="secondary">{agent.role.name}</Badge>
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
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {agent.systemPrompt || agent.role.systemPrompt}
          </p>
        </Card>
      ))}

      <div className="mt-8 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-medium text-lg">Roles</h2>
          <p className="text-muted-foreground text-sm">
            The jobs an agent can be asked to fill. A role is a prompt and a stage; write one for
            any station a board of yours wants.
          </p>
        </div>
        <Button variant="outline" onClick={() => setCreatingRole(true)}>
          <Plus className="size-4" />
          New role
        </Button>
      </div>

      {roles.map((role) => (
        <Card key={role.id} className="gap-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{role.name}</span>
                <Badge variant="outline">
                  {role.stage === "card" ? "works cards" : role.stage}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {agents.data?.agents.filter((agent) => agent.roleId === role.id).length ?? 0}{" "}
                  agent(s)
                </span>
              </div>
              {role.description ? (
                <p className="mt-1 text-sm text-muted-foreground">{role.description}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="icon" title="Edit" onClick={() => setEditingRole(role)}>
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Delete"
                onClick={() => removeRole.mutate(role.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
          <p className="line-clamp-2 font-mono text-muted-foreground text-xs">
            {role.systemPrompt || "no prompt — an agent in this role is told nothing"}
          </p>
        </Card>
      ))}

      {creating || editing ? (
        <AgentDialog
          agent={editing ?? undefined}
          roles={roles}
          servers={servers}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      ) : null}

      {creatingRole || editingRole ? (
        <RoleDialog
          role={editingRole ?? undefined}
          onClose={() => {
            setCreatingRole(false);
            setEditingRole(null);
          }}
        />
      ) : null}
    </Page>
  );
}
