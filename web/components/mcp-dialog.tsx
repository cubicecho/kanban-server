import { useMutation } from "@tanstack/react-query";
import { ClipboardPaste, PlugZap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  CreateMcpServerDocument,
  type McpProbe,
  type McpServersQuery,
  McpServersTransportEnum,
  TestMcpServerDocument,
  UpdateMcpServerDocument,
} from "@/__generated__/graphql";
import { useFieldError } from "@/components/field-error";
import { FormDialog } from "@/components/form-dialog";
import { ProbeResult } from "@/components/probe-result";
import { Button } from "@/components/ui/button";
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
import { parseJson, parseMcpJson } from "@/lib/mcp-config";
import { toastError } from "@/lib/toast";
import { cn } from "@/lib/utils";

type McpServer = McpServersQuery["mcpServers"][number];

/** The form's own shape: JSON columns are edited as text, so a half-typed object is allowed. */
interface Draft {
  slug: string;
  label: string;
  enabled: boolean;
  transport: McpServersTransportEnum;
  command: string;
  args: string;
  env: string;
  url: string;
  headers: string;
}

const json = (value: unknown, fallback: string) =>
  value === null || value === undefined ? fallback : JSON.stringify(value);

const toDraft = (server?: McpServer): Draft => ({
  slug: server?.slug ?? "",
  label: server?.label ?? "",
  enabled: server?.enabled ?? true,
  transport: server?.transport ?? McpServersTransportEnum.Stdio,
  command: server?.command ?? "",
  args: json(server?.args, "[]"),
  env: json(server?.env, "{}"),
  url: server?.url ?? "",
  headers: json(server?.headers, "{}"),
});

export function McpDialog({
  server,
  onClose,
  onSaved,
}: {
  server?: McpServer;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(server));
  const [paste, setPaste] = useState("");
  const [probe, setProbe] = useState<McpProbe | null>(null);
  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const stdio = draft.transport === McpServersTransportEnum.Stdio;

  const dirty = useDirty({ ...draft });
  // What each transport actually needs, said under the field rather than thrown from the save.
  const slugError = useFieldError(
    "slug",
    draft.slug.trim() ? "" : "A server needs a slug — its tools are named after it.",
  );
  const commandError = useFieldError(
    "command",
    stdio && !draft.command.trim() ? "A stdio server is started by a command." : "",
  );
  const urlError = useFieldError(
    "url",
    !stdio && !draft.url.trim() ? "An http server needs a url to reach." : "",
  );
  const invalid = slugError.invalid || commandError.invalid || urlError.invalid;

  /** The connection half of the draft, as the API wants it. Throws on malformed JSON. */
  const connection = () => ({
    transport: draft.transport,
    command: draft.command.trim(),
    args: parseJson<string[]>(draft.args, "Args", []),
    env: parseJson<Record<string, string>>(draft.env, "Env", {}),
    url: draft.url.trim(),
    headers: parseJson<Record<string, string>>(draft.headers, "Headers", {}),
  });

  const test = useMutation({
    mutationFn: async () => {
      setProbe(null);
      const { testMcpServer } = await request(TestMcpServerDocument, { config: connection() });
      return testMcpServer;
    },
    onSuccess: (result) => setProbe(result),
    onError: toastError,
  });

  const save = useMutation({
    mutationFn: async () => {
      const values = { ...connection(), slug: draft.slug.trim(), label: draft.label.trim() };
      if (server) {
        await request(UpdateMcpServerDocument, {
          id: server.id,
          set: { ...values, enabled: draft.enabled },
        });
      } else {
        await request(CreateMcpServerDocument, { values: { ...values, enabled: draft.enabled } });
      }
    },
    onSuccess: () => {
      toast.success(server ? "Server saved" : "Server added");
      onSaved();
      onClose();
    },
    onError: toastError,
  });

  const applyPaste = () => {
    try {
      set(parseMcpJson(paste));
      setPaste("");
      toast.success("Config applied");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <FormDialog
      title={server ? "Edit server" : "New MCP server"}
      description={
        <>
          Its tools reach any agent linked to it as <code>{draft.slug || "slug"}__tool-name</code>.
        </>
      }
      width="2xl"
      dirty={dirty}
      onClose={onClose}
      onSave={() => save.mutate()}
      saving={save.isPending}
      canSave={!invalid}
      aside={
        <Button variant="secondary" onClick={() => test.mutate()} disabled={test.isPending}>
          <PlugZap className="size-4" />
          {test.isPending ? "Connecting…" : "Test connection"}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-md border border-dashed p-3">
          <Label htmlFor="paste">Paste a config</Label>
          <Textarea
            id="paste"
            rows={3}
            className="font-mono text-xs"
            value={paste}
            onChange={(event) => setPaste(event.target.value)}
            placeholder={'{ "mcpServers": { "fs": { "command": "npx", "args": ["-y", "…"] } } }'}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              <code>.mcp.json</code> shaped — the whole file, one entry, or just the body.
            </p>
            <Button variant="secondary" size="sm" onClick={applyPaste} disabled={!paste.trim()}>
              <ClipboardPaste className="size-4" />
              Apply
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              className="font-mono"
              value={draft.slug}
              onChange={(event) => set({ slug: event.target.value })}
              placeholder="filesystem"
              {...slugError.field}
            />
            {slugError.error}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              value={draft.label}
              onChange={(event) => set({ label: event.target.value })}
              placeholder="Local files"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="transport">Transport</Label>
          <Select
            value={draft.transport}
            onValueChange={(value) => set({ transport: value as McpServersTransportEnum })}
          >
            <SelectTrigger id="transport" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={McpServersTransportEnum.Stdio}>
                stdio — run a local command
              </SelectItem>
              <SelectItem value={McpServersTransportEnum.Http}>http — connect to a URL</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {stdio ? (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="command">Command</Label>
              <Input
                id="command"
                className="font-mono"
                value={draft.command}
                onChange={(event) => set({ command: event.target.value })}
                placeholder="npx"
                {...commandError.field}
              />
              {commandError.error}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="args">Args</Label>
              <Input
                id="args"
                className="font-mono text-xs"
                value={draft.args}
                onChange={(event) => set({ args: event.target.value })}
                placeholder='["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]'
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="env">Env</Label>
              <Input
                id="env"
                className="font-mono text-xs"
                value={draft.env}
                onChange={(event) => set({ env: event.target.value })}
                placeholder='{ "API_TOKEN": "…" }'
              />
              <p className="text-xs text-muted-foreground">
                Merged over the server's own environment, so the child still inherits PATH.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                className="font-mono"
                value={draft.url}
                onChange={(event) => set({ url: event.target.value })}
                placeholder="https://example.com/mcp"
                {...urlError.field}
              />
              {urlError.error}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="headers">Headers</Label>
              <Input
                id="headers"
                className="font-mono text-xs"
                value={draft.headers}
                onChange={(event) => set({ headers: event.target.value })}
                placeholder='{ "Authorization": "Bearer …" }'
              />
            </div>
          </>
        )}

        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <Label htmlFor="enabled">Enabled</Label>
            <p className="text-xs text-muted-foreground">
              A disabled server stays configured but offers no tools.
            </p>
          </div>
          <Switch
            id="enabled"
            checked={draft.enabled}
            onCheckedChange={(enabled) => set({ enabled })}
          />
        </div>

        {probe ? (
          <ProbeResult
            probe={probe}
            className={cn("rounded-md border p-3", !probe.ok && "border-destructive")}
          />
        ) : null}
      </div>
    </FormDialog>
  );
}
