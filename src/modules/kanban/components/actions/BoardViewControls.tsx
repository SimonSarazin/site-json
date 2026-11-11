import type { ReactNode } from "react";
import { ArrowUpDown, Layers, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BOARD_GROUP_BY_VALUES, BOARD_SORT_KEYS, type BoardSearch } from "@/modules/kanban/components/board/boardSearch";
import { ChoiceRow } from "@/modules/kanban/components/ui/ChoiceRow";
import type { ActionsViewDescriptor } from "./actionsViews";

/** Les deux commandes d'ORGANISATION ; le filtrage a sa propre barre. */
const ORGANIZE_CONTROLS = ["group", "sort"] as const;
type OrganizeControl = (typeof ORGANIZE_CONTROLS)[number];

const ICONS: Record<OrganizeControl, LucideIcon> = { group: Layers, sort: ArrowUpDown };

function PanelLegend({ children }: { children: ReactNode }) {
  return <legend className="px-2 pt-1 pb-1 text-xs font-medium text-muted-foreground">{children}</legend>;
}

function GroupPanel({ search }: { search: BoardSearch }) {
  const { t } = useTranslation("modules/kanban");
  return (
    <fieldset className="m-0 min-w-0 border-0 p-1">
      <PanelLegend>{t("boardControls.group")}</PanelLegend>
      {BOARD_GROUP_BY_VALUES.map((value) => (
        <ChoiceRow key={value} type="radio" name="kanban-group-by" checked={search.groupBy === value} onChange={() => search.setGroupBy(value)}>
          {t(`boardControls.groupBy.${value}`)}
        </ChoiceRow>
      ))}
    </fieldset>
  );
}

function SortPanel({ search }: { search: BoardSearch }) {
  const { t } = useTranslation("modules/kanban");
  const { sortKey, sortDirection, setSort } = search;
  return (
    <div className="flex flex-col p-1">
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <PanelLegend>{t("boardControls.sort")}</PanelLegend>
        {BOARD_SORT_KEYS.map((key) => (
          <ChoiceRow key={key} type="radio" name="kanban-sort-key" checked={sortKey === key} onChange={() => setSort(key, sortDirection)}>
            {t(`boardControls.sortBy.${key}`)}
          </ChoiceRow>
        ))}
      </fieldset>
      <fieldset className="m-0 mt-1 min-w-0 border-0 border-t border-border p-0 pt-1">
        <PanelLegend>{t("boardControls.direction")}</PanelLegend>
        <ChoiceRow type="radio" name="kanban-sort-direction" checked={sortDirection === "asc"} onChange={() => setSort(sortKey, "asc")}>
          {t("boardControls.asc")}
        </ChoiceRow>
        <ChoiceRow type="radio" name="kanban-sort-direction" checked={sortDirection === "desc"} onChange={() => setSort(sortKey, "desc")}>
          {t("boardControls.desc")}
        </ChoiceRow>
      </fieldset>
    </div>
  );
}

const PANELS: Record<OrganizeControl, (props: { search: BoardSearch }) => ReactNode> = { group: GroupPanel, sort: SortPanel };

/**
 * « Grouper par » et « Trier », au bout de la barre de filtres, pour les vues qui s'organisent
 * (Liste, Table). Repris de co-kanban (`BoardViewControls`).
 *
 * Sur une vue où aucune ne s'applique (Tableau, Jalons, Chronologie, Vue d'ensemble), rien n'est
 * rendu. Sur une vue qui en accepte une seule (la Table se trie mais ne se groupe pas), l'autre
 * reste VISIBLE, `aria-disabled`, et dit pourquoi dans son infobulle (au survol comme au focus).
 */
export function BoardViewControls({ view, search }: { view: ActionsViewDescriptor; search: BoardSearch }) {
  const { t } = useTranslation("modules/kanban");
  if (ORGANIZE_CONTROLS.every((id) => view.unavailable[id] !== undefined)) return null;

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {ORGANIZE_CONTROLS.map((id) => {
        const Icon = ICONS[id];
        const label = t(`boardControls.${id}`);
        const reason = view.unavailable[id];

        if (reason !== undefined) {
          return (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" aria-disabled="true" className="cursor-not-allowed opacity-55 pointer-coarse:min-h-11" onClick={(event) => event.preventDefault()}>
                  <Icon aria-hidden />
                  {label}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t(reason)}</TooltipContent>
            </Tooltip>
          );
        }

        const Panel = PANELS[id];
        return (
          <Popover key={id}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="pointer-coarse:min-h-11">
                <Icon aria-hidden />
                {label}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" aria-label={label} className="w-60 p-0">
              <Panel search={search} />
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}
