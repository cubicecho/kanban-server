import { useQuery } from "@tanstack/react-query";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Archive,
  Bot,
  FolderOpen,
  History,
  KanbanSquare,
  ListChecks,
  MessageSquare,
  Notebook,
  Plug,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProjectsDocument } from "@/gql/graphql";
import { request } from "@/lib/gql";
import { selectProject, useProjectId } from "@/lib/project";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "New task", icon: MessageSquare },
  { to: "/board", label: "Board", icon: KanbanSquare },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/roles", label: "Roles", icon: Notebook },
  { to: "/runs", label: "Runs", icon: History },
  { to: "/archive", label: "Archive", icon: Archive },
  { to: "/servers", label: "MCP servers", icon: Plug },
  { to: "/settings", label: "Settings", icon: SlidersHorizontal },
] as const;

/**
 * The picker every other page reads. It lives in the frame rather than on each page because
 * the project is not what you are doing, it is where you are doing it — and switching it
 * should not navigate.
 *
 * The first project is selected automatically when nothing is, which is what makes a server
 * with one board need no selection at all.
 */
function ProjectPicker() {
  const projectId = useProjectId();
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => request(ProjectsDocument),
  });

  const rows = useMemo(() => projects.data?.projects ?? [], [projects.data]);
  // In an effect, not in the render body: `selectProject` writes `localStorage` and notifies
  // this very component's store, and React is entitled to object to a component updating a
  // store it is subscribed to while it renders.
  useEffect(() => {
    if (rows.length && !rows.some((project) => project.id === projectId)) {
      selectProject(rows[0].id);
    }
  }, [rows, projectId]);

  return (
    <div className="px-2 pb-3">
      <Select value={projectId} onValueChange={selectProject} disabled={!rows.length}>
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
        </SelectContent>
      </Select>
    </div>
  );
}

export function AppShell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* An icon rail under `lg` rather than a hamburger: nine destinations fit in 3.5rem, and
          a drawer would put a click in front of every one of them to save 10rem. */}
      <aside className="flex w-14 shrink-0 flex-col border-r bg-sidebar lg:w-56">
        <div className="flex items-center gap-2 px-4 py-4 text-sm font-semibold tracking-tight">
          <KanbanSquare className="size-4 shrink-0" />
          <span className="hidden lg:inline">kanban-server</span>
        </div>
        <ProjectPicker />
        <nav className="flex flex-col gap-1 px-2" aria-label="Sections">
          {NAV.map(({ to, label, icon: Icon }) => {
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
                    <span className="hidden lg:inline">{label}</span>
                    <span className="sr-only lg:hidden">{label}</span>
                  </Link>
                </TooltipTrigger>
                {/* Only where the label is not on screen to read. */}
                <TooltipContent side="right" className="lg:hidden">
                  {label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>
        <div className="mt-auto p-2">
          <ThemeToggle />
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}

/** Shared page frame: a titled header over a scrolling, width-capped column. */
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
