import { useSyncExternalStore } from "react";

/**
 * Which board the app is looking at, kept outside the router.
 *
 * Every page but Settings is about one project, and threading it through the URL would put an
 * id in five route paths for something nobody navigates between — you pick a project once and
 * work in it. It is kept in `localStorage` so a reload lands where you left off, and in a store
 * rather than a context so the picker in the sidebar and the pages under it stay in step
 * without the whole tree re-rendering through a provider.
 */
const KEY = "kanban-server.project";

let current = read();
const listeners = new Set<() => void>();

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    // Storage can be denied outright — private windows, blocked site data. A session that
    // forgets the selection on reload is still a working app.
    return "";
  }
}

export function selectProject(id: string) {
  if (id === current) return;
  current = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // As above: the selection still holds for this tab.
  }
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The selected project id, or "" before one has been picked. */
export const useProjectId = () => useSyncExternalStore(subscribe, () => current);
