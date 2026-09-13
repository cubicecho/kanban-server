import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CardArtifactsDocument } from "@/__generated__/graphql";
import { ArtifactRow } from "@/components/artifact-row";
import { request } from "@/lib/gql";

/**
 * What this card's work left behind: files, pages, objects, wherever they went.
 *
 * Read-only on purpose. A row says a run wrote something, or that somebody recorded that it did;
 * editing that afterwards would make it an opinion rather than an account, the same argument a
 * report and the ledger are not editable on.
 */
export function CardArtifacts({ cardId, running }: { cardId: string; running?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const artifacts = useQuery({
    queryKey: ["card-artifacts", cardId],
    queryFn: () => request(CardArtifactsDocument, { cardId }),
    // Rows are written as the run makes them, so a card being worked fills in while it is watched.
    refetchInterval: running ? 3000 : false,
  });

  const rows = artifacts.data?.artifacts ?? [];
  if (artifacts.isPending) {
    return <p className="text-sm text-muted-foreground">Reading what this card made…</p>;
  }
  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing recorded yet. A run records what it writes through its tools, and anything it says
        it made; an outside client can record one with <code>record_artifact</code>.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((artifact) => (
        <ArtifactRow
          key={artifact.id}
          artifact={artifact}
          open={open === artifact.id}
          onOpenChange={(next) => setOpen(next ? artifact.id : null)}
        />
      ))}
    </div>
  );
}
