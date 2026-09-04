import { useQuery } from "@tanstack/react-query";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Archive,
  Bot,
  FolderOpen,
  History,
  KanbanSquare,
  ListChecks,
  type LucideIcon,
  MessageSquare,
  Notebook,
  Pencil,
  Plug,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { ProjectsDocument, type ProjectsQuery } from "@/__generated__/graphql";
import { ActionButton } from "@/components/action-button";
import { StickyHeaderContentFooter } from "@/components/header-content-footer";
import { LiveDot } from "@/components/live-dot";
import { PageHeader } from "@/components/page-header";
import { ProjectActions, useProjectActions } from "@/components/project-actions";
import { ProjectBar, useRunningCount } from "@/components/project-bar";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { request } from "@/lib/gql";
import { selectProject, useProjectId } from "@/lib/project";
import { cn } from "@/lib/utils";

/**
 * The six pages that are about the project in the picker above them.
 *
 * Split from the four that are about the server because the sidebar was nine flat links in
 * which "Archive" and "Agents" sat one above the other, looking like the same kind of thing —
 * one is this project's discarded cards and the other is every model endpoint on the box. The
 * heading over each group says which the page you are about to open belongs to, and switching
 * projects changes what the first group shows and nothing in the second.
 *
 * Status sits second because it is the answer to the question the other pages are the long way
 * round to: you say what you want on the first page, and the next thing you want to know is
 * whether it is going anywhere.
 */
const PROJECT_NAV = [
  { to: "/", label: "New task", icon: MessageSquare },
  { to: "/status", label: "Status", icon: Activity },
  { to: "/board", label: "Board", icon: KanbanSquare },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/runs", label: "Runs", icon: History },
  { to: "/archive", label: "Archive", icon: Archive },
] as const;

/** The server's own furniture: the same on every project, and rarely touched twice. */
const SERVER_NAV = [
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/roles", label: "Roles", icon: Notebook },
  { to: "/servers", label: "MCP servers", icon: Plug },
  { to: "/settings", label: "Settings", icon: SlidersHorizontal },
] as const;

type NavItem = { to: string; label: string; icon: LucideIcon };

