import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type AgentsQuery,
  type AgentsToolDiscoveryEnum,
  CreateAgentDocument,
  SetAgentApiKeyDocument,
  SetAgentServersDocument,
  UpdateAgentDocument,
} from "@/__generated__/graphql";
import {
  InputField,
  NumberField,
  SelectField,
  SwitchField,
  TextareaField,
  useAppForm,
} from "@/components/app-form";
import { FormDialog } from "@/components/form-dialog";
import { FormField } from "@/components/form-field";
import { ModelField } from "@/components/model-select";
import { PasswordField } from "@/components/password-field";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { request } from "@/lib/gql";
import { toastError } from "@/lib/toast";

type Agent = AgentsQuery["agents"][number];
type McpServer = AgentsQuery["mcpServers"][number];

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

  const save = useMutation({
    mutationFn: async (draft: {
      name: string;
      enabled: boolean;
      baseUrl: string;
      apiKey: string;
      model: string;
      systemPrompt: string;
      maxTokens: number | null;
      contextLength: number | null;
      temperature: number | null;
      maxToolIterations: number | null;
      toolDiscovery: string;
      requestTimeoutSeconds: number | null;
      maxRetries: number | null;
      linked: string[];
    }) => {
      const values = {
        name: draft.name.trim(),
        enabled: draft.enabled,
        baseUrl: draft.baseUrl,
        model: draft.model,
        systemPrompt: draft.systemPrompt,
        maxTokens: draft.maxTokens ?? 0,
        contextLength: draft.contextLength ?? 0,
        temperature: draft.temperature ?? -1,
        maxToolIterations: draft.maxToolIterations ?? 0,
        toolDiscovery: draft.toolDiscovery as AgentsToolDiscoveryEnum,
        requestTimeoutSeconds: draft.requestTimeoutSeconds ?? 0,
        maxRetries: draft.maxRetries ?? -1,
      };
      let id = agent?.id;
      if (id) await request(UpdateAgentDocument, { id, set: values });
      else id = (await request(CreateAgentDocument, { values })).createAgent.id;
      // Written after the row exists, and separately: the servers are a set, and the key is
      // write-only so it never comes back down with the rest of the agent.
      await request(SetAgentServersDocument, { agentId: id, serverIds: draft.linked });
      if (draft.apiKey)
        await request(SetAgentApiKeyDocument, { agentId: id, apiKey: draft.apiKey });
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      onClose();
    },
  });

  const form = useAppForm({
    defaultValues: {
      name: agent?.name ?? "",
      enabled: agent?.enabled ?? true,
      baseUrl: agent?.baseUrl ?? "",
      // Write-only, and never comes back down: there is nothing to compare it against, so
      // typing one is a change by definition.
      apiKey: "",
      model: agent?.model ?? "",
      systemPrompt: agent?.systemPrompt ?? "",
      maxTokens: (agent?.maxTokens ?? 0) as number | null,
      contextLength: (agent?.contextLength ?? 0) as number | null,
      temperature: (agent?.temperature ?? -1) as number | null,
      maxToolIterations: (agent?.maxToolIterations ?? 0) as number | null,
      toolDiscovery: (agent?.toolDiscovery ?? "inherit") as string,
      requestTimeoutSeconds: (agent?.requestTimeoutSeconds ?? 0) as number | null,
      maxRetries: (agent?.maxRetries ?? -1) as number | null,
      linked: agent?.servers.map((link) => link.serverId) ?? [],
    },
    onSubmit: ({ value }) => save.mutateAsync(value).catch(toastError),
  });

  return (
    <FormDialog
      form={form}
      title={agent ? "Edit agent" : "New agent"}
      description="A model endpoint and a set of tools. What it is asked to do comes from the lane it works; anything left blank here falls back to Settings."
      width="2xl"
      onClose={onClose}
    >
      <InputField
        form={form}
        name="name"
        label="Name"
        required
        description="Name it after the model or the machine — never after a job, which is the lane's."
        placeholder="local llama"
        validators={{
          onChange: ({ value }) => (value.trim() ? undefined : "An agent needs a name."),
        }}
      />

      <SwitchField
        form={form}
        name="enabled"
        label="Enabled"
        description="A disabled agent is refused rather than skipped: a lane pointed at it stops."
        className="rounded-md border p-3"
      />

      {/*
        A text field followed by a `type="password"` one is the browser's definition of a sign-in
        form, so Chrome was offering saved credentials here and filling the endpoint with somebody's
        email address. `off` is ignored on a password box by design — `new-password` is the value
        that means "not the one you have stored", and it is what stops the pair being read as a
        login at all.
      */}
      <InputField
        form={form}
        name="baseUrl"
        label="Base URL"
        placeholder="empty — use the endpoint in Settings"
        autoComplete="off"
      />

      <PasswordField
        form={form}
        name="apiKey"
        label="API key"
        description="An agent with a base URL of its own never borrows the shared key: a local model has no use for it, and the paid endpoint should not be reached by accident."
        autoComplete="new-password"
        placeholder="unchanged — leave blank to keep the stored key"
      />

      <ModelField
        form={form}
        name="model"
        label="Model"
        agentId={agent?.id}
        defaultLabel="Whatever Settings says"
      />

      <TextareaField
        form={form}
        name="systemPrompt"
        label="Identity"
        description={
          'Said before the lane\'s own prompt, on every lane this agent works. It is for what a lane cannot know — "you are a small local model; be terse" — not for the job.'
        }
        rows={4}
        placeholder="usually empty — the lane says what to do"
      />

      {/*
        A box of switches is not one control, so the heading is a title the group points back at
        rather than a `for` naming a `<div>`, which the browser drops without a word.
      */}
      <form.AppField name="linked">
        {(field) => (
          <FormField
            asGroup
            label="MCP servers"
            description="What this agent can actually do. With none it can only think and write — enough to judge a card, and useless for working one."
            control={(wiring) => (
              <div {...wiring} className="flex flex-col gap-2 rounded-md border p-3">
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
                      checked={field.state.value.includes(server.id)}
                      onCheckedChange={() =>
                        field.handleChange(
                          field.state.value.includes(server.id)
                            ? field.state.value.filter((row) => row !== server.id)
                            : [...field.state.value, server.id],
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          />
        )}
      </form.AppField>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NumberField form={form} name="maxTokens" label="Max tokens" description="0 inherits." />
        <NumberField
          form={form}
          name="contextLength"
          label="Context window"
          description="0 inherits, then asks the endpoint."
        />
        <NumberField
          form={form}
          name="temperature"
          label="Temperature"
          description="-1 inherits."
          step="0.1"
        />
        <NumberField
          form={form}
          name="maxToolIterations"
          label="Max tool steps"
          description="0 inherits."
        />
        <NumberField
          form={form}
          name="requestTimeoutSeconds"
          label="Silence before giving up (s)"
          description="0 inherits."
        />
        <NumberField form={form} name="maxRetries" label="Retries" description="-1 inherits." />
        <SelectField
          form={form}
          name="toolDiscovery"
          label="Tool discovery"
          options={[
            { value: "inherit", label: "Whatever Settings says" },
            { value: "eager", label: "Eager" },
            { value: "ondemand", label: "On demand" },
          ]}
        />
      </div>
    </FormDialog>
  );
}
