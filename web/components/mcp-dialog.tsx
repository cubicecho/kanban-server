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
import { InputField, SelectField, SwitchField, useAppForm } from "@/components/app-form";
import { FieldRow } from "@/components/field-row";
import { FormDialog } from "@/components/form-dialog";
import { FormField } from "@/components/form-field";
import { ProbeResult } from "@/components/probe-result";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

/** The connection half of the draft, as the API wants it. Throws on malformed JSON. */
const connectionOf = (draft: Draft) => ({
  transport: draft.transport,
  command: draft.command.trim(),
  args: parseJson<string[]>(draft.args, "Args", []),
  env: parseJson<Record<string, string>>(draft.env, "Env", {}),
  url: draft.url.trim(),
  headers: parseJson<Record<string, string>>(draft.headers, "Headers", {}),
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
  const [paste, setPaste] = useState("");
  const [probe, setProbe] = useState<McpProbe | null>(null);

  const save = useMutation({
    mutationFn: async (draft: Draft) => {
      const values = {
        ...connectionOf(draft),
        slug: draft.slug.trim(),
        label: draft.label.trim(),
        enabled: draft.enabled,
      };
      if (server) await request(UpdateMcpServerDocument, { id: server.id, set: values });
      else await request(CreateMcpServerDocument, { values });
    },
    onSuccess: () => {
      toast.success(server ? "Server saved" : "Server added");
      onSaved();
      onClose();
    },
  });

  const form = useAppForm({
    defaultValues: {
      slug: server?.slug ?? "",
      label: server?.label ?? "",
      enabled: server?.enabled ?? true,
      transport: server?.transport ?? McpServersTransportEnum.Stdio,
      command: server?.command ?? "",
      args: json(server?.args, "[]"),
      env: json(server?.env, "{}"),
      url: server?.url ?? "",
      headers: json(server?.headers, "{}"),
    } satisfies Draft,
    onSubmit: ({ value }) => save.mutateAsync(value).catch(toastError),
  });

  const test = useMutation({
    mutationFn: async () => {
      setProbe(null);
      const { testMcpServer } = await request(TestMcpServerDocument, {
        config: connectionOf(form.state.values),
      });
      return testMcpServer;
    },
    onSuccess: (result) => setProbe(result),
    onError: toastError,
  });

  const applyPaste = () => {
    try {
      const config = parseMcpJson(paste);
      if (config.slug) form.setFieldValue("slug", config.slug);
      form.setFieldValue("transport", config.transport);
      form.setFieldValue("command", config.command);
      form.setFieldValue("args", config.args);
      form.setFieldValue("env", config.env);
      form.setFieldValue("url", config.url);
      form.setFieldValue("headers", config.headers);
      setPaste("");
      toast.success("Config applied");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <FormDialog
      form={form}
      title={server ? "Edit server" : "New MCP server"}
      description={
        <form.Subscribe selector={(state) => state.values.slug}>
          {(slug) => (
            <>
              Its tools reach any agent linked to it as <code>{slug || "slug"}__tool-name</code>.
            </>
          )}
        </form.Subscribe>
      }
      width="2xl"
      onClose={onClose}
      aside={
        <Button
          type="button"
          variant="secondary"
          onClick={() => test.mutate()}
          disabled={test.isPending}
        >
          <PlugZap className="size-4" />
          {test.isPending ? "Connecting…" : "Test connection"}
        </Button>
      }
    >
      {/*
        Not a form field: it is never saved and never read back, it is a way of filling six that
        are. So it stays a `useState` and a presentational `FormField`, and Apply writes the
        fields it names.
      */}
      <FormField
        label="Paste a config"
        className="rounded-md border border-dashed p-3"
        description={
          <>
            <code>.mcp.json</code> shaped — the whole file, one entry, or just the body.
          </>
        }
        action={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={applyPaste}
            disabled={!paste.trim()}
          >
            <ClipboardPaste className="size-4" />
            Apply
          </Button>
        }
        control={
          <Textarea
            rows={3}
            className="font-mono text-xs"
            value={paste}
            onChange={(event) => setPaste(event.target.value)}
            placeholder={'{ "mcpServers": { "fs": { "command": "npx", "args": ["-y", "…"] } } }'}
          />
        }
      />

      <FieldRow
        content={
          <>
            <InputField
              form={form}
              name="slug"
              label="Slug"
              required
              className="font-mono"
              placeholder="filesystem"
              validators={{
                onChange: ({ value }) =>
                  value.trim()
                    ? undefined
                    : "A server needs a slug — its tools are named after it.",
              }}
            />
            <InputField form={form} name="label" label="Label" placeholder="Local files" />
          </>
        }
      />

      <SelectField
        form={form}
        name="transport"
        label="Transport"
        options={[
          { value: McpServersTransportEnum.Stdio, label: "stdio — run a local command" },
          { value: McpServersTransportEnum.Http, label: "http — connect to a URL" },
        ]}
      />

      <form.Subscribe selector={(state) => state.values.transport}>
        {(transport) =>
          transport === McpServersTransportEnum.Stdio ? (
            <>
              <InputField
                form={form}
                name="command"
                label="Command"
                required
                className="font-mono"
                placeholder="npx"
                validators={{
                  onChange: ({ value }) =>
                    value.trim() ? undefined : "A stdio server is started by a command.",
                }}
              />
              <InputField
                form={form}
                name="args"
                label="Args"
                className="font-mono text-xs"
                placeholder='["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]'
              />
              <InputField
                form={form}
                name="env"
                label="Env"
                description="Merged over the server's own environment, so the child still inherits PATH."
                className="font-mono text-xs"
                placeholder='{ "API_TOKEN": "…" }'
              />
            </>
          ) : (
            <>
              <InputField
                form={form}
                name="url"
                label="URL"
                required
                className="font-mono"
                placeholder="https://example.com/mcp"
                validators={{
                  onChange: ({ value }) =>
                    value.trim() ? undefined : "An http server needs a url to reach.",
                }}
              />
              <InputField
                form={form}
                name="headers"
                label="Headers"
                className="font-mono text-xs"
                placeholder='{ "Authorization": "Bearer …" }'
              />
            </>
          )
        }
      </form.Subscribe>

      <SwitchField
        form={form}
        name="enabled"
        label="Enabled"
        description="A disabled server stays configured but offers no tools."
        className="rounded-md border p-3"
      />

      {probe ? (
        <ProbeResult
          probe={probe}
          className={cn("rounded-md border p-3", !probe.ok && "border-destructive")}
        />
      ) : null}
    </FormDialog>
  );
}
