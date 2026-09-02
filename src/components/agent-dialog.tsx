import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ModelSelect } from "@/components/model-select";
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
  type AgentsQuery,
  type AgentsToolDiscoveryEnum,
  CreateAgentDocument,
  SetAgentApiKeyDocument,
  SetAgentServersDocument,
  UpdateAgentDocument,
} from "@/gql/graphql";
import { request } from "@/lib/gql";

type Agent = AgentsQuery["agents"][number];
type Role = AgentsQuery["roles"][number];
type McpServer = AgentsQuery["mcpServers"][number];

interface Draft {
  name: string;
  roleId: string;
  enabled: boolean;
  baseUrl: string;
  model: string;
  systemPrompt: string;
  maxTokens: number;
  temperature: number;
  maxToolIterations: number;
  toolDiscovery: AgentsToolDiscoveryEnum;
  requestTimeoutSeconds: number;
  maxRetries: number;
}

const toDraft = (agent?: Agent): Draft => ({
  name: agent?.name ?? "",
  roleId: agent?.roleId ?? "",
  enabled: agent?.enabled ?? true,
  baseUrl: agent?.baseUrl ?? "",
  model: agent?.model ?? "",
  systemPrompt: agent?.systemPrompt ?? "",
  maxTokens: agent?.maxTokens ?? 0,
  temperature: agent?.temperature ?? -1,
  maxToolIterations: agent?.maxToolIterations ?? 0,
  toolDiscovery: agent?.toolDiscovery ?? ("inherit" as AgentsToolDiscoveryEnum),
  requestTimeoutSeconds: agent?.requestTimeoutSeconds ?? 0,
  maxRetries: agent?.maxRetries ?? -1,
});

/**
 * An agent: an endpoint, a prompt, and the tools it may reach.
 *
 * Every number here treats zero as "whatever Settings says" — and temperature and retries use
 * -1, zero being a value someone may genuinely want. The placeholders say so rather than the
 * fields pretending to hold the inherited value, which would be a lie the moment Settings
 * changed.
 */
