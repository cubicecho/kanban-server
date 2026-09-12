import { useSelector } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Check, CheckCircle2, Copy, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AgentModelsDocument,
  AgentsDocument,
  SetApiKeyDocument,
  SettingsDocument,
  type SettingsFieldsFragment,
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
import { FieldRow } from "@/components/field-row";
import { FormField } from "@/components/form-field";
import { useLeaveGuard } from "@/components/leave-guard";
import { ModelField } from "@/components/model-select";
import { PasswordField } from "@/components/password-field";
import { QueryError } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { request } from "@/lib/gql";
import {
  ANY_AGENT,
  dirtySections,
  SETTINGS_SECTIONS,
  type SettingsForm,
  type SettingsSection,
  sectionLabel,
  toForm,
  toRow,
} from "@/lib/settings-form";
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
        <Button type="button" variant="ghost" size="xs" onClick={copy}>
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

/** Every number here is optional in the sense that it inherits — none of them is optional empty. */
const NEEDS_A_NUMBER = {
  onChange: ({ value }: { value: number | null }) =>
    value === null ? "This needs to be a number." : undefined,
};

/** The id the Save button in the footer submits, being outside the form it saves. */
const FORM_ID = "settings";

const TITLE = "Settings";
const DESCRIPTION = "What every agent falls back to for anything it does not set itself.";

/** How the endpoint button last went: what the server answered, or why it did not. */
type Probe = { ok: boolean; detail: string } | null;

export function SettingsRoute() {
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => request(SettingsDocument) });
  const row = settings.data?.settings[0];

  // The form is not built until the row it is a copy of has arrived. Built earlier, it had to
  // start from blanks and be reset into the row afterwards — and TanStack Form, handed the
  // blanks again on the next render by an untouched form, put them back: the page opened with
  // every field empty and "Unsaved changes" in the corner.
  if (!row) {
    return (
      <Page title={TITLE} description={DESCRIPTION}>
        {settings.isError ? (
          <QueryError
            error={settings.error}
            onRetry={() => settings.refetch()}
            what="these settings"
          />
        ) : (
          <CardLayout title="Model" loading />
        )}
      </Page>
    );
  }

  return <SettingsEditor row={row} />;
}

/**
 * The one settings row, behind the panels that edit parts of it.
 *
 * There is one draft and the panels are field groups over it: from the row's point of view there
 * is no saving only the Tools half, so the bar under the page writes the whole row and says which
 * panels the unsaved changes are on. Every panel stays mounted and is only hidden, so a value
 * typed on one tab is still there, and still counted, when you are on another.
 */
