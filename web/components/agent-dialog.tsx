import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  type AgentsQuery,
  type AgentsToolDiscoveryEnum,
  CreateAgentDocument,
  SetAgentApiKeyDocument,
  SetAgentServersDocument,
  UpdateAgentDocument,
} from "@/__generated__/graphql";
import { useFieldError } from "@/components/field-error";
import { FormDialog } from "@/components/form-dialog";
import { FormField } from "@/components/form-field";
import { ModelSelect } from "@/components/model-select";
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
import { useDirty } from "@/lib/dirty";
import { request } from "@/lib/gql";
import { toastError } from "@/lib/toast";

type Agent = AgentsQuery["agents"][number];
type McpServer = AgentsQuery["mcpServers"][number];

interface Draft {
  name: string;
  enabled: boolean;
  baseUrl: string;
  model: string;
  systemPrompt: string;
  maxTokens: number;
  contextLength: number;
  temperature: number;
  maxToolIterations: number;
  toolDiscovery: AgentsToolDiscoveryEnum;
  requestTimeoutSeconds: number;
  maxRetries: number;
}

const toDraft = (agent?: Agent): Draft => ({
  name: agent?.name ?? "",
  enabled: agent?.enabled ?? true,
  baseUrl: agent?.baseUrl ?? "",
  model: agent?.model ?? "",
  systemPrompt: agent?.systemPrompt ?? "",
  maxTokens: agent?.maxTokens ?? 0,
  contextLength: agent?.contextLength ?? 0,
  temperature: agent?.temperature ?? -1,
  maxToolIterations: agent?.maxToolIterations ?? 0,
  toolDiscovery: agent?.toolDiscovery ?? ("inherit" as AgentsToolDiscoveryEnum),
  requestTimeoutSeconds: agent?.requestTimeoutSeconds ?? 0,
  maxRetries: agent?.maxRetries ?? -1,
});

/** The numeric fields, by the label above each one rather than by its column name. */
const NUMBERS = [
  ["maxTokens", "Max tokens"],
  ["contextLength", "Context window"],
  ["temperature", "Temperature"],
  ["maxToolIterations", "Max tool steps"],
  ["requestTimeoutSeconds", "Silence before giving up"],
  ["maxRetries", "Retries"],
] as const;

/**
 * An agent: an endpoint, the tools it may reach, and an optional word about itself.
 *
 * It does not know what job it does. A lane says that, and the same agent can work one lane and
 * judge another — which is why there is no role on this form.
 *
 * Every number here treats zero as "whatever Settings says" — and temperature and retries use
 * -1, zero being a value someone may genuinely want. The placeholders say so rather than the
 * fields pretending to hold the inherited value, which would be a lie the moment Settings
 * changed.
 */
