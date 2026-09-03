import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import {
  AgentsDocument,
  type AgentsQuery,
  DeleteAgentDocument,
  UpdateAgentDocument,
} from "@/__generated__/graphql";
import { ActionButton } from "@/components/action-button";
import { AgentDialog } from "@/components/agent-dialog";
import { Page } from "@/components/app-shell";
import { ConfirmButton } from "@/components/confirm-button";
import { EmptyState } from "@/components/empty-state";
import { EnableSwitch } from "@/components/enable-switch";
import { QueryState } from "@/components/query-state";
import { RowCard } from "@/components/row-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { request } from "@/lib/gql";
import { nameList, plural } from "@/lib/text";
import { toastError } from "@/lib/toast";

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

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      request(UpdateAgentDocument, { id, set: { enabled } }),
    onSuccess: refresh,
    onError: toastError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => request(DeleteAgentDocument, { id }),
    onSuccess: refresh,
    onError: toastError,
  });

  const servers = agents.data?.mcpServers ?? [];
  const lanes = agents.data?.lanes ?? [];
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
      <QueryState
        query={agents}
        what="your agents"
        rows={2}
        count={(agents.data?.agents ?? []).length}
        empty={
          <EmptyState
            icon={Bot}
            title="No agents yet"
            description="An agent is an endpoint and a model. Without one, no lane on any board can run."
            action={<Button onClick={() => setCreating(true)}>New agent</Button>}
          />
        }
      />

      {agents.data?.agents.map((agent) => {
        const staffed = lanes.filter((lane) => lane.agentId === agent.id);
        const count = staffed.length;
        // Unlike a role, this delete is never refused — the foreign key is `set null`, so the
        // lanes simply stop having an agent. That is the case worth naming before it happens
        // rather than after: an unstaffed station looks exactly like a resting place.
        const where = nameList(staffed.map((lane) => `${lane.name} on ${lane.project.name}`));
        return (
          <RowCard
            key={agent.id}
            dim={!agent.enabled}
            title={agent.name}
            badges={
              <>
                <span className="text-xs text-muted-foreground">{plural(count, "lane")}</span>
                <span className="text-xs text-muted-foreground">
                  {agent.servers.length ? plural(agent.servers.length, "server") : "no tools"}
                </span>
              </>
            }
            meta={
              <>
                <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                  {agent.model || "model from Settings"} ·{" "}
                  {agent.baseUrl || "endpoint from Settings"}
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
              </>
            }
            actions={
              <>
                <EnableSwitch
                  enabled={agent.enabled}
                  onChange={(enabled) => toggle.mutate({ id: agent.id, enabled })}
                  name={agent.name}
                />
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
                  hint={count ? `Staffs ${where}` : "Delete"}
                  title={`Delete the agent "${agent.name}"?`}
                  description={
                    count
                      ? `${plural(count, "lane")} — ${where} — stop running until another agent is picked.`
                      : "No lane is staffed by it, so nothing on any board stops."
                  }
                  onConfirm={() => remove.mutate(agent.id)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </ConfirmButton>
              </>
            }
          >
            {agent.systemPrompt ? (
              <p className="line-clamp-2 text-sm text-muted-foreground">{agent.systemPrompt}</p>
            ) : null}
          </RowCard>
        );
      })}

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