function SettingsEditor({ row }: { row: SettingsFieldsFragment }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { tab = "model" } = useSearch({ from: "/settings" });
  const [probe, setProbe] = useState<Probe>(null);

  // Every enabled agent, for the refiner: refining is a conversation, not a lane, so no agent
  // has been minted for it.
  const agents = useQuery({ queryKey: ["agents"], queryFn: () => request(AgentsDocument) });
  const enabled = (agents.data?.agents ?? []).filter((agent) => agent.enabled);

  /** What was written becomes the row this page is a copy of, without waiting on a refetch. */
  const store = (fresh: SettingsFieldsFragment) =>
    queryClient.setQueryData<SettingsQuery>(["settings"], { settings: [fresh] });

  const save = useMutation({
    mutationFn: async (values: SettingsForm) => {
      const { updateSetting } = await request(UpdateSettingsDocument, { set: toRow(values) });
      // The key travels on its own mutation because it is write-only — it is excluded from
      // the Setting type, so it can never be read back out of the API.
      if (values.apiKey) await request(SetApiKeyDocument, { apiKey: values.apiKey });
      if (!updateSetting) throw new Error("There is no settings row to save to.");
      return updateSetting;
    },
    onSuccess: (fresh) => {
      // Reseeded from what the save read back. Left to a refetch, the form spent the gap being
      // compared against the row as it was before the save, and said the changes it had just
      // written were still unsaved.
      form.reset(toForm(fresh));
      store(fresh);
      // A model list belongs to an endpoint, and agents that inherit this one inherit its list.
      queryClient.invalidateQueries({ queryKey: ["models"] });
      toast.success("Settings saved");
    },
  });

  const form = useAppForm({
    // Derived from the row on every render rather than held: the form library compares this
    // against what it was last given, and a value that disagreed with the last `reset` is what
    // it used to put back over the loaded row. While nothing is touched, a row that changes
    // underneath — a refetch, a save — reseeds the form; once something is, it is left alone.
    defaultValues: toForm(row),
    onSubmit: ({ value }) => save.mutateAsync(value).catch(toastError),
  });

  const values = useSelector(form.store, (state) => state.values);
  const dirty = dirtySections(values, row);

  /**
   * Store just the endpoint, then ask it what it serves.
   *
   * The model pickers list what the *stored* endpoint reports, so until a typed base URL is
   * saved there is nothing behind them but the last server's answers. A patch rather than a
   * whole save, because "point at this server" should not also commit a half-written prompt
   * two tabs away — and for the same reason nothing else in the form is reseeded.
   */
  const applyEndpoint = useMutation({
    mutationFn: async ({ baseUrl, apiKey }: Pick<SettingsForm, "baseUrl" | "apiKey">) => {
      const { updateSetting } = await request(UpdateSettingsDocument, { set: { baseUrl } });
      if (apiKey) await request(SetApiKeyDocument, { apiKey });
      if (updateSetting) store(updateSetting);
      form.setFieldValue("apiKey", "");
      await queryClient.invalidateQueries({ queryKey: ["models"], refetchType: "none" });
      const { models } = await queryClient.query({
        queryKey: ["models", ""],
        queryFn: () => request(AgentModelsDocument, { agentId: null }),
        retry: false,
      });
      return `${baseUrl || "the default endpoint"} — ${models.length} model(s)`;
    },
    onMutate: () => setProbe(null),
    onSuccess: (detail) => setProbe({ ok: true, detail }),
    onError: (error) => setProbe({ ok: false, detail: error.message }),
  });

  const endpointPending = values.baseUrl !== row.baseUrl || Boolean(values.apiKey);

  // Asked when leaving, so it reads the form and the row as they are then rather than as they
  // were at the last render.
  const leaving = useLeaveGuard(
    () =>
      dirtySections(
        form.state.values,
        queryClient.getQueryData<SettingsQuery>(["settings"])?.settings[0] ?? undefined,
      ).length > 0,
  );

  const open = (next: string) =>
    navigate({ to: "/settings", search: { tab: next as SettingsSection }, replace: true });

  // Pinned under the scroller, and only there when there is something to do with it: the page
  // is panels long, and a Save past the end of one of them is a Save you scroll to.
  const bar =
    dirty.length > 0 ? (
      <div className="flex flex-wrap items-center gap-3 border-t bg-background px-6 py-3">
        <p className="flex-1 text-sm text-muted-foreground">
          Unsaved changes on {dirty.map(sectionLabel).join(", ")}
        </p>
        <Button
          type="button"
          variant="ghost"
          disabled={save.isPending}
          onClick={() => {
            form.reset(toForm(row));
            setProbe(null);
          }}
        >
          Revert
        </Button>
        <form.AppForm>
          <form.SubmitButton form={FORM_ID} />
        </form.AppForm>
      </div>
    ) : null;

  const panel = "flex flex-col gap-4 data-[state=inactive]:hidden";

  return (
    <Page title={TITLE} description={DESCRIPTION} footer={bar}>
      <Tabs value={tab} onValueChange={open}>
        <div className="max-w-full overflow-x-auto">
          <TabsList>
            {SETTINGS_SECTIONS.map((section) => (
              <TabsTrigger key={section.key} value={section.key}>
                {section.label}
                {dirty.includes(section.key) ? (
                  <>
                    <span aria-hidden className="size-1.5 rounded-full bg-primary" />
                    <span className="sr-only">(unsaved changes)</span>
                  </>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <form
          id={FORM_ID}
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
        >
          <TabsContent value="model" forceMount className={panel}>
            <CardLayout
              title="Endpoint"
              description="Any OpenAI-compatible server. Every agent that names no endpoint of its own uses this one."
              contentClassName="flex flex-col gap-4"
              content={
                <>
                  <InputField
                    form={form}
                    name="baseUrl"
                    label="Base URL"
                    description={
                      <>
                        Ollama <code>:11434/v1</code>, LM Studio <code>:1234/v1</code>, OpenAI,
                        OpenRouter.
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

                  {/* Its own button rather than the bar's job, because these are the two fields
                      something else on the page depends on: the model pickers ask the stored
                      endpoint, not the one in the boxes. */}
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={applyEndpoint.isPending}
                      onClick={() =>
                        applyEndpoint.mutate({ baseUrl: values.baseUrl, apiKey: values.apiKey })
                      }
                    >
                      {applyEndpoint.isPending
                        ? "Connecting…"
                        : endpointPending
                          ? "Apply and load models"
                          : "Reload models"}
                    </Button>
                    {endpointPending ? (
                      <p className="text-xs text-muted-foreground">
                        Not applied yet — the model lists are still the stored endpoint's.
                      </p>
                    ) : null}
                  </div>

                  {probe ? (
                    <div className="flex items-start gap-2 text-sm">
                      {probe.ok ? (
                        <CheckCircle2
                          className="mt-0.5 size-4 shrink-0 text-status-running"
                          aria-hidden
                        />
                      ) : (
                        <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                      )}
                      <p
                        className={
                          probe.ok
                            ? "text-muted-foreground"
                            : "whitespace-pre-wrap font-mono text-xs text-destructive"
                        }
                      >
                        {probe.ok ? `Connected — ${probe.detail}` : probe.detail}
                      </p>
                    </div>
                  ) : null}
                </>
              }
            />

            <CardLayout
              title="Model"
              contentClassName="flex flex-col gap-4"
              content={
                <ModelField
                  form={form}
                  name="model"
                  label="Default model"
                  description="Used by every agent that names no model of its own."
                />
              }
            />
          </TabsContent>

          <TabsContent value="limits" forceMount className={panel}>
            <CardLayout
              title="Limits"
              description="What one run may spend. The context window is the whole conversation; max tokens is only the reply at the end of it."
              contentClassName="flex flex-col gap-4"
              content={
                <>
                  <FieldRow
                    content={
                      <>
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
                      </>
                    }
                  />
                  <FieldRow
                    content={
                      <>
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
                      </>
                    }
                  />
                </>
              }
            />

            <CardLayout
              title="Resilience"
              description="What a request does when the endpoint goes quiet or falls over."
              contentClassName="flex flex-col gap-4"
              content={
                <FieldRow
                  content={
                    <>
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
                    </>
                  }
                />
              }
            />
          </TabsContent>

          <TabsContent value="tools" forceMount className={panel}>
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
          </TabsContent>

          <TabsContent value="refining" forceMount className={panel}>
            <CardLayout
              title="Off the board"
              description="Talking a task over happens nowhere on a board, so no lane can say who does it — everything else an agent does, a lane names. A project may name its own refiner; this is what it falls back to."
              contentClassName="flex flex-col gap-4"
              content={
                <>
                  <SelectField
                    form={form}
                    name="refineAgentId"
                    label="Refining agent"
                    options={[
                      { value: ANY_AGENT, label: "The first enabled agent" },
                      ...enabled.map((agent) => ({ value: agent.id, label: agent.name })),
                    ]}
                  />

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
          </TabsContent>

          <TabsContent value="server" forceMount className={panel}>
            <CardLayout
              title="Housekeeping"
              description="What this process does on its own, with no board asking."
              contentClassName="flex flex-col gap-4"
              content={
                <FieldRow
                  content={
                    <>
                      <NumberField
                        form={form}
                        name="workerIntervalSeconds"
                        label="Look for work every (s)"
                        description="How often boards on auto are checked for cards to pick up. 0 stops the worker."
                        validators={NEEDS_A_NUMBER}
                      />
                      <NumberField
                        form={form}
                        name="runRetentionDays"
                        label="Keep runs for (days)"
                        description="Older runs are deleted hourly. 0 keeps every run forever."
                        validators={NEEDS_A_NUMBER}
                      />
                    </>
                  }
                />
              }
            />
          </TabsContent>
        </form>

        {/* Outside the form: it edits nothing, and a button inside one is a submit. */}
        <TabsContent value="connect" forceMount className={panel}>
          <CardLayout
            title="Connect an agent"
            description={
              <>
                This server's own API is served as MCP tools at <code>{ENDPOINT}</code>, so an
                assistant elsewhere can make a project, hand it a task, and watch it broken into
                cards and worked. There is no authentication unless <code>KANBAN_SERVER_TOKEN</code>{" "}
                is set: without it, anyone who can reach the port can do all of that.
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
        </TabsContent>
      </Tabs>

      {leaving}
    </Page>
  );
}