export function AgentDialog({
  agent,
  roles,
  servers,
  onClose,
}: {
  agent?: Agent;
  roles: readonly Role[];
  servers: readonly McpServer[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => toDraft(agent));
  const [apiKey, setApiKey] = useState("");
  const [linked, setLinked] = useState<string[]>(
    () => agent?.servers.map((link) => link.serverId) ?? [],
  );
  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const role = roles.find((row) => row.id === draft.roleId);

  const save = useMutation({
    mutationFn: async () => {
      const values = { ...draft, name: draft.name.trim() };
      if (!values.name) throw new Error("An agent needs a name.");
      if (!values.roleId) throw new Error("An agent needs a role — that is what it is told.");
      for (const key of [
        "maxTokens",
        "temperature",
        "maxToolIterations",
        "requestTimeoutSeconds",
        "maxRetries",
      ] as const) {
        if (!Number.isFinite(values[key])) throw new Error(`${key} must be a number.`);
      }

      let id = agent?.id;
      if (id) await request(UpdateAgentDocument, { id, set: values });
      else id = (await request(CreateAgentDocument, { values })).createAgent.id;
      // Written after the row exists, and separately: the servers are a set, and the key is
      // write-only so it never comes back down with the rest of the agent.
      await request(SetAgentServersDocument, { agentId: id, serverIds: linked });
      if (apiKey) await request(SetAgentApiKeyDocument, { agentId: id, apiKey });
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleServer = (id: string) =>
    setLinked((current) =>
      current.includes(id) ? current.filter((row) => row !== id) : [...current, id],
    );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{agent ? "Edit agent" : "New agent"}</DialogTitle>
          <DialogDescription>
            A model endpoint, a prompt, and a set of tools. Anything left blank falls back to
            Settings.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="agent-name">Name</Label>
              <Input
                id="agent-name"
                value={draft.name}
                onChange={(event) => set({ name: event.target.value })}
                placeholder="executor"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Role</Label>
              <Select value={draft.roleId} onValueChange={(roleId) => set({ roleId })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.name}
                      {row.description ? ` — ${row.description}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {role?.stage === "card"
                  ? "Works cards. A lane can point at this agent."
                  : role?.stage === "refine"
                    ? "Talks tasks into shape. Named on a project, not on a lane."
                    : role?.stage === "decompose"
                      ? "Turns tasks into cards. Named on a project, not on a lane."
                      : "The job this agent is for, and the prompt it takes."}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-md border p-3">
            <div>
              <Label htmlFor="agent-enabled">Enabled</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                A disabled agent is refused rather than skipped: a lane pointed at it stops.
              </p>
            </div>
            <Switch
              id="agent-enabled"
              checked={draft.enabled}
              onCheckedChange={(enabled) => set({ enabled })}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="agent-base">Base URL</Label>
            <Input
              id="agent-base"
              value={draft.baseUrl}
              onChange={(event) => set({ baseUrl: event.target.value })}
              placeholder="empty — use the endpoint in Settings"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="agent-key">API key</Label>
            <Input
              id="agent-key"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="unchanged — leave blank to keep the stored key"
            />
            <p className="text-xs text-muted-foreground">
              An agent with a base URL of its own never borrows the shared key: a local model has no
              use for it, and the paid endpoint should not be reached by accident.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="agent-model">Model</Label>
            <ModelSelect
              id="agent-model"
              agentId={agent?.id}
              value={draft.model}
              onChange={(model) => set({ model })}
              defaultLabel="Whatever Settings says"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="agent-prompt">System prompt</Label>
              {role?.systemPrompt && !draft.systemPrompt ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto py-1 text-xs"
                  onClick={() => set({ systemPrompt: role.systemPrompt })}
                >
                  Start from {role.name}
                </Button>
              ) : null}
            </div>
            <Textarea
              id="agent-prompt"
              rows={6}
              value={draft.systemPrompt}
              onChange={(event) => set({ systemPrompt: event.target.value })}
              placeholder={
                role?.systemPrompt
                  ? `empty — use the ${role.name} role's prompt:\n\n${role.systemPrompt}`
                  : "How this agent should work. Empty takes its role's prompt."
              }
            />
            <p className="text-xs text-muted-foreground">
              Leave this empty and the agent is told whatever its role says, so editing the role
              changes every agent doing that job. Write here to override it for this one.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label>MCP servers</Label>
            <p className="text-xs text-muted-foreground">
              What this agent can actually do. With none it can only think and write — which is
              right for a refiner, and useless for an executor.
            </p>
            <div className="flex flex-col gap-2 rounded-md border p-3">
              {servers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No servers configured yet.</p>
              ) : null}
              {servers.map((server) => (
                <div key={server.id} className="flex items-center justify-between gap-3 text-sm">
                  <Label
                    htmlFor={`server-${server.id}`}
                    className={server.enabled ? "" : "text-muted-foreground line-through"}
                  >
                    {server.label || server.slug}
                  </Label>
                  <Switch
                    id={`server-${server.id}`}
                    checked={linked.includes(server.id)}
                    onCheckedChange={() => toggleServer(server.id)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="agent-tokens">Max tokens</Label>
              <Input
                id="agent-tokens"
                type="number"
                value={draft.maxTokens}
                onChange={(event) => set({ maxTokens: Number(event.target.value) })}
              />
              <p className="text-xs text-muted-foreground">0 inherits.</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="agent-temp">Temperature</Label>
              <Input
                id="agent-temp"
                type="number"
                step="0.1"
                value={draft.temperature}
                onChange={(event) => set({ temperature: Number(event.target.value) })}
              />
              <p className="text-xs text-muted-foreground">-1 inherits.</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="agent-iter">Max tool steps</Label>
              <Input
                id="agent-iter"
                type="number"
                value={draft.maxToolIterations}
                onChange={(event) => set({ maxToolIterations: Number(event.target.value) })}
              />
              <p className="text-xs text-muted-foreground">0 inherits.</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="agent-timeout">Silence before giving up (s)</Label>
              <Input
                id="agent-timeout"
                type="number"
                value={draft.requestTimeoutSeconds}
                onChange={(event) => set({ requestTimeoutSeconds: Number(event.target.value) })}
              />
              <p className="text-xs text-muted-foreground">0 inherits.</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="agent-retries">Retries</Label>
              <Input
                id="agent-retries"
                type="number"
                value={draft.maxRetries}
                onChange={(event) => set({ maxRetries: Number(event.target.value) })}
              />
              <p className="text-xs text-muted-foreground">-1 inherits.</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Tool discovery</Label>
              <Select
                value={draft.toolDiscovery}
                onValueChange={(value) => set({ toolDiscovery: value as AgentsToolDiscoveryEnum })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inherit">Whatever Settings says</SelectItem>
                  <SelectItem value="eager">Eager</SelectItem>
                  <SelectItem value="ondemand">On demand</SelectItem>
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
