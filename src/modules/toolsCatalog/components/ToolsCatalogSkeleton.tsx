import { Skeleton } from "@/components/ui/skeleton";

/**
 * Largeurs figées pour des pastilles réalistes (classes littérales → le JIT
 * Tailwind les conserve, comme COL_CLASS dans ToolsCatalog.tsx).
 */
const PILL_WIDTHS = ["w-16", "w-24", "w-20", "w-28", "w-14", "w-24"] as const;

function FilterGroupSkeleton({ pills = 6 }: { pills?: number }) {
  return (
    <div>
      <Skeleton className="mx-auto mb-3 h-3 w-28" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: pills }).map((_, i) => (
          <Skeleton key={i} className={`h-7 rounded-full ${PILL_WIDTHS[i % PILL_WIDTHS.length]}`} />
        ))}
      </div>
    </div>
  );
}

/** Placeholder de la barre latérale de filtres (pendant le 1er chargement). */
export function ToolFiltersSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <FilterGroupSkeleton pills={6} />
      <FilterGroupSkeleton pills={4} />
    </div>
  );
}

/** Carte d'outil CENTRÉE placeholder : carré icône, titre (2 lignes), badge, 1 ligne. */
function ToolCardSkeleton() {
  return (
    <div className="flex h-full flex-col items-center rounded-xl border border-border bg-card p-5">
      <Skeleton className="mb-3 h-16 w-16 rounded-lg" />
      <Skeleton className="mb-1 h-4 w-4/5" />
      <Skeleton className="mb-3 h-4 w-3/5" />
      <Skeleton className="mb-2 h-5 w-24 rounded-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

/**
 * Squelette de la grille du catalogue (chargement initial), aligné sur le nouveau
 * design (cartes centrées). Rendu dans la colonne principale ; la barre latérale a
 * son propre placeholder (`ToolFiltersSkeleton`). `gridClass` doit être le MÊME que
 * la grille chargée (dérivée de `props.columns`) pour éviter un reflow au basculement.
 */
export function ToolsCatalogSkeleton({
  count = 9,
  gridClass = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3",
}: {
  count?: number;
  gridClass?: string;
}) {
  return (
    <div className={gridClass} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <ToolCardSkeleton key={i} />
      ))}
    </div>
  );
}
