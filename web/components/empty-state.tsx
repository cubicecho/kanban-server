import { FolderOpen, type LucideIcon, Plus } from "lucide-react";
import { useProjectActions } from "@/components/project-actions";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/**
 * What a page says when it has nothing to show.
 *
 * There were three qualities of this in the app at once — an illustrated card on MCP servers,
 * one line of muted text on Tasks, and nothing whatsoever on Roles — and an empty page that
 * says nothing is indistinguishable from one that has not loaded. Where there is something to
 * do about it, `action` is the button that does it: the four "Pick a project first" dead ends
 * were paired with a *disabled* picker reading "No projects yet", which left nowhere to go.
 *
 * The drawing is shadcn's `empty` now, which four projects had each re-derived as a dashed card
 * of centred muted text before anybody ran `shadcn add empty`. What is left here is the voice:
 * an icon that is not optional, one title, one line, and the thing to do about it.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Empty className="border border-dashed py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}

/**
 * The four project-scoped pages with no project picked said "Pick a project first" over a
 * *disabled* picker reading "No projects yet", which is a instruction you cannot follow.
 */
export function NoProject({ what }: { what: string }) {
  const { newProject } = useProjectActions();
  return (
    <EmptyState
      icon={FolderOpen}
      title="No project selected"
      description={`${what} belongs to a project. Make one — it arrives with a board already wired up.`}
      action={
        <Button onClick={newProject}>
          <Plus className="size-4" aria-hidden />
          New project
        </Button>
      }
    />
  );
}
