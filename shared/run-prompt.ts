/**
 * What a run was started with: the system message and the first user message, exactly as the
 * model was sent them — the lane's layers, and the card's prompt with every hook's `<context>`
 * block ahead of it.
 *
 * Here rather than in `server/` because the web reads it off `runs.prompt` and off the run event
 * that carries it live, and both have to agree on the shape.
 */
export interface RunPrompt {
  system: string;
  user: string;
}

/** The run event's name. Its text is the prompt as JSON. */
export const PROMPT_EVENT = "prompt";

/** A stored or streamed prompt, or null for a run from before there was one, or garbage. */
export const readRunPrompt = (value: unknown): RunPrompt | null => {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const { system, user } = parsed as Record<string, unknown>;
  return typeof system === "string" && typeof user === "string" ? { system, user } : null;
};
