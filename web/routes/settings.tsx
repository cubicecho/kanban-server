import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AgentsDocument,
  SetApiKeyDocument,
  SettingsDocument,
  type SettingsQuery,
  SettingsToolDiscoveryEnum,
  UpdateSettingsDocument,
} from "@/__generated__/graphql";
import {
  InputField,
  NumberField,
  SelectField,
  TextareaField,
  useAppForm,
} from "@/components/app-form";
import { Page } from "@/components/app-shell";
import { CardLayout } from "@/components/card-layout";
import { FormField } from "@/components/form-field";
import { useLeaveGuard } from "@/components/leave-guard";
import { ModelField } from "@/components/model-select";
import { PasswordField } from "@/components/password-field";
import { QueryError } from "@/components/query-error";
import { Button } from "@/components/ui/button";
import { request } from "@/lib/gql";
import { toastError } from "@/lib/toast";

/**
 * Where an agent reaches this server.
 *
 * In production express serves the app and the endpoint from one origin, so the page's own is
 * the answer. In dev the app is on vite's port and only `/graphql` is proxied (see
 * `vite.config.ts`), so the endpoint is on the server's own port — the default one, since a
 * page has no way to ask what `PORT` was set to.
 */
const ENDPOINT = import.meta.env.DEV
  ? `${window.location.protocol}//${window.location.hostname}:8788/mcp`
  : `${window.location.origin}/mcp`;

/** What a client wants in its `.mcp.json`, ready to paste. */
const MCP_JSON = `{
  "mcpServers": {
    "kanban": {
      "type": "http",
      "url": "${ENDPOINT}"
    }
  }
}`;

const CLAUDE_CLI = `claude mcp add --transport http kanban ${ENDPOINT}`;

/** No agent named: whichever enabled one comes first by name. */
const ANY = "__any__";

/**
 * The old way to copy, for the pages that cannot use the new one: `navigator.clipboard` exists
 * only in a secure context, and this app is as often as not served over plain http on a LAN.
 */
function copyTheOldWay(text: string) {
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}

function Snippet({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(text);
      else copyTheOldWay(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy. Select the text and copy it by hand.");
    }
  };

  return (
    <FormField
      // A block of text to copy, not a control: the heading names the region, and the Copy
      // button is what the label row's far end is for.
      asGroup
      label={label}
      action={
        <Button variant="ghost" size="xs" onClick={copy}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </Button>
      }
      control={(props) => (
        <pre {...props} className="overflow-x-auto rounded-md border bg-muted/30 p-3 text-xs">
          <code>{text}</code>
        </pre>
      )}
    />
  );
}

/**
 * The row as the form holds it: the numbers stay numbers, and a box emptied on the way to
 * retyping one is `null` rather than a silent zero — which is what the shared validator below
 * refuses, in the field, instead of writing 0 to a column every agent falls back to.
 */
interface Form {
  baseUrl: string;
  model: string;
  maxTokens: number | null;
  contextLength: number | null;
  temperature: number | null;
  maxToolIterations: number | null;
  toolDiscovery: SettingsToolDiscoveryEnum;
  toolSelectModel: string;
  requestTimeoutSeconds: number | null;
  maxRetries: number | null;
  runRetentionDays: number | null;
  workerIntervalSeconds: number | null;
  refineAgentId: string;
  refinePrompt: string;
}

type Loaded = NonNullable<SettingsQuery["settings"][number]>;

/** What the form starts as, before the row it is a copy of has arrived. */
const BLANK: Form = {
  baseUrl: "",
  model: "",
  maxTokens: 0,
  contextLength: 0,
  temperature: -1,
  maxToolIterations: 0,
  toolDiscovery: SettingsToolDiscoveryEnum.Eager,
  toolSelectModel: "",
  requestTimeoutSeconds: 0,
  maxRetries: -1,
  runRetentionDays: 0,
  workerIntervalSeconds: 0,
  refineAgentId: ANY,
  refinePrompt: "",
};

/** The row as the form holds it: nulls become the empty string the pickers speak. */
const toForm = (row: Loaded): Form => ({
  baseUrl: row.baseUrl,
  model: row.model,
  maxTokens: row.maxTokens,
  contextLength: row.contextLength,
  temperature: row.temperature,
  maxToolIterations: row.maxToolIterations,
  toolDiscovery: row.toolDiscovery,
  toolSelectModel: row.toolSelectModel,
  requestTimeoutSeconds: row.requestTimeoutSeconds,
  maxRetries: row.maxRetries,
  runRetentionDays: row.runRetentionDays,
  workerIntervalSeconds: row.workerIntervalSeconds,
  refineAgentId: row.refineAgentId ?? ANY,
  refinePrompt: row.refinePrompt,
});

