import { cn } from "@/lib/utils";

/** Nombre de colonnes de grille par breakpoint (mobile = 1 implicite). */
export interface ResponsiveColumns {
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
}

// Classes Tailwind STATIQUES (présentes littéralement → détectées au scan, donc
// générées sur TOUS les sites sans dépendre d'un `@source inline` par thème ;
// des chaînes dynamiques `lg:grid-cols-${n}` ne seraient pas générées).
const GRID_COLS: Record<"sm" | "md" | "lg" | "xl", Record<number, string>> = {
  sm: { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4", 5: "sm:grid-cols-5", 6: "sm:grid-cols-6" },
  md: { 1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4", 5: "md:grid-cols-5", 6: "md:grid-cols-6" },
  lg: { 1: "lg:grid-cols-1", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5", 6: "lg:grid-cols-6" },
  xl: { 1: "xl:grid-cols-1", 2: "xl:grid-cols-2", 3: "xl:grid-cols-3", 4: "xl:grid-cols-4", 5: "xl:grid-cols-5", 6: "xl:grid-cols-6" },
};

/**
 * Construit les classes de colonnes d'une grille (mobile = `grid-cols-1`) à
 * partir d'une config responsive `{sm?, md?, lg?, xl?}`. Mapping statique →
 * robuste partout. Partagé par les sections en grille (`stats`, `action-tiles`).
 */
export function buildGridColsClass(columns: ResponsiveColumns): string {
  return cn(
    "grid-cols-1",
    columns.sm && GRID_COLS.sm[columns.sm],
    columns.md && GRID_COLS.md[columns.md],
    columns.lg && GRID_COLS.lg[columns.lg],
    columns.xl && GRID_COLS.xl[columns.xl],
  );
}
