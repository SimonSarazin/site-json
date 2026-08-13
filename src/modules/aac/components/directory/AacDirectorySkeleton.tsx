import { cn } from "@/lib/utils";

/**
 * Squelette de la grille.
 *
 * Markup volontairement STABLE : c'est lui que rend le SSR, et le premier render
 * client doit lui être identique — sans quoi React remonte une erreur
 * d'hydratation. Aucun aléa, aucune lecture de `window`.
 */
const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
};

export function AacDirectorySkeleton({
  columns = 3,
  count = 6,
}: {
  columns?: number;
  count?: number;
}) {
  return (
    <div
      className={cn("grid gap-6", GRID_COLS[columns] ?? GRID_COLS[3])}
      aria-busy="true"
    >
      {Array.from({ length: count }, (_, i) => (
        // Mêmes hauteurs figées que `AacCommunCard` : le squelette doit occuper
        // exactement la place de la carte, sinon la grille saute au chargement.
        <div key={i} className="min-h-140 rounded-[10px] border bg-card p-5">
          <div className="h-40 w-full animate-pulse rounded-[10px] bg-muted" />
          <div className="pt-3">
            <div className="h-14.25">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            </div>
            <div className="mb-1.25 h-18 space-y-2">
              <div className="h-3 w-full animate-pulse rounded bg-muted" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-14.5">
              <div className="h-5 w-23 animate-pulse rounded-lg bg-muted" />
            </div>
            <div className="h-11.07 pb-1.25" />
            <div className="h-5.25" />
            <div className="h-5 w-full animate-pulse rounded bg-muted" />
            <div className="mt-6.25 h-9.5 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default AacDirectorySkeleton;
