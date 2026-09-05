import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Notebook, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DeleteRoleDocument, RolesDocument, type RolesQuery } from "@/__generated__/graphql";
import { ActionButton } from "@/components/action-button";
import { Page } from "@/components/app-shell";
import { ConfirmButton } from "@/components/confirm-button";
import { EmptyState } from "@/components/empty-state";
import { QueryState } from "@/components/query-state";
import { RoleDialog } from "@/components/role-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { request } from "@/lib/gql";
import { nameList, plural } from "@/lib/text";

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
      <QueryState
        query={roles}
        what="your roles"
        rows={3}
        count={(roles.data?.roles ?? []).length}
        empty={
          <EmptyState
            icon={Notebook}
            title="No kinds of lane yet"
            description="A role is what a station does — work a card, judge it, or break it up. Every board on this server picks its lanes from this list."
            action={<Button onClick={() => setCreating(true)}>New role</Button>}
          />
        }
      />

      {roles.data?.roles.map((role) => {
        const of = lanes.filter((lane) => lane.roleId === role.id);
        const count = of.length;
        // The foreign key is `restrict`, so confirming a delete here could only ever fail.
        // Naming the lanes is the difference between a refusal and somewhere to go.
        const where = nameList(of.map((lane) => `${lane.name} on ${lane.project.name}`));
        return (
          <Item key={role.id} variant="outline" className="items-start">
            <ItemContent className="min-w-0">
              <ItemTitle className="flex-wrap">
                <span className="truncate">{role.name}</span>
                <Badge variant="outline">{CONTRACT_LABEL[role.contract] ?? role.contract}</Badge>
                <span className="font-normal text-muted-foreground text-xs">
                  {plural(count, "lane")}
                </span>
              </ItemTitle>
              {role.description ? (
                <p className="text-muted-foreground text-sm">{role.description}</p>
              ) : null}
              <ItemDescription className="font-mono text-xs">
                {role.prompt || "no prompt — a lane of this kind is told nothing"}
              </ItemDescription>
            </ItemContent>
            <ItemActions className="gap-1">
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
                disabled={count > 0}
                hint={count ? `Still in use by ${where}` : "Delete"}
                title={`Delete the role "${role.name}"?`}
                description="This kind of lane goes for every board on the server, not just this one."
                onConfirm={() => remove.mutate(role.id)}
              >
                <Trash2 className="size-4" aria-hidden />
              </ConfirmButton>
            </ItemActions>
          </Item>
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
