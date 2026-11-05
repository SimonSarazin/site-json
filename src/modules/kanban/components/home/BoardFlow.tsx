import { CircleCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import { resolveColumnTitle } from "@/modules/kanban/components/board/kanbanDnd";
import { flowToneClass, OPEN_TONES } from "@/modules/kanban/components/board/columnTone";
import { boardFlow } from "@/modules/kanban/lib/boardFlow";
import type { BoardCreateResult } from "@/modules/kanban/types";

/**
 * Le tableau des actions à plat, élément signature de `/kanban` : une bande par colonne, dans
 * l'ordre du tableau, large comme sa part de cartes. Elle se lit comme le tableau, de gauche à
 * droite jusqu'au vert de « Terminé », et sa part verte donne l'avancement d'un coup d'œil.
 *
 * Au-dessus, les deux chiffres qui comptent (ouvertes, terminées) ; dessous, la légende des
 * colonnes ouvertes non vides, qui nomme les bandes et dit leurs cartes. La bande est décorative :
 * tout ce qu'elle montre est écrit.
 */
export function BoardFlow({ data }: { data: BoardCreateResult }) {
  const t = useT("modules/kanban");
  const { cards, done } = data.board.counts;
  const filled = boardFlow(data.columns, OPEN_TONES.length).filter((segment) => segment.count > 0);
  const open = filled.filter((segment) => !segment.done);

  return (
    <div className="space-y-2.5">
      {cards === 0 ? (
        <p className="text-sm text-muted-foreground">{String(t("home.stats.empty"))}</p>
      ) : (
        // Les ouvertes à gauche, au-dessus des colonnes ouvertes ; les terminées à droite, au-dessus
        // du vert.
        <p className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm tabular-nums">
          <span className="font-medium text-foreground">{String(t("home.stats.open", undefined, { count: cards - done }))}</span>
          <span className="sr-only">, </span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <CircleCheck aria-hidden className="size-3.5 shrink-0 text-[var(--ck-success-ink)]" />
            {String(t("home.stats.doneOf", undefined, { count: done, total: cards }))}
          </span>
        </p>
      )}

      <div aria-hidden className={cn("flex h-2.5 gap-0.5 overflow-hidden rounded-full", filled.length === 0 && "bg-muted")}>
        {filled.map((segment) => (
          // `min-w-1` : une colonne d'une carte parmi des centaines reste visible.
          <span key={segment.column._id} className={cn("min-w-1 basis-0", flowToneClass(segment))} style={{ flexGrow: segment.count }} />
        ))}
      </div>

      {open.length > 0 ? (
        <ul aria-label={String(t("home.stats.openByColumn"))} className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {open.map((segment) => (
            <li key={segment.column._id} className="inline-flex items-center gap-1.5">
              <span aria-hidden className={cn("size-2 shrink-0 rounded-full", flowToneClass(segment))} />
              {resolveColumnTitle(segment.column, (key, fallback) => String(t(key, fallback)))}{" "}
              <span className="font-medium text-foreground tabular-nums">{segment.count}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Même encombrement que le flux, pendant le chargement : la tuile ne saute pas (CLS). */
export function BoardFlowSkeleton() {
  return (
    <div aria-hidden className="space-y-2.5">
      <Skeleton className="h-5 w-2/3 motion-reduce:animate-none" />
      <Skeleton className="h-2.5 rounded-full motion-reduce:animate-none" />
      <Skeleton className="h-4 w-4/5 motion-reduce:animate-none" />
    </div>
  );
}
