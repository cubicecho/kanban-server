import { and, eq, isNull } from "drizzle-orm";
import type { ArtifactDraft } from "../runner/artifacts.ts";
import { db } from "./client.ts";
import { type Artifact, artifacts, mcpServers } from "./schema.ts";

/**
 * The one writer of `artifacts`, as `history.ts` is of the ledger: a run's sink and the
 * `recordArtifact` mutation both come through here, so the merge rules below hold whichever
 * door a record arrived by.
 */

export interface ArtifactOwner {
  projectId: string;
  cardId: string;
  /** Null for an outside client's, which has no run behind it. */
  runId: string | null;
}

/**
 * Writes one artifact, or folds it into the row it repeats, and answers with the row.
 *
 * One run writing the same file twice — a draft and then its edit, or a write the runner
 * noticed and then the agent declaring it — is one thing it made, so within a run a location is
 * one row: the later write moves `action` and the size on, and a declaration over a detection
 * fills in what only the agent could say and takes over the `source`. Two slugs only disagree
 * when both are given: an agent declaring a file seldom names the server it wrote it through.
 *
 * Across runs they stay apart. A file rewritten on every pass of a Doing↔Review loop is three
 * things that happened, and the board page is where they are grouped back into one.
 */
export async function recordArtifact(
  draft: ArtifactDraft,
  owner: ArtifactOwner,
): Promise<Artifact> {
  const server = draft.serverSlug
    ? (
        await db
          .select({ id: mcpServers.id, label: mcpServers.label, transport: mcpServers.transport })
          .from(mcpServers)
          .where(eq(mcpServers.slug, draft.serverSlug))
          .limit(1)
      )[0]
    : undefined;

  const same = await db
    .select()
    .from(artifacts)
    .where(
      and(
        eq(artifacts.cardId, owner.cardId),
        owner.runId ? eq(artifacts.runId, owner.runId) : isNull(artifacts.runId),
        eq(artifacts.location, draft.location),
      ),
    );
  const existing = same.find(
    (row) => !row.serverSlug || !draft.serverSlug || row.serverSlug === draft.serverSlug,
  );

  const described = {
    ...(draft.title ? { title: draft.title } : {}),
    ...(draft.description ? { description: draft.description } : {}),
    ...(draft.mediaType ? { mediaType: draft.mediaType } : {}),
  };
  const via = draft.serverSlug
    ? {
        serverSlug: draft.serverSlug,
        serverId: server?.id ?? null,
        serverLabel: server?.label ?? "",
        transport: server?.transport ?? "",
      }
    : {};

  if (existing) {
    // A detection repeats a write; a declaration only describes one, and must not turn an
    // `updated` back into `created` or throw away the size the write was seen with.
    const wrote = draft.source === "detected";
    const [updated] = await db
      .update(artifacts)
      .set({
        ...described,
        ...(existing.serverSlug ? {} : via),
        ...(draft.tool && !existing.tool ? { tool: draft.tool } : {}),
        ...(wrote
          ? { action: draft.action, sizeBytes: draft.sizeBytes ?? existing.sizeBytes }
          : { source: draft.source }),
      })
      .where(eq(artifacts.id, existing.id))
      .returning();
    return updated;
  }

  const [written] = await db
    .insert(artifacts)
    .values({
      projectId: owner.projectId,
      cardId: owner.cardId,
      runId: owner.runId,
      location: draft.location,
      action: draft.action,
      source: draft.source,
      tool: draft.tool,
      sizeBytes: draft.sizeBytes ?? null,
      mediaType: null,
      ...described,
      ...via,
    })
    .returning();
  return written;
}