export function AgentDialog({
  agent,
  servers,
  onClose,
}: {
  agent?: Agent;
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

  // The key is deliberately not part of this: it is write-only and never comes back down, so
  // there is nothing to compare it against — typing one is a change by definition.
  const dirty = useDirty({ ...draft, apiKey, linked: [...linked].sort() });
  const nameError = useFieldError(draft.name.trim() ? "" : "An agent needs a name.");
  // These used to be checked inside the mutation and reported by their column name — a toast
  // reading "maxToolIterations must be a number." names something that is nowhere on the form.
  const badNumber = NUMBERS.find(([key]) => !Number.isFinite(draft[key]));

  const save = useMutation({
    mutationFn: async () => {
      const values = { ...draft, name: draft.name.trim() };
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
    onError: toastError,
  });

  const toggleServer = (id: string) =>
    setLinked((current) =>
      current.includes(id) ? current.filter((row) => row !== id) : [...current, id],
    );

  return (
    <FormDialog
      title={agent ? "Edit agent" : "New agent"}
      description="A model endpoint and a set of tools. What it is asked to do comes from the lane it works; anything left blank here falls back to Settings."
      width="2xl"
      dirty={dirty}
      onClose={onClose}
      onSave={() => save.mutate()}
      saving={save.isPending}
      canSave={!nameError.invalid && !badNumber}
      aside={
        badNumber ? (
          <p className="self-center text-xs text-destructive">
            {badNumber[1]} needs to be a number.
          </p>
        ) : null
      }
    >
      <div className="flex flex-col gap-4">
        <FormField
          label="Name"
          required
          error={nameError.error}
          description="Name it after the model or the machine — never after a job, which is the lane's."
          control={
            <Input
              value={draft.name}
              onChange={(event) => set({ name: event.target.value })}
              placeholder="local llama"
              {...nameError.field}
            />
          }
        />

        <FormField
          orientation="horizontal"
          label="Enabled"
          description="A disabled agent is refused rather than skipped: a lane pointed at it stops."
          className="rounded-md border p-3"
          control={
            <Switch checked={draft.enabled} onCheckedChange={(enabled) => set({ enabled })} />
          }
        />

        {/*
          A text field followed by a `type="password"` one is the browser's definition of a sign-in
          form, so Chrome was offering saved credentials here and filling the endpoint with somebody's
          email address. `off` is ignored on a password box by design — `new-password` is the value
          that means "not the one you have stored", and it is what stops the pair being read as a
          login at all.
        */}
        <FormField
          label="Base URL"
          control={
            <Input
              value={draft.baseUrl}
              onChange={(event) => set({ baseUrl: event.target.value })}
              placeholder="empty — use the endpoint in Settings"
              autoComplete="off"
            />
          }
        />

        <FormField
          label="API key"
          description="An agent with a base URL of its own never borrows the shared key: a local model has no use for it, and the paid endpoint should not be reached by accident."
          control={
            <Input
              type="password"
              autoComplete="new-password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="unchanged — leave blank to keep the stored key"
            />
          }
        />

        <FormField
          label="Model"
          control={(props) => (
            <ModelSelect
              {...props}
              agentId={agent?.id}
              value={draft.model}
              onChange={(model) => set({ model })}
              defaultLabel="Whatever Settings says"
            />
          )}
        />

        <FormField
          label="Identity"
          description={
            'Said before the lane\'s own prompt, on every lane this agent works. It is for what a lane cannot know — "you are a small local model; be terse" — not for the job.'
          }
          control={
            <Textarea
              rows={4}
              value={draft.systemPrompt}
              onChange={(event) => set({ systemPrompt: event.target.value })}
              placeholder="usually empty — the lane says what to do"
            />
          }
        />

        <FormField
          // A box of switches is not one control, so the heading is a title the group points back
          // at rather than a `for` naming a `<div>`, which the browser drops without a word.
          asGroup
          label="MCP servers"
          description="What this agent can actually do. With none it can only think and write — enough to judge a card, and useless for working one."
          control={(props) => (
            <div {...props} className="flex flex-col gap-2 rounded-md border p-3">
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
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField
            label="Max tokens"
            description="0 inherits."
            control={
              <Input
                type="number"
                value={draft.maxTokens}
                onChange={(event) => set({ maxTokens: Number(event.target.value) })}
              />
            }
          />
          <FormField
            label="Context window"
            description="0 inherits, then asks the endpoint."
            control={
              <Input
                type="number"
                value={draft.contextLength}
                onChange={(event) => set({ contextLength: Number(event.target.value) })}
              />
            }
          />
          <FormField
            label="Temperature"
            description="-1 inherits."
            control={
              <Input
                type="number"
                step="0.1"
                value={draft.temperature}
                onChange={(event) => set({ temperature: Number(event.target.value) })}
              />
            }
          />
          <FormField
            label="Max tool steps"
            description="0 inherits."
            control={
              <Input
                type="number"
                value={draft.maxToolIterations}
                onChange={(event) => set({ maxToolIterations: Number(event.target.value) })}
              />
            }
          />
          <FormField
            label="Silence before giving up (s)"
            description="0 inherits."
            control={
              <Input
                type="number"
                value={draft.requestTimeoutSeconds}
                onChange={(event) => set({ requestTimeoutSeconds: Number(event.target.value) })}
              />
            }
          />
          <FormField
            label="Retries"
            description="-1 inherits."
            control={
              <Input
                type="number"
                value={draft.maxRetries}
                onChange={(event) => set({ maxRetries: Number(event.target.value) })}
              />
            }
          />
          <FormField
            label="Tool discovery"
            control={(props) => (
              <Select
                value={draft.toolDiscovery}
                onValueChange={(value) => set({ toolDiscovery: value as AgentsToolDiscoveryEnum })}
              >
                <SelectTrigger {...props} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inherit">Whatever Settings says</SelectItem>
                  <SelectItem value="eager">Eager</SelectItem>
                  <SelectItem value="ondemand">On demand</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>
    </FormDialog>
  );
}
