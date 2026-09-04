import { useSyncExternalStore } from "react";

/**
 * Light, dark, or whatever the machine says.
 *
 * The app shipped with `class="dark"` hardcoded on `<html>`, which made the thirty-four
 * light-mode tokens in `index.css` unreachable — and left the toaster, which asks the OS
 * directly, rendering light panels over a dark app on a light-configured machine. One store
 * now owns the answer and both read it.
 *
 * It is a store rather than a context for the same reason `lib/project.ts` is one: the
 * toggle in the sidebar and the toaster at the root of the tree are not near each other, and
 * neither is worth a provider re-rendering everything between them.
 */
const KEY = "kanban-server.theme";

export type Theme = "light" | "dark" | "system";

const isTheme = (value: string | null): value is Theme =>
  value === "light" || value === "dark" || value === "system";

let current = read();
const listeners = new Set<() => void>();

function read(): Theme {
  try {
    const stored = localStorage.getItem(KEY);
    return isTheme(stored) ? stored : "system";
  } catch {
    // Storage can be denied outright — private windows, blocked site data. Following the OS
    // is the right default anyway; it just will not be remembered.
    return "system";
  }
}

const prefersDark = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;

/** Which of the two we actually paint, once `system` has been asked. */
export const resolveTheme = (theme: Theme): "light" | "dark" =>
  theme === "system" ? (prefersDark() ? "dark" : "light") : theme;

function apply() {
  document.documentElement.classList.toggle("dark", resolveTheme(current) === "dark");
}

export function setTheme(theme: Theme) {
  if (theme === current) return;
  current = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // As above: the choice still holds for this tab.
  }
  apply();
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * Started once from `main.tsx`. The OS can change its mind while the app is open, and on
 * `system` that has to redraw — so the listener stays attached rather than being read once.
 */
export function startTheme() {
  apply();
  if (typeof matchMedia !== "function") return;
  const query = matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", () => {
    if (current !== "system") return;
    apply();
    for (const listener of listeners) listener();
  });
}

/** What the user chose — `system` stays `system`, because that is what the toggle shows. */
export const useTheme = () =>
  useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );

/** What is on the screen. The toaster needs this one: it has no `system` of its own worth using. */
export const useResolvedTheme = () =>
  useSyncExternalStore(
    subscribe,
    () => resolveTheme(current),
    () => "dark" as const,
  );
