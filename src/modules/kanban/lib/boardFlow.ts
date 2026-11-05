import type { Column } from '@/modules/kanban/types';

/** Un tronçon du flux d'un tableau : une colonne, ses cartes et sa place dans le flux. */
export interface FlowSegment {
  column: Column;
  count: number;
  done: boolean;
  /**
   * Rang de teinte d'une colonne OUVERTE, de 0 (la plus en amont) à `toneCount - 1` (la plus en
   * aval) : plus une carte avance, plus sa teinte est soutenue. Il se compte sur TOUTES les
   * colonnes ouvertes, vides comprises, pour qu'une colonne garde sa teinte d'une visite à
   * l'autre. `null` pour la colonne de fin, qui a sa propre couleur.
   */
  tone: number | null;
}

/**
 * Flux d'un tableau pour sa tuile sur `/kanban` : les colonnes dans l'ordre du tableau (`rank`),
 * chacune avec son nombre de cartes. Une bande par colonne, LARGE comme sa part de cartes : à la
 * différence de barres hautes comme la plus grosse colonne, la colonne de fin qui grossit
 * n'écrase pas les colonnes ouvertes. Se calcule sur la réponse de `board/create` (`cardCount`
 * de chaque colonne), sans charger l'instantané. Pure et testée.
 */
export function boardFlow(columns: readonly Column[], toneCount: number): FlowSegment[] {
  const ordered = [...columns].sort((a, b) => a.rank - b.rank);
  const openIds = ordered.filter((column) => !column.isDoneColumn).map((column) => column._id);
  const lastTone = Math.max(0, toneCount - 1);
  return ordered.map((column) => {
    if (column.isDoneColumn) return { column, count: column.cardCount, done: true, tone: null };
    const position = openIds.indexOf(column._id);
    // Une seule colonne ouverte : la teinte la plus soutenue, celle du travail en cours.
    const tone = openIds.length === 1 ? lastTone : Math.round((position / (openIds.length - 1)) * lastTone);
    return { column, count: column.cardCount, done: false, tone };
  });
}
