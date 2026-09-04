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
import { Page } from "@/components/app-shell";
import { FormField } from "@/components/form-field";
import { useLeaveGuard } from "@/components/leave-guard";
import { ModelSelect } from "@/components/model-select";
import { QueryError } from "@/components/query-error";
import { RowSkeleton } from "@/components/row-skeleton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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

interface Form {
  baseUrl: string;
  model: string;
  maxTokens: number;
  contextLength: number;
  temperature: number;
  maxToolIterations: number;
  toolDiscovery: SettingsToolDiscoveryEnum;
  toolSelectModel: string;
  requestTimeoutSeconds: number;
  maxRetries: number;
  runRetentionDays: number;
  workerIntervalSeconds: number;
  refineAgentId: string;
  refinePrompt: string;
}

type Loaded = NonNullable<SettingsQuery["settings"][number]>;

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
  refineAgentId: row.refineAgentId ?? "",
  refinePrompt: row.refinePrompt,
});

/** The numeric fields, by the label above each rather than by its column name. */
const NUMBERS = [
  ["maxTokens", "Max tokens"],
  ["contextLength", "Context window"],
  ["temperature", "Temperature"],
  ["maxToolIterations", "Max tool steps"],
  ["requestTimeoutSeconds", "Silence before giving up"],
  ["maxRetries", "Retries"],
  ["runRetentionDays", "Keep runs for"],
  ["workerIntervalSeconds", "Look for work every"],
] as const;

