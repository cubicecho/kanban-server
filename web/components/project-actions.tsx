import { createContext, useContext, useMemo, useState } from "react";
import type { ProjectsQuery } from "@/__generated__/graphql";
import { ProjectDialog } from "@/components/project-dialog";

type Project = ProjectsQuery["projects"][number];

interface Actions {
  /** Open the dialog on a new project. */
  newProject: () => void;
  /** Open the dialog on one that exists. */
  editProject: (project: Project) => void;
}

const Context = createContext<Actions | null>(null);

/**
 * Making and editing a project, from wherever you happen to be.
 *
 * Both used to live in the header of the New task page alone, which is the one page that is not
 * about a project you already have: to change a board's name, its context or whether it runs
 * itself, you left the board. The picker in the frame is where the project is chosen, so it is
 * where the project is managed, and every "there is no project" dead end can now offer the
 * button that ends it rather than a link somewhere else.
 */
export function useProjectActions() {
  const actions = useContext(Context);
  if (!actions) throw new Error("useProjectActions is only available inside the app shell.");
  return actions;
}

export function ProjectActions({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<{ project?: Project } | null>(null);
  const actions = useMemo<Actions>(
    () => ({
      newProject: () => setOpen({}),
      editProject: (project: Project) => setOpen({ project }),
    }),
    [],
  );

  return (
    <Context.Provider value={actions}>
      {children}
      {open ? <ProjectDialog project={open.project} onClose={() => setOpen(null)} /> : null}
    </Context.Provider>
  );
}
