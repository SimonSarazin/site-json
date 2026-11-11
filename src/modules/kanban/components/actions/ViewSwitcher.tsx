import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { actionsViewPath, type ActionsViewId } from "@/modules/kanban/lib/kanbanPaths";
import { segmentViews } from "./actionsViews";

/**
 * Sélecteur des vues du tableau des actions : « Tableau | Liste », plus la vue courante quand elle
 * vient du menu (`segmentViews`). Repris de la commande segmentée de co-kanban, dans sa forme de
 * NAVIGATION : chaque segment est un lien (`<nav>` + `aria-current`), la vue a son adresse, se
 * partage et se retrouve au bouton « Précédent ».
 */
export function ViewSwitcher({ current }: { current: ActionsViewId }) {
  const { t } = useTranslation("modules/kanban");
  return (
    <nav aria-label={t("boardViews.label")} className="inline-flex max-w-full min-w-0 items-center gap-0.5 rounded-lg border border-border bg-muted/60 p-1 pointer-coarse:p-0.5">
      {segmentViews(current).map((view) => {
        const active = view.id === current;
        const Icon = view.icon;
        return (
          <Link
            key={view.id}
            to={actionsViewPath(view.id)}
            aria-current={active ? "page" : undefined}
            className={cn(
              // `min-w-0` et un libellé tronqué : à 320 px (page zoomée), trois segments tiennent
              // sans faire défiler la page en largeur.
              "inline-flex h-7 min-w-0 items-center gap-1.5 rounded-md px-3 text-sm whitespace-nowrap pointer-coarse:min-h-11",
              "transition-[background-color,color,box-shadow] duration-[var(--ck-duration-out)] ease-in",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              // L'état actif ne repose pas sur une nuance de fond : graisse, encre pleine et filet
              // primaire ; en couleurs forcées, les couleurs système de la sélection.
              active
                ? "bg-card font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--primary)] forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]"
                : "font-medium text-muted-foreground hover:bg-card/70 hover:text-foreground",
            )}
          >
            {/* Sous 368 px, les icônes (décoratives) s'effacent : un libellé entier se lit mieux. */}
            <Icon aria-hidden className="size-4 shrink-0 max-[23rem]:hidden" />
            <span className="truncate">{t(view.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
