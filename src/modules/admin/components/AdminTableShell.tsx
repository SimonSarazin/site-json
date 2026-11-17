import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableHeader } from "@/components/ui/table";

export interface AdminTableShellProps {
  /** Ligne(s) d'en-tête — un `<TableRow>` de `<TableHead>`. */
  head: ReactNode;
  /** Lignes du corps. */
  body: ReactNode;
  /** Chargement en cours : deux lignes squelette sous la table. */
  loading: boolean;
  /** Aucune ligne (hors chargement) : message centré. */
  empty: boolean;
  emptyMessage: string;
  /** Hauteur maximale de la zone défilante (classe Tailwind). Défaut `max-h-[55vh]`. */
  maxHeightClass?: string;
  /**
   * En-tête collé en haut au défilement. Opt-in : `<Table>` enveloppe sa table dans son PROPRE
   * conteneur `overflow-x-auto`, qui devient l'ancêtre de défilement d'un `sticky` et le neutralise —
   * la table est donc rendue nue, la zone bornée ci-dessous défilant dans les deux axes.
   */
  stickyHeader?: boolean;
}

/**
 * Coque de table des sections admin (référencement, reprise de réponses…) : zone défilante bornée,
 * en-tête + corps fournis par la section, squelette de chargement et état vide UNIFORMES. Extrait
 * pour que chaque section ne recopie pas le même bloc — la section garde la main sur ses colonnes.
 */
export function AdminTableShell({ head, body, loading, empty, emptyMessage, maxHeightClass = "max-h-[55vh]", stickyHeader = false }: AdminTableShellProps) {
  return (
    <div className={`${maxHeightClass} overflow-auto`}>
      {stickyHeader ? (
        <table data-slot="table" className="w-full caption-bottom text-sm">
          <TableHeader className="sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_var(--border)]">{head}</TableHeader>
          <TableBody>{body}</TableBody>
        </table>
      ) : (
        <Table>
          <TableHeader>{head}</TableHeader>
          <TableBody>{body}</TableBody>
        </Table>
      )}
      {loading && (
        <div className="space-y-2 py-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      )}
      {!loading && empty && <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>}
    </div>
  );
}
