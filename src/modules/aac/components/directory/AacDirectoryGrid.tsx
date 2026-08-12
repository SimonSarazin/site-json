import { Loader2, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import { AacCommunCard } from "./AacCommunCard";
import { AacDirectorySkeleton } from "./AacDirectorySkeleton";
import type { AacCommunCard as CommunCard } from "../../lib/parseAacAnswer";

interface AacDirectoryGridProps {
  communs: CommunCard[];
  columns: number;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage?: boolean;
  error: Error | null;
  /** Sentinelle du scroll infini, posée après la dernière carte. */
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

export function AacDirectoryGrid({
  communs,
  columns,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  error,
  lastItemRef,
  emptyText,
}: AacDirectoryGridProps) {
  const t = useT("modules/aac");
  const gridClass = GRID_COLS[columns] ?? GRID_COLS[3];

  if (error) {
    return (
      <p role="alert" className="rounded-lg border border-destructive/40 p-6 text-center text-sm text-destructive">
        {String(t("directory.error"))}
      </p>
    );
  }

  if (isLoading) {
    return <AacDirectorySkeleton columns={columns} />;
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
      <div className={cn("grid gap-6", gridClass)}>
        {communs.map((commun) => (
          <AacCommunCard key={commun.id} commun={commun} />
        ))}
      </div>

      {hasNextPage && <div ref={lastItemRef} className="h-12" aria-hidden="true" />}

      {isFetchingNextPage && (
        <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {String(t("directory.loading"))}
        </p>
      )}
    </>
  );
}

export default AacDirectoryGrid;