function NavGroup({
  label,
  items,
  pathname,
  badges,
}: {
  label: string;
  items: readonly NavItem[];
  pathname: string;
  /** How many things are happening behind a destination, by `to`. Zero draws nothing. */
  badges?: Record<string, number>;
}) {
  return (
    <nav className="flex flex-col gap-1 px-2" aria-label={label}>
      {/* On the rail there is no room for the word, and the border between the groups is what
          carries the division instead. */}
      <p className="px-3 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase max-lg:hidden">
        {label}
      </p>
      {items.map(({ to, label: text, icon: Icon }) => {
        const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
        const busy = badges?.[to] ?? 0;
        return (
          <Tooltip key={to}>
            <TooltipTrigger asChild>
              <Link
                to={to}
                // The active page was said in weight and background alone, which is
                // nothing at all to a screen reader reading a list of nine links.
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:justify-start",
                  active && "bg-accent font-medium text-accent-foreground",
                )}
              >
                <span className="relative shrink-0">
                  <Icon className="size-4" aria-hidden />
                  {/* On the rail the count has nowhere to go, so it becomes a dot on the icon
                      and the number is said in the tooltip and to a screen reader instead. */}
                  {busy ? <LiveDot className="absolute -top-0.5 -right-0.5 lg:hidden" /> : null}
                </span>
                <span className="hidden lg:inline">{text}</span>
                <span className="sr-only lg:hidden">{text}</span>
                {busy ? (
                  <>
                    <span className="ml-auto hidden items-center gap-1.5 text-xs text-status-running lg:inline-flex">
                      <LiveDot className="size-1.5" />
                      {busy}
                    </span>
                    <span className="sr-only">, {busy} running</span>
                  </>
                ) : null}
              </Link>
            </TooltipTrigger>
            {/* Only where the label is not on screen to read. */}
            <TooltipContent side="right" className="lg:hidden">
              {busy ? `${text} — ${busy} running` : text}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}

/**
 * The picker every other page reads. It lives in the frame rather than on each page because
 * the project is not what you are doing, it is where you are doing it — and switching it
 * should not navigate.
 *
 * The first project is selected automatically when nothing is, which is what makes a server
 * with one board need no selection at all.
 *
 * Making one and editing one are buttons above the picker rather than rows inside it. They
 * were sentinel `SelectItem`s — "New project…" and "Project settings…" sitting under a
 * separator among the projects themselves — which put two commands in a list of places: the
 * menu answered "which project?" and "do what to it?" at once, and picking either one read as
 * a selection right up until a dialog opened instead. A command belongs to a button.
 *
 * The picker is never disabled — an empty one reading "No projects yet" with nothing behind
 * it was an instruction with no way to follow it, and the button beside it is now the way.
 */
function ProjectPicker() {
  const projectId = useProjectId();
  const { newProject, editProject } = useProjectActions();
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => request(ProjectsDocument),
  });

  const rows = useMemo(() => projects.data?.projects ?? [], [projects.data]);
  const current = rows.find((project) => project.id === projectId);
  // In an effect, not in the render body: `selectProject` writes `localStorage` and notifies
  // this very component's store, and React is entitled to object to a component updating a
  // store it is subscribed to while it renders.
  useEffect(() => {
    if (rows.length && !rows.some((project) => project.id === projectId)) {
      selectProject(rows[0].id);
    }
  }, [rows, projectId]);

  return (
    <div className="flex flex-col gap-1 px-2 pb-3">
      {/* On the rail the word has nowhere to go and the buttons stack under the logo instead,
          which is the same trade the nav groups make with their own headings. */}
      <div className="flex items-center gap-1 max-lg:flex-col lg:justify-between">
        <p className="px-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase max-lg:hidden">
          Project
        </p>
        <div className="flex items-center gap-1 max-lg:flex-col">
          <ActionButton
            variant="ghost"
            size="icon"
            className="size-7"
            label="New project"
            side="right"
            onClick={newProject}
          >
            <Plus className="size-4" aria-hidden />
          </ActionButton>
          <ActionButton
            variant="ghost"
            size="icon"
            className="size-7"
            label={current ? `Settings for ${current.name}` : "Project settings"}
            hint={current ? "Project settings" : "There is no project to edit yet"}
            side="right"
            disabled={!current}
            onClick={() => current && editProject(current)}
          >
            <Pencil className="size-4" aria-hidden />
          </ActionButton>
        </div>
      </div>
      <Select value={projectId} onValueChange={selectProject}>
        {/* On the rail the name has nowhere to go, so the trigger becomes the folder icon
            alone — switching projects is not something to lose at 900px. */}
        <SelectTrigger
          aria-label="Project"
          className="w-full justify-center px-0 max-lg:border-0 lg:justify-between lg:px-2.5 max-lg:[&>svg]:hidden max-lg:[&>[data-slot=select-value]]:hidden"
        >
          <FolderOpen className="size-4 shrink-0 lg:hidden" aria-hidden />
          <SelectValue placeholder={rows.length ? "Pick a project" : "No projects yet"} />
        </SelectTrigger>
        <SelectContent>
          {/* With the commands gone the menu can be empty, and an empty popover says nothing
              about where the projects went. */}
          {rows.length ? (
            rows.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))
          ) : (
            <p className="px-2 py-1.5 text-muted-foreground text-sm">
              No projects yet — make one above.
            </p>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

export function AppShell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const running = useRunningCount();

  return (
    <ProjectActions>
      <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
        {/* An icon rail under `lg` rather than a hamburger: ten destinations fit in 3.5rem, and
            a drawer would put a click in front of every one of them to save 10rem. */}
        <aside className="flex w-14 shrink-0 flex-col overflow-y-auto border-r bg-sidebar lg:w-56">
          <div className="flex items-center gap-2 px-4 py-4 text-sm font-semibold tracking-tight">
            <KanbanSquare className="size-4 shrink-0" />
            <span className="hidden lg:inline">kanban-server</span>
          </div>
          <ProjectPicker />
          <NavGroup
            label="Project"
            items={PROJECT_NAV}
            pathname={pathname}
            badges={{ "/runs": running }}
          />
          {/* Held at the bottom: the server's settings are the same wherever you are, and a
              group that moves up and down as the one above it grows is a group you hunt for. */}
          <div className="mt-auto border-t pt-1 pb-2">
            <NavGroup label="Server" items={SERVER_NAV} pathname={pathname} />
            <div className="px-2 pt-2">
              <ThemeToggle />
            </div>
          </div>
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">
          <Outlet />
        </main>
      </div>
    </ProjectActions>
  );
}

/**
 * The project a page is about, for the pages that show project-scoped rows under a heading
 * that says only "Runs". It reads the picker's own query, so it is a cache hit.
 */
export function useCurrentProject() {
  const projectId = useProjectId();
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => request(ProjectsDocument) });
  return projects.data?.projects.find((row) => row.id === projectId);
}

export function Page({
  title,
  project,
  description,
  actions,
  wide,
  children,
}: {
  title: string;
  /**
   * The board this page is about, on the six that are about one. It names the page in the
   * breadcrumb and the tab, and it is what puts the strip of project facts under the heading —
   * a page passing it is a page from which the board can be paused.
   */
  project?: ProjectsQuery["projects"][number];
  description?: string;
  actions?: React.ReactNode;
  /** For pages that go sideways — the board is as wide as the lanes it has. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  // The tab said "kanban-server" on all nine pages, which is no help at all to somebody with
  // three of them open. Here rather than in each route: one heading, one title, no drift.
  const crumb = project?.name;
  useEffect(() => {
    document.title = crumb ? `${title} · ${crumb} · kanban` : `${title} · kanban`;
  }, [title, crumb]);

  return (
    <StickyHeaderContentFooter
      // `width="full"`, and the reading column stays on the body below: the chrome on these
      // pages is full-bleed bars — the header's rule and the project strip both run to the pane
      // edge — and a capped header would draw two of them ending in mid-air. The seam the
      // chassis owns is the inset, and `px-6` is this app's.
      header={
        <>
          <PageHeader
            title={title}
            description={description}
            action={actions}
            breadcrumbs={crumb ? <p className="text-muted-foreground text-xs">{crumb}</p> : null}
            className="px-6"
          />
          {/* Outside the scroller with the heading, so the way to stop a board is on screen at
              the bottom of a long list of cards as much as at the top. */}
          {project ? <ProjectBar project={project} /> : null}
        </>
      }
      contentClassName="p-6"
      content={
        <div className={cn("mx-auto flex flex-col gap-4", wide ? "max-w-none" : "max-w-3xl")}>
          {children}
        </div>
      }
    />
  );
}