/**
 * Whether what is on screen still matches the row.
 *
 * Compared against the row as it stands rather than against a snapshot taken when the page
 * opened: this form is copied once and never re-synced, so a tab left open all afternoon is
 * exactly the one that saves over somebody else's change. Reset is the way back.
 */
const changed = (row: Loaded | undefined, values: Form & { apiKey: string }) => {
  if (!row) return false;
  const { apiKey, ...rest } = values;
  return Boolean(apiKey) || JSON.stringify(rest) !== JSON.stringify(toForm(row));
};

/** Every number here is optional in the sense that it inherits — none of them is optional empty. */
const NEEDS_A_NUMBER = {
  onChange: ({ value }: { value: number | null }) =>
    value === null ? "This needs to be a number." : undefined,
};

/** The id the Save button in the page header submits, being outside the form it saves. */
const FORM_ID = "settings";

export function SettingsRoute() {
  const queryClient = useQueryClient();
  const [seeded, setSeeded] = useState(false);

  const settings = useQuery({ queryKey: ["settings"], queryFn: () => request(SettingsDocument) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["settings"] });

  // Every enabled agent, for both off-board jobs: an agent is a model, and neither of those
  // jobs is a thing any particular agent has been minted for.
  const agents = useQuery({ queryKey: ["agents"], queryFn: () => request(AgentsDocument) });
  const enabled = (agents.data?.agents ?? []).filter((agent) => agent.enabled);

  const loaded = settings.data?.settings[0];

  const save = useMutation({
    mutationFn: async (values: Form & { apiKey: string }) => {
      const { apiKey, ...row } = values;
      await request(UpdateSettingsDocument, {
        set: {
          ...row,
          maxTokens: row.maxTokens ?? 0,
          contextLength: row.contextLength ?? 0,
          temperature: row.temperature ?? -1,
          maxToolIterations: row.maxToolIterations ?? 0,
          requestTimeoutSeconds: row.requestTimeoutSeconds ?? 0,
          maxRetries: row.maxRetries ?? -1,
          runRetentionDays: row.runRetentionDays ?? 0,
          workerIntervalSeconds: row.workerIntervalSeconds ?? 0,
          // An unnamed agent is no row, not a row with an empty id.
          refineAgentId: row.refineAgentId === ANY ? null : row.refineAgentId,
        },
      });
      // The key travels on its own mutation because it is write-only — it is excluded from
      // the Setting type, so it can never be read back out of the API.
      if (apiKey) await request(SetApiKeyDocument, { apiKey });
      return { ...values, apiKey: "" };
    },
    onSuccess: (saved) => {
      // What was just written is what the page is now a copy of, and the key is spent.
      form.reset(saved);
      toast.success("Settings saved");
      refresh();
    },
  });

  const form = useAppForm({
    defaultValues: { ...BLANK, apiKey: "" },
    onSubmit: ({ value }) => save.mutateAsync(value).catch(toastError),
  });

  // The row is the source of truth; the form is a copy taken once it has loaded. `reset` rather
  // than a field-by-field write, because the row it arrives as is also the baseline everything
  // after it is compared against.
  useEffect(() => {
    if (loaded && !seeded) {
      form.reset({ ...toForm(loaded), apiKey: "" });
      setSeeded(true);
    }
  }, [loaded, seeded, form]);

  // "Unsaved changes" in the corner is a label, not a guard: every dialog in the app asks before
  // throwing away what you typed, and the longest form in it did not.
  const leaving = useLeaveGuard(() => changed(loaded, form.state.values));

  return (
    <Page
      title="Settings"
      description="What every agent falls back to for anything it does not set itself."
      actions={
        <form.Subscribe selector={(state) => state.values}>
          {(values) => (
            <>
              {changed(loaded, values) ? (
                <p className="text-xs text-muted-foreground">Unsaved changes</p>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                disabled={!changed(loaded, values) || save.isPending}
                onClick={() => loaded && form.reset({ ...toForm(loaded), apiKey: "" })}
              >
                Reset
              </Button>
              <form.AppForm>
                <form.SubmitButton form={FORM_ID} />
              </form.AppForm>
            </>
          )}
        </form.Subscribe>
      }
    >
      {settings.isError ? (
        <QueryError
          error={settings.error}
          onRetry={() => settings.refetch()}
          what="these settings"
        />
      ) : null}

      <form
        id={FORM_ID}
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          form.handleSubmit();
        }}
      >
        <CardLayout
          title="Model"
          loading={!seeded && !settings.isError}
          contentClassName="flex flex-col gap-4"
          content={
            seeded ? (
              <>
                <InputField
                  form={form}
                  name="baseUrl"
                  label="Base URL"
                  description={
                    <>
                      Any OpenAI-compatible server: Ollama <code>:11434/v1</code>, LM Studio{" "}
                      <code>:1234/v1</code>, OpenAI, OpenRouter.
                    </>
                  }
                  placeholder="http://localhost:11434/v1"
                  autoComplete="off"
                />

                {/* `new-password` rather than `off`, which a password box ignores: see the agent
                    dialog, where the pair was being read as a login. */}
                <PasswordField
                  form={form}
                  name="apiKey"
                  label="API key"
                  autoComplete="new-password"
                  placeholder="unchanged — leave blank to keep the stored key"
                />

                <ModelField
                  form={form}
                  name="model"
                  label="Model"
                  description="Opening the list asks the server above for its models, so save a new base URL first."
                />

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <NumberField
                    form={form}
                    name="maxTokens"
                    label="Max tokens"
                    validators={NEEDS_A_NUMBER}
                  />
                  <NumberField
                    form={form}
                    name="contextLength"
                    label="Context window"
                    description="0 asks the endpoint. Set it when the endpoint reports a window it is not actually serving the model in."
                    validators={NEEDS_A_NUMBER}
                  />
                  <NumberField
                    form={form}
                    name="temperature"
                    label="Temperature"
                    step="0.1"
                    validators={NEEDS_A_NUMBER}
                  />
                  <NumberField
                    form={form}
                    name="maxToolIterations"
                    label="Max tool steps"
                    validators={NEEDS_A_NUMBER}
                  />
                  <NumberField
                    form={form}
                    name="requestTimeoutSeconds"
                    label="Silence before giving up (s)"
                    description="Resets on every token, so a long answer is never cut off. 0 waits forever."
                    validators={NEEDS_A_NUMBER}
                  />
                  <NumberField
                    form={form}
                    name="maxRetries"
                    label="Retries"
                    description="For a request that failed before the model said anything."
                    validators={NEEDS_A_NUMBER}
                  />
                  <NumberField
                    form={form}
                    name="runRetentionDays"
                    label="Keep runs for (days)"
                    description="Older runs are deleted hourly. 0 keeps every run forever."
                    validators={NEEDS_A_NUMBER}
                  />
                  <NumberField
                    form={form}
                    name="workerIntervalSeconds"
                    label="Look for work every (s)"
                    description="How often boards on auto are checked for cards to pick up. 0 stops the worker."
                    validators={NEEDS_A_NUMBER}
                  />
                </div>
              </>
            ) : null
          }
        />

        {seeded ? (
          <CardLayout
            title="MCP tools"
            contentClassName="flex flex-col gap-4"
            content={
              <>
                <SelectField
                  form={form}
                  name="toolDiscovery"
                  label="Discovery"
                  description="On demand puts a name-only catalogue in the system prompt and lets the model pull in the schemas it needs mid-run. Much cheaper with many tools; costs one extra round trip on the runs that use them."
                  options={[
                    {
                      value: SettingsToolDiscoveryEnum.Eager,
                      label: "Eager — send every definition every time",
                    },
                    {
                      value: SettingsToolDiscoveryEnum.Ondemand,
                      label: "On demand — load definitions as needed",
                    },
                  ]}
                />

                <ModelField
                  form={form}
                  name="toolSelectModel"
                  label="Tool-picking model"
                  description="Guesses which tools a run needs before it starts, so on-demand loading usually costs no round trip at all. A small fast model is enough. Unused unless discovery is on demand."
                  defaultLabel="Same model as the agent"
                />
              </>
            }
          />
        ) : null}

        {seeded ? (
          <CardLayout
            title="Off the board"
            description="Talking a task over happens nowhere on a board, so no lane can say who does it — everything else an agent does, a lane names. A project may name its own refiner; this is what it falls back to."
            contentClassName="flex flex-col gap-4"
            content={
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField
                    form={form}
                    name="refineAgentId"
                    label="Refining agent"
                    options={[
                      { value: ANY, label: "The first enabled agent" },
                      ...enabled.map((agent) => ({ value: agent.id, label: agent.name })),
                    ]}
                  />
                </div>

                <TextareaField
                  form={form}
                  name="refinePrompt"
                  label="Refining prompt"
                  description="Refinement is a conversation rather than a kind of lane, so it has no role to keep this on. Empty uses the prompt built in."
                  rows={6}
                  placeholder="empty — the built-in one, which asks questions until the task is worth working on"
                />
              </>
            }
          />
        ) : null}
      </form>

      <CardLayout
        title="Connect an agent"
        description={
          <>
            This server's own API is served as MCP tools at <code>{ENDPOINT}</code>, so an assistant
            elsewhere can make a project, hand it a task, and watch it broken into cards and worked.
            There is no authentication: anyone who can reach the port can do all of that.
          </>
        }
        contentClassName="flex flex-col gap-4"
        content={
          <>
            <Snippet label=".mcp.json" text={MCP_JSON} />
            <Snippet label="Claude Code" text={CLAUDE_CLI} />
          </>
        }
      />

      {leaving}
    </Page>
  );
}
