import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Notebook, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/action-button";
import { Page } from "@/components/app-shell";
import { ConfirmButton } from "@/components/confirm-button";
import { EmptyState } from "@/components/empty-state";
import { QueryError } from "@/components/query-error";
import { RoleDialog } from "@/components/role-dialog";
import { RowSkeleton } from "@/components/row-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DeleteRoleDocument, RolesDocument, type RolesQuery } from "@/gql/graphql";
import { request } from "@/lib/gql";

type Role = RolesQuery["roles"][number];

const CONTRACT_LABEL: Record<string, string> = {
  work: "works the card",
  verdict: "judges the card",
  expand: "breaks the card up",
};

/**
 * The kinds of lane a board can be assembled out of.
 *
 * A role is a prompt and the shape of the answer it expects, shared by every lane of that kind on
 * every board — so editing one here changes them all, which is the point of a lane pointing at a
 * role rather than carrying a copy. Nothing on this page knows anything about a model.
 */
export function RolesRoute() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Role | null>(null);
  const [creating, setCreating] = useState(false);

  const roles = useQuery({ queryKey: ["roles"], queryFn: () => request(RolesDocument) });

  // The foreign key is `restrict`, so a kind a lane still is refuses to go and says so.
  const remove = useMutation({
    mutationFn: (id: string) => request(DeleteRoleDocument, { id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roles"] }),
    onError: () => toast.error("That role could not be deleted — a lane is still of this kind."),
  });

  const lanes = roles.data?.lanes ?? [];

  return (
    <Page
      title="Roles"
      description="A kind of lane: what happens to a card there, and what the agent is told. Write one for any station a board of yours wants."
      actions={
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          New role
        </Button>
      }
    >
      {roles.isError ? (
        <QueryError error={roles.error} onRetry={() => roles.refetch()} what="your roles" />
      ) : null}
      {roles.isPending ? <RowSkeleton rows={3} /> : null}
      {roles.data?.roles.length === 0 ? (
        <EmptyState
          icon={Notebook}
          title="No kinds of lane yet"
          description="A role is what a station does — work a card, judge it, or break it up. Every board on this server picks its lanes from this list."
          action={<Button onClick={() => setCreating(true)}>New role</Button>}
        />
      ) : null}

      {roles.data?.roles.map((role) => {
        const count = lanes.filter((lane) => lane.roleId === role.id).length;
        return (
          <Card key={role.id} className="gap-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{role.name}</span>
                  <Badge variant="outline">{CONTRACT_LABEL[role.contract] ?? role.contract}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {count} lane{count === 1 ? "" : "s"}
                  </span>
                </div>
                {role.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{role.description}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <ActionButton
                  variant="ghost"
                  size="icon"
                  label={`Edit ${role.name}`}
                  hint="Edit"
                  onClick={() => setEditing(role)}
                >
                  <Pencil className="size-4" aria-hidden />
                </ActionButton>
                <ConfirmButton
                  variant="ghost"
                  size="icon"
                  label={`Delete ${role.name}`}
                  hint="Delete"
                  title={`Delete the role "${role.name}"?`}
                  description={
                    count
                      ? `${count} lane${count === 1 ? " is" : "s are"} of this kind, on this and any other board. The role cannot be deleted while that is true.`
                      : "This kind of lane goes for every board on the server, not just this one."
                  }
                  onConfirm={() => remove.mutate(role.id)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </ConfirmButton>
              </div>
            </div>
            <p className="line-clamp-2 font-mono text-muted-foreground text-xs">
              {role.prompt || "no prompt — a lane of this kind is told nothing"}
            </p>
          </Card>
        );
      })}

      {creating || editing ? (
        <RoleDialog
          role={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      ) : null}
    </Page>
  );
}
