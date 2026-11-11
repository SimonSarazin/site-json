import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Squelette d'une rangée de colonnes, aux mesures du tableau (`--ck-column-width`) : la page ne
 * saute pas quand les colonnes arrivent. Annoncé une fois, comme une attente, et pas colonne par
 * colonne.
 *
 * Sous 768 px, les colonnes s'empilent (vue Rôles) ou, avec `scroll`, restent en rangée à 84 vw
 * comme celles du tableau des actions, qui défile à l'horizontale.
 */
export function BoardColumnsSkeleton({ columns = 3, scroll = false, className }: { columns?: number; scroll?: boolean; className?: string }) {
  const { t } = useTranslation("modules/kanban");
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn(scroll ? "flex gap-[var(--ck-column-gutter)] overflow-hidden" : "flex flex-col gap-4 md:flex-row md:gap-[var(--ck-column-gutter)]", className)}
    >
      <span className="sr-only">{t("common.loading")}</span>
      {Array.from({ length: columns }, (_, index) => (
        <div
          key={index}
          className={cn(
            "flex shrink-0 flex-col gap-[var(--ck-card-gap)] rounded-2xl border border-border bg-[var(--ck-column-fill)] p-[var(--ck-column-padding)] md:w-[var(--ck-column-width)]",
            scroll ? "w-[84vw]" : "w-full",
          )}
        >
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}