export function SettingsRoute() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [apiKey, setApiKey] = useState("");

  const settings = useQuery({ queryKey: ["settings"], queryFn: () => request(SettingsDocument) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["settings"] });

  // Every enabled agent, for both off-board jobs: an agent is a model, and neither of those
  // jobs is a thing any particular agent has been minted for.
  const agents = useQuery({ queryKey: ["agents"], queryFn: () => request(AgentsDocument) });
  const enabled = (agents.data?.agents ?? []).filter((agent) => agent.enabled);

  // The row is the source of truth; the form is a copy taken once it has loaded.
  const loaded = settings.data?.settings[0];
  useEffect(() => {
    if (loaded && !form) setForm(toForm(loaded));
  }, [loaded, form]);

  // Compared against the row as it stands rather than against a snapshot taken when the page
  // opened: this form is copied once and never re-synced, so a tab left open all afternoon is
  // exactly the one that saves over somebody else's change. Reset is the way back.
  const dirty = Boolean(
    form && loaded && (JSON.stringify(form) !== JSON.stringify(toForm(loaded)) || apiKey),
  );
  const badNumber = form ? NUMBERS.find(([key]) => !Number.isFinite(form[key])) : undefined;
  // "Unsaved changes" in the corner is a label, not a guard: every dialog in the app asks before
  // throwing away what you typed, and the longest form in it did not.
  const leaving = useLeaveGuard(dirty);

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      await request(UpdateSettingsDocument, {
        // An unnamed agent is no row, not a row with an empty id.
        set: {
          ...form,
          refineAgentId: form.refineAgentId || null,
        },
      });
      // The key travels on its own mutation because it is write-only — it is excluded from
      // the Setting type, so it can never be read back out of the API.
      if (apiKey) await request(SetApiKeyDocument, { apiKey });
      setApiKey("");
    },
    onSuccess: () => {
      toast.success("Settings saved");
      refresh();
    },
    onError: toastError,
  });

  const field = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  return (
    <Page
      title="Settings"
      description="What every agent falls back to for anything it does not set itself."
      actions={
        <>
          {badNumber ? (
            <p className="text-xs text-destructive">{badNumber[1]} needs to be a number.</p>
          ) : dirty ? (
            <p className="text-xs text-muted-foreground">Unsaved changes</p>
          ) : null}
          <Button
            variant="ghost"
            disabled={!dirty || save.isPending}
            onClick={() => {
              if (loaded) setForm(toForm(loaded));
              setApiKey("");
            }}
          >
            Reset
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={!form || !dirty || Boolean(badNumber) || save.isPending}
          >
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      {settings.isError ? (
        <QueryError
          error={settings.error}
          onRetry={() => settings.refetch()}
          what="these settings"
        />
      ) : null}

      <Card className="gap-4 p-4">
        <h2 className="font-medium">Model</h2>
        {form ? (
          <>
            <FormField
              label="Base URL"
              description={
                <>
                  Any OpenAI-compatible server: Ollama <code>:11434/v1</code>, LM Studio{" "}
                  <code>:1234/v1</code>, OpenAI, OpenRouter.
                </>
              }
              control={
                <Input
                  value={form.baseUrl}
                  onChange={(event) => field("baseUrl", event.target.value)}
                  placeholder="http://localhost:11434/v1"
                />
              }
            />

            <FormField
              label="API key"
              control={
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="unchanged — leave blank to keep the stored key"
                />
              }
            />

            <FormField
              label="Model"
              description="Opening the list asks the server above for its models, so save a new base URL first."
              control={(props) => (
                <ModelSelect
                  {...props}
                  value={form.model}
                  onChange={(model) => field("model", model)}
                />
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField
                label="Max tokens"
                control={
                  <Input
                    type="number"
                    value={form.maxTokens}
                    onChange={(event) => field("maxTokens", Number(event.target.value))}
                  />
                }
              />
              <FormField
                label="Context window"
                description="0 asks the endpoint. Set it when the endpoint reports a window it is not actually serving the model in."
                control={
                  <Input
                    type="number"
                    value={form.contextLength}
                    onChange={(event) => field("contextLength", Number(event.target.value))}
                  />
                }
              />
              <FormField
                label="Temperature"
                control={
                  <Input
                    type="number"
                    step="0.1"
                    value={form.temperature}
                    onChange={(event) => field("temperature", Number(event.target.value))}
                  />
                }
              />
              <FormField
                label="Max tool steps"
                control={
                  <Input
                    type="number"
                    value={form.maxToolIterations}
                    onChange={(event) => field("maxToolIterations", Number(event.target.value))}
                  />
                }
              />
              <FormField
                label="Silence before giving up (s)"
                description="Resets on every token, so a long answer is never cut off. 0 waits forever."
                control={
                  <Input
                    type="number"
                    value={form.requestTimeoutSeconds}
                    onChange={(event) => field("requestTimeoutSeconds", Number(event.target.value))}
                  />
                }
              />
              <FormField
                label="Retries"
                description="For a request that failed before the model said anything."
                control={
                  <Input
                    type="number"
                    value={form.maxRetries}
                    onChange={(event) => field("maxRetries", Number(event.target.value))}
                  />
                }
              />
              <FormField
                label="Keep runs for (days)"
                description="Older runs are deleted hourly. 0 keeps every run forever."
                control={
                  <Input
                    type="number"
                    value={form.runRetentionDays}
                    onChange={(event) => field("runRetentionDays", Number(event.target.value))}
                  />
                }
              />
              <FormField
                label="Look for work every (s)"
                description="How often boards on auto are checked for cards to pick up. 0 stops the worker."
                control={
                  <Input
                    type="number"
                    value={form.workerIntervalSeconds}
                    onChange={(event) => field("workerIntervalSeconds", Number(event.target.value))}
                  />
                }
              />
            </div>
          </>
        ) : settings.isError ? null : (
          <RowSkeleton rows={3} />
        )}
      </Card>

      {form ? (
        <Card className="gap-4 p-4">
          <h2 className="font-medium">MCP tools</h2>

          <FormField
            label="Discovery"
            description="On demand puts a name-only catalogue in the system prompt and lets the model pull in the schemas it needs mid-run. Much cheaper with many tools; costs one extra round trip on the runs that use them."
            control={(props) => (
              <Select
                value={form.toolDiscovery}
                onValueChange={(value) =>
                  field("toolDiscovery", value as SettingsToolDiscoveryEnum)
                }
              >
                <SelectTrigger {...props} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SettingsToolDiscoveryEnum.Eager}>
                    Eager — send every definition every time
                  </SelectItem>
                  <SelectItem value={SettingsToolDiscoveryEnum.Ondemand}>
                    On demand — load definitions as needed
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          />

          <FormField
            label="Tool-picking model"
            description="Guesses which tools a run needs before it starts, so on-demand loading usually costs no round trip at all. A small fast model is enough. Unused unless discovery is on demand."
            control={(props) => (
              <ModelSelect
                {...props}
                value={form.toolSelectModel}
                onChange={(model) => field("toolSelectModel", model)}
                defaultLabel="Same model as the agent"
              />
            )}
          />
        </Card>
      ) : null}

      {form ? (
        <Card className="gap-4 p-4">
          <div>
            <h2 className="font-medium">Off the board</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Talking a task over happens nowhere on a board, so no lane can say who does it —
              everything else an agent does, a lane names. A project may name its own refiner; this
              is what it falls back to.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Refining agent"
              control={(props) => (
                <Select
                  value={form.refineAgentId || ANY}
                  onValueChange={(value) => field("refineAgentId", value === ANY ? "" : value)}
                >
                  <SelectTrigger {...props} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>The first enabled agent</SelectItem>
                    {enabled.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <FormField
            label="Refining prompt"
            description="Refinement is a conversation rather than a kind of lane, so it has no role to keep this on. Empty uses the prompt built in."
            control={
              <Textarea
                rows={6}
                value={form.refinePrompt}
                onChange={(event) => field("refinePrompt", event.target.value)}
                placeholder="empty — the built-in one, which asks questions until the task is worth working on"
              />
            }
          />
        </Card>
      ) : null}

      <Card className="gap-4 p-4">
        <div>
          <h2 className="font-medium">Connect an agent</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This server's own API is served as MCP tools at <code>{ENDPOINT}</code>, so an assistant
            elsewhere can make a project, hand it a task, and watch it broken into cards and worked.
            There is no authentication: anyone who can reach the port can do all of that.
          </p>
        </div>

        <Snippet label=".mcp.json" text={MCP_JSON} />
        <Snippet label="Claude Code" text={CLAUDE_CLI} />
      </Card>

      {leaving}
    </Page>
  );
}
