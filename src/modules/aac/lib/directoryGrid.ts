/** Classes de grille figées : Tailwind ne génère pas `grid-cols-${n}`. */
const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
};

/** Colonnes de la grille des communs, partagées par les résultats et les squelettes ; 3 par défaut. */
export function directoryGridCols(columns: number): string {
  return GRID_COLS[columns] ?? GRID_COLS[3];
}
