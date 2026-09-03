import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plug, PlugZap, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/action-button";
import { Page } from "@/components/app-shell";
import { ConfirmButton } from "@/components/confirm-button";
import { EmptyState } from "@/components/empty-state";
import { McpDialog } from "@/components/mcp-dialog";
import { ProbeResult } from "@/components/probe-result";
import { QueryError } from "@/components/query-error";
import { RowSkeleton } from "@/components/row-skeleton";
import { toolCount } from "@/components/tool-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DeleteMcpServerDocument,
  type McpProbe,
  McpServersDocument,
  type McpServersQuery,
  ReconnectMcpDocument,
  TestMcpServerDocument,
  UpdateMcpServerDocument,
} from "@/gql/graphql";
import { request } from "@/lib/gql";
import { toConnection } from "@/lib/mcp-config";

type McpServer = McpServersQuery["mcpServers"][number];

export function McpRoute() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<McpServer | null>(null);
  const [creating, setCreating] = useState(false);
  /** The last test result per server, keyed by id — a test is about one row, not the page. */
  const [probes, setProbes] = useState<Record<string, McpProbe>>({});

  // A stdio server takes a second or two to start, so its status arrives after the row does.
  const servers = useQuery({
    queryKey: ["mcp"],
    queryFn: () => request(McpServersDocument),
    refetchInterval: 5000,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["mcp"] });

  const reconnect = useMutation({
    mutationFn: () => request(ReconnectMcpDocument),
    onSuccess: () => {
      toast.success("Reconnecting");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      request(UpdateMcpServerDocument, { id, set: { enabled } }),
    // The write reconnects the pool, so the status this row shows is a beat behind the switch.
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  const test = useMutation({
    mutationFn: async (server: McpServer) => {
      const { testMcpServer } = await request(TestMcpServerDocument, {
        config: toConnection(server),
      });
      return { id: server.id, probe: testMcpServer };
    },
    onSuccess: ({ id, probe }) => setProbes((current) => ({ ...current, [id]: probe })),
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => request(DeleteMcpServerDocument, { id }),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  const statusOf = (id: string) => servers.data?.mcpStatus.find((entry) => entry.id === id);

  return (
    <Page
      title="MCP servers"
      description="The tools agents can be given, named slug__tool-name."
      actions={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => reconnect.mutate()} disabled={reconnect.isPending}>
            <RefreshCw className="size-4" />
            Reconnect all
          </Button>
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            New server
          </Button>
        </div>
      }
    >
      {servers.isError ? (
        <QueryError error={servers.error} onRetry={() => servers.refetch()} what="your servers" />
      ) : null}
      {servers.isPending ? <RowSkeleton rows={2} /> : null}
      {servers.data?.mcpServers.length === 0 ? (
        <EmptyState
          icon={Plug}
          title="No servers yet"
          description="An MCP server is where an agent's tools come from. Without one an agent can think, but not act."
          action={<Button onClick={() => setCreating(true)}>New server</Button>}
        />
      ) : null}

      {servers.data?.mcpServers.map((server) => {
        const status = statusOf(server.id);
        const tools = status?.tools ?? [];
        const probe = probes[server.id];
        return (
          <Card key={server.id} className="gap-3 p-4">
            <div className="flex items-center gap-3">
              <div className={`min-w-0 flex-1 ${server.enabled ? "" : "opacity-50"}`}>
                <div className="flex items-center gap-2">
                  <span className="truncate font-mono text-sm font-medium">{server.slug}</span>
                  <Badge variant="outline">{server.transport}</Badge>
                  <Badge variant={status?.status === "ready" ? "secondary" : "outline"}>
                    {status?.status ?? "unknown"}
                  </Badge>
                  {tools.length ? (
                    <span className="text-xs text-muted-foreground">{toolCount(tools.length)}</span>
                  ) : null}
                </div>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {server.transport === "stdio"
                    ? [server.command, ...(toConnection(server).args ?? [])].join(" ")
                    : server.url}
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Switch
                    checked={server.enabled}
                    onCheckedChange={(enabled) => toggle.mutate({ id: server.id, enabled })}
                    // A switch that says "Enable" while it is on names the state rather than
                    // the action, which is the one thing a toggle must not do.
                    aria-label={`${server.enabled ? "Disable" : "Enable"} ${server.slug}`}
                  />
                </TooltipTrigger>
                <TooltipContent>{server.enabled ? "Disable" : "Enable"}</TooltipContent>
              </Tooltip>
              <ActionButton
                variant="ghost"
                size="icon"
                label={`Test the connection to ${server.slug}`}
                hint="Test connection"
                onClick={() => test.mutate(server)}
                disabled={test.isPending && test.variables?.id === server.id}
              >
                <PlugZap className="size-4" aria-hidden />
              </ActionButton>
              <ActionButton
                variant="ghost"
                size="icon"
                label={`Edit ${server.slug}`}
                hint="Edit"
                onClick={() => setEditing(server)}
              >
                <Pencil className="size-4" aria-hidden />
              </ActionButton>
              <ConfirmButton
                variant="ghost"
                size="icon"
                label={`Delete ${server.slug}`}
                hint="Delete"
                title={`Delete the server "${server.slug}"?`}
                description="Every agent given these tools loses them, on every board on this server. The tools themselves are wherever they were — this is only the connection to them."
                onConfirm={() => remove.mutate(server.id)}
              >
                <Trash2 className="size-4" aria-hidden />
              </ConfirmButton>
            </div>

            {status?.error ? (
              <p className="whitespace-pre-wrap font-mono text-xs text-destructive">
                {status.error}
              </p>
            ) : null}

            {probe ? <ProbeResult probe={probe} className="border-t pt-3" /> : null}
          </Card>
        );
      })}

      {creating ? (
        <McpDialog onClose={() => setCreating(false)} onSaved={refresh} />
      ) : editing ? (
        <McpDialog server={editing} onClose={() => setEditing(null)} onSaved={refresh} />
      ) : null}
    </Page>
  );
}
