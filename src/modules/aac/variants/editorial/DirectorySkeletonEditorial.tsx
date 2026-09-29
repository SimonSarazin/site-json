import { cn } from "@/lib/utils";
import type { AacDirectorySkeletonProps } from "../../components/directory/variants/items";

/** Mêmes classes de grille que `AacDirectoryResults` — Tailwind ne génère pas `grid-cols-${n}`. */
const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
};

/**
 * Squelette des communs, interface « editorial », aux mesures de la carte et de la ligne.
 * Rendu par le SSR : markup stable, sans aléa ni lecture de `window`.
 */
export default function DirectorySkeletonEditorial({ columns = 3, count = 6, display = "grid" }: AacDirectorySkeletonProps) {
  if (display === "list") {
    return (
      <div className="space-y-3" aria-busy="true">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
            <div className="min-w-0 grow space-y-2">
              <div className="h-5 w-48 animate-pulse rounded bg-muted" />
              <div className="h-3 w-32 animate-pulse rounded bg-muted" />
            </div>
            <div className="hidden w-36 shrink-0 space-y-1.5 sm:block">
              <div className="h-1.5 w-full animate-pulse rounded bg-muted" />
              <div className="ml-auto h-3 w-16 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-3 w-16 shrink-0 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("grid gap-6", GRID_COLS[columns] ?? GRID_COLS[3])} aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex min-h-64 flex-col rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-7 w-3/4 animate-pulse rounded bg-muted" />
          <div className="mt-3 space-y-2">
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
          </div>
          <div className="mt-4 flex gap-1.5">
            <div className="h-5 w-20 animate-pulse rounded-md bg-muted" />
            <div className="h-5 w-16 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="mt-auto space-y-2 pt-5">
            <div className="h-1.5 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-40 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
