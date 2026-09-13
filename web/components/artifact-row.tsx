import type { ReactNode } from "react";
import {
  type ArtifactFieldsFragment,
  ArtifactsActionEnum,
  ArtifactsSourceEnum,
} from "@/__generated__/graphql";
import { DisclosureRow } from "@/components/disclosure-row";
import { MetaLine } from "@/components/meta-line";
import { StatusBadge, type StatusTone } from "@/components/status-badge";

/** How the board came to know about it. Only a declaration is the agent saying so itself. */
const SOURCE: Record<ArtifactsSourceEnum, { tone: StatusTone; label: string; hint: string }> = {
  [ArtifactsSourceEnum.Declared]: {
    tone: "settled",
    label: "declared",
    hint: "The agent said it made this.",
  },
  [ArtifactsSourceEnum.Detected]: {
    tone: "plain",
    label: "detected",
    hint: "Read off a tool call that looked like a write; nobody said so.",
  },
  [ArtifactsSourceEnum.Client]: {
    tone: "plain",
    label: "client",
    hint: "Recorded from outside a run, through the API.",
  },
};

/** A deletion is the one action worth a colour: the thing this row names may no longer be there. */
const ACTION_TONE: Record<ArtifactsActionEnum, StatusTone> = {
  [ArtifactsActionEnum.Created]: "plain",
  [ArtifactsActionEnum.Updated]: "plain",
  [ArtifactsActionEnum.Moved]: "plain",
  [ArtifactsActionEnum.Deleted]: "attention",
};

/** The last segment of a path or URL, which is what a person calls a file. */
export const artifactName = (artifact: Pick<ArtifactFieldsFragment, "title" | "location">) =>
  artifact.title ||
  artifact.location
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "")
    .split(/[/\\]/)
    .pop() ||
  artifact.location;

export const bytes = (size: number | null | undefined): string | null => {
  if (size === null || size === undefined) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} kB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

/** How it was stored, as one line: the server a person would recognise, how it is reached, the call. */
export const storedVia = (artifact: ArtifactFieldsFragment): (string | null)[] => [
  artifact.serverLabel || artifact.serverSlug || null,
  artifact.transport || null,
  artifact.tool || null,
];

/**
 * One thing the work left behind.
 *
 * A record and not a copy: what is here is where it went and how it got there, and the location
 * is drawn whole and selectable because that is the part anybody will want to take elsewhere —
 * a NAS path is no use as a link, and not every location is one.
 */
export function ArtifactRow({
  artifact,
  open,
  onOpenChange,
  extraMeta = [],
  extraBadges,
  extraContent,
}: {
  artifact: ArtifactFieldsFragment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extraMeta?: (string | null)[];
  extraBadges?: ReactNode;
  extraContent?: ReactNode;
}) {
  const source = SOURCE[artifact.source] ?? SOURCE[ArtifactsSourceEnum.Detected];
  return (
    <DisclosureRow
      open={open}
      onOpenChange={onOpenChange}
      badges={
        <>
          <span title={source.hint}>
            <StatusBadge tone={source.tone}>{source.label}</StatusBadge>
          </span>
          <StatusBadge tone={ACTION_TONE[artifact.action] ?? "plain"}>
            {artifact.action}
          </StatusBadge>
          {extraBadges}
        </>
      }
      title={artifactName(artifact)}
      meta={
        <MetaLine
          className="shrink-0"
          parts={[
            ...storedVia(artifact),
            bytes(artifact.sizeBytes),
            ...extraMeta,
            new Date(artifact.updatedAt).toLocaleString(),
          ]}
        />
      }
      description={artifact.description || undefined}
      content={
        <div className="flex flex-col gap-2 text-sm">
          <pre className="overflow-x-auto rounded-md bg-muted/30 p-2 text-xs whitespace-pre-wrap wrap-anywhere select-all">
            {artifact.location}
          </pre>
          {artifact.description ? <p>{artifact.description}</p> : null}
          <MetaLine
            parts={[
              artifact.mediaType,
              artifact.serverSlug ? `slug ${artifact.serverSlug}` : null,
              artifact.runId ? `run ${artifact.runId}` : "recorded outside a run",
              `first seen ${new Date(artifact.createdAt).toLocaleString()}`,
            ]}
          />
          {extraContent}
        </div>
      }
    />
  );
}
