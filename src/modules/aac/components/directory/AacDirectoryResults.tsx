import { Loader2, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
  /**
   * Relance le chargement après un échec. C'est l'appelant qui sait QUOI
   * relancer — la page suivante ou tout le listing — d'après l'état de sa
   * requête ; ici on ne fait qu'offrir le bouton. Sans lui, l'erreur est
   * annoncée sans reprise.
   */
  onRetry?: () => void;
  /** Une reprise est en vol : le bouton se désactive le temps de la tentative. */
  isRetrying?: boolean;
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
 *
 * Une erreur ne remplace JAMAIS des communs déjà chargés. En React Query, l'échec
 * d'une page suivante — ou d'un refetch — pose `error` tout en CONSERVANT
 * `data` : le panneau bloquant n'a donc sa place que lorsqu'on n'a rien à
 * montrer ; sinon la liste reste, et la reprise se propose sous elle. Le partage
 * se fait sur `communs.length`, pas sur le type d'erreur : un refetch complet
 * (refocus d'onglet, remontage) remet le méta de page suivante à zéro pendant
 * que `error` persiste — baser le panneau là-dessus ferait disparaître la liste
 * à ce moment-là. Précédent : `ToolsCatalog`.
 */
export function AacDirectoryResults({
  communs,
  display,
  columns,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  error,
  onRetry,
  isRetrying = false,
  lastItemRef,
  emptyText,
}: AacDirectoryResultsProps) {
  const t = useT("modules/aac");

  const retryButton = onRetry ? (
    <Button type="button" variant="outline" size="sm" disabled={isRetrying} onClick={onRetry}>
      {String(t("directory.retry"))}
    </Button>
  ) : null;

  if (error && communs.length === 0) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 rounded-lg border border-destructive/40 p-6 text-center text-sm text-destructive"
      >
        <span>{String(t("directory.error"))}</span>
        {retryButton}
      </div>
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

      {/* La sentinelle CÈDE la place au bandeau de reprise : la laisser sous une
          erreur relancerait la page en défaut à chaque re-observation, en boucle
          tant que le serveur ne répond pas. */}
      {error ? (
        <div role="alert" className="flex items-center justify-center gap-3 py-4">
          {isRetrying && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
          )}
          <span className="text-sm text-destructive">{String(t("directory.loadMoreError"))}</span>
          {retryButton}
        </div>
      ) : (
        <>
          {hasNextPage ? <div ref={lastItemRef} className="h-12" aria-hidden="true" /> : null}

          {isFetchingNextPage ? (
            <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {String(t("directory.loading"))}
            </p>
          ) : null}
        </>
      )}
    </>
  );
}

export default AacDirectoryResults;
