import { useQuery } from "@tanstack/react-query";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Archive,
  Bot,
  History,
  KanbanSquare,
  ListChecks,
  MessageSquare,
  Notebook,
  Plug,
  SlidersHorizontal,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  const rows = projects.data?.projects ?? [];
  if (rows.length && !rows.some((project) => project.id === projectId)) {
    selectProject(rows[0].id);
  }

  return (
    <div className="px-2 pb-3">
      <Select value={projectId} onValueChange={selectProject} disabled={!rows.length}>
        <SelectTrigger className="w-full">
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
      <aside className="flex w-56 shrink-0 flex-col border-r bg-sidebar">
        <div className="flex items-center gap-2 px-4 py-4 text-sm font-semibold tracking-tight">
          <KanbanSquare className="size-4" />
          kanban-server
        </div>
        <ProjectPicker />
        <nav className="flex flex-col gap-1 px-2">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                (to === "/" ? pathname === "/" : pathname.startsWith(to)) &&
                  "bg-accent font-medium text-accent-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}

/** Shared page frame: a titled header over a scrolling, width-capped column. */
export function Page({
  title,
  description,
  actions,
  wide,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** For pages that go sideways — the board is as wide as the lanes it has. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-4 border-b px-6 py-4">
        <div>
          <h1 className="text-base font-semibold">{title}</h1>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className={cn("mx-auto flex flex-col gap-4", wide ? "max-w-none" : "max-w-3xl")}>
          {children}
        </div>
      </div>
    </div>
  );
}
