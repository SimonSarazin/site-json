import { Loader2, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import { AacCommunCard } from "./AacCommunCard";
import { AacCommunRow } from "./AacCommunRow";
import { AacDirectorySkeleton } from "./AacDirectorySkeleton";
import type { AacDisplayMode } from "../../schema";
import type { AacCommunCard as CommunCard } from "../../lib/parseAacAnswer";

interface AacDirectoryResultsProps {
  communs: CommunCard[];
  /** Grille de cartes ou liste de lignes. */
  display: AacDisplayMode;
  /** Colonnes de la grille. Sans effet en mode liste. */
  columns: number;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage?: boolean;
  error: Error | null;
  /** Sentinelle du scroll infini, posée après le dernier commun. */
  lastItemRef: (node: HTMLElement | null) => void;
  emptyText?: string;
}

/** Classes de grille figées : Tailwind ne peut pas générer `md:grid-cols-${n}`. */
const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
};

/**
 * Les résultats de l'annuaire, dans le mode demandé.
 *
 * Les états — erreur, chargement, vide, page suivante — sont traités ICI et une
 * seule fois : seule la disposition des communs change d'un mode à l'autre. Deux
 * composants frères les auraient dupliqués, et l'un des deux aurait fini par
 * diverger.
 */
export function AacDirectoryResults({
  communs,
  display,
  columns,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  error,
  lastItemRef,
  emptyText,
}: AacDirectoryResultsProps) {
  const t = useT("modules/aac");

  if (error) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-destructive/40 p-6 text-center text-sm text-destructive"
      >
        {String(t("directory.error"))}
      </p>
    );
  }

  if (isLoading) {
    return <AacDirectorySkeleton display={display} columns={columns} />;
  }

  if (communs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-12 text-center text-muted-foreground">
        <SearchX className="h-8 w-8" aria-hidden="true" />
        <p className="text-sm">{emptyText || String(t("directory.empty"))}</p>
      </div>
    );
  }

  return (
    <>
      {display === "list" ? (
        <div className="space-y-3">
          {communs.map((commun) => (
            <AacCommunRow key={commun.id} commun={commun} />
          ))}
        </div>
      ) : (
        <div className={cn("grid gap-6", GRID_COLS[columns] ?? GRID_COLS[3])}>
          {communs.map((commun) => (
            <AacCommunCard key={commun.id} commun={commun} />
          ))}
        </div>
      )}

      {hasNextPage ? <div ref={lastItemRef} className="h-12" aria-hidden="true" /> : null}

      {isFetchingNextPage ? (
        <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {String(t("directory.loading"))}
        </p>
      ) : null}
    </>
  );
}

export default AacDirectoryResults;
