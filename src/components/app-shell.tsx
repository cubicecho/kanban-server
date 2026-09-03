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
  Plug,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { ProjectActions, useProjectActions } from "@/components/project-actions";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProjectsDocument } from "@/gql/graphql";
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
}: {
  label: string;
  items: readonly NavItem[];
  pathname: string;
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
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="hidden lg:inline">{text}</span>
                <span className="sr-only lg:hidden">{text}</span>
              </Link>
            </TooltipTrigger>
            {/* Only where the label is not on screen to read. */}
            <TooltipContent side="right" className="lg:hidden">
              {text}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}

// Radix refuses an empty item value, so the two things that are not a project carry sentinels.
const NEW = "__new__";
const EDIT = "__edit__";

/**
 * The picker every other page reads. It lives in the frame rather than on each page because
 * the project is not what you are doing, it is where you are doing it — and switching it
 * should not navigate.
 *
 * The first project is selected automatically when nothing is, which is what makes a server
 * with one board need no selection at all.
 *
 * Making and editing one are in the menu rather than beside it: on the rail there is no room
 * for a second control, and the list of projects is the natural place to reach the project you
 * are in. It is never disabled now — an empty picker reading "No projects yet" with nothing
 * behind it was an instruction with no way to follow it.
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

  const choose = (value: string) => {
    if (value === NEW) newProject();
    else if (value === EDIT) {
      if (current) editProject(current);
    } else selectProject(value);
  };

  return (
    <div className="px-2 pb-3">
      <Select value={projectId} onValueChange={choose}>
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
          {rows.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
          {rows.length ? <SelectSeparator /> : null}
          {current ? <SelectItem value={EDIT}>Project settings…</SelectItem> : null}
          <SelectItem value={NEW}>New project…</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function AppShell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

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
          <NavGroup label="Project" items={PROJECT_NAV} pathname={pathname} />
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
  crumb,
  description,
  actions,
  wide,
  children,
}: {
  title: string;
  /** Where this is — the project, on the pages whose rows all belong to one. */
  crumb?: string;
  description?: string;
  actions?: React.ReactNode;
  /** For pages that go sideways — the board is as wide as the lanes it has. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  // The tab said "kanban-server" on all nine pages, which is no help at all to somebody with
  // three of them open. Here rather than in each route: one heading, one title, no drift.
  useEffect(() => {
    document.title = crumb ? `${title} · ${crumb} · kanban` : `${title} · kanban`;
  }, [title, crumb]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Wrapping, because the actions on these headers are a Spend readout and two buttons,
          and below about 1100px they were squeezing the title rather than moving under it. */}
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-6 py-4">
        <div className="min-w-0">
          {crumb ? <p className="text-xs text-muted-foreground">{crumb}</p> : null}
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className={cn("mx-auto flex flex-col gap-4", wide ? "max-w-none" : "max-w-3xl")}>
          {children}
        </div>
      </div>
    </div>
  );
}
