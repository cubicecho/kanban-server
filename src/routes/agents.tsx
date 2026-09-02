import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/action-button";
import { AgentDialog } from "@/components/agent-dialog";
import { Page } from "@/components/app-shell";
import { ConfirmButton } from "@/components/confirm-button";
import { EmptyState } from "@/components/empty-state";
import { QueryError } from "@/components/query-error";
import { RowSkeleton } from "@/components/row-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AgentsDocument,
  type AgentsQuery,
  DeleteAgentDocument,
  UpdateAgentDocument,
} from "@/gql/graphql";
import { request } from "@/lib/gql";

type Agent = AgentsQuery["agents"][number];

/**
 * An agent that inherits what it does not have, from a Settings that has not got it either.
 *
 * Every knob on an agent falls back to Settings by sentinel, which is right — but the seeded
 * agent inherits *everything*, and a fresh install's Settings is empty, so the first run of
 * the first card failed with an upstream error and nothing on any page had said why.
 */
function SettingsNeeded({
  missing,
  settings,
}: {
  missing: string;
  settings?: { baseUrl?: string | null; model?: string | null } | null;
}) {
  const inherited =
    (missing.includes("endpoint") ? Boolean(settings?.baseUrl) : true) &&
    (missing.includes("model") ? Boolean(settings?.model) : true);
  if (inherited) return null;

  return (
    <Badge variant="outline" className="mt-2 gap-1 border-destructive/40 text-destructive">
      <TriangleAlert className="size-3" aria-hidden />
      Needs {missing} — set one here or in Settings
    </Badge>
  );
}

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
  const settings = agents.data?.settings?.[0];

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
      {agents.isError ? (
        <QueryError error={agents.error} onRetry={() => agents.refetch()} what="your agents" />
      ) : null}
      {agents.isPending ? <RowSkeleton rows={2} /> : null}
      {agents.data?.agents.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No agents yet"
          description="An agent is an endpoint and a model. Without one, no lane on any board can run."
          action={<Button onClick={() => setCreating(true)}>New agent</Button>}
        />
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
              {/* The seeded agent is a name and nothing else, and inheriting from a Settings
                  that was never filled in resolves to no endpoint at all — which showed up
                  as a raw connection error on the first run and nowhere before it. */}
              {!agent.model || !agent.baseUrl ? (
                <SettingsNeeded
                  missing={
                    !agent.model && !agent.baseUrl
                      ? "a model and an endpoint"
                      : agent.model
                        ? "an endpoint"
                        : "a model"
                  }
                  settings={settings}
                />
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Switch
                    checked={agent.enabled}
                    onCheckedChange={(enabled) => toggle.mutate({ id: agent.id, enabled })}
                    // `title` on a Radix switch is a hint the accessibility tree does not
                    // read; the name has to be said outright.
                    aria-label={`${agent.enabled ? "Disable" : "Enable"} ${agent.name}`}
                  />
                </TooltipTrigger>
                <TooltipContent>{agent.enabled ? "Disable" : "Enable"}</TooltipContent>
              </Tooltip>
              <ActionButton
                variant="ghost"
                size="icon"
                label={`Edit ${agent.name}`}
                hint="Edit"
                onClick={() => setEditing(agent)}
              >
                <Pencil className="size-4" aria-hidden />
              </ActionButton>
              <ConfirmButton
                variant="ghost"
                size="icon"
                label={`Delete ${agent.name}`}
                hint="Delete"
                title={`Delete the agent "${agent.name}"?`}
                description="Any lane staffed by it stops running until another agent is picked, on every board on this server."
                onConfirm={() => remove.mutate(agent.id)}
              >
                <Trash2 className="size-4" aria-hidden />
              </ConfirmButton>
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
