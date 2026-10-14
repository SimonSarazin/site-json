import "../i18n";
import { useMemo, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import type { FilterValues } from "../schema";
import type { ObservatoryPanelConf } from "../dashboardSchema";
import { buildLabelMaps, dimensionLabel, dimensionValue } from "../dimensions";
import { applyFilters, applySelection } from "../dashboard";
import { toItems } from "../hooks/useObservatoryItemsQuery";
import { KpiCards } from "./KpiCards";
import { ObservatoryCharts } from "./Charts";

/** Ce que la liste de l'hôte reçoit pour se rendre et pour agir. */
export interface ObservatoryPanelListApi {
  /** Entités restant après sélection et drill-down — la liste ne montre que celles-là. */
  entities: readonly SearchEntity[];
  /** Clic sur un item : restreint le tableau de bord à sa famille. `null` quand
   *  la config ne déclare pas `select` — la liste garde alors son clic normal. */
  select: ((entity: SearchEntity) => void) | null;
}

/**
 * Le tableau de bord SANS sa page : sélection, KPI, graphes, calculés sur des
 * résultats que l'APPELANT a déjà chargés.
 *
 * C'est ce qui le rend réutilisable. `DataObservatorySection` possède ses
 * données (requête, filtres, progression, table) ; ici il n'y a pas de requête
 * — la section hôte passe ses résultats courants et les chiffres suivent d'eux-
 * mêmes sa recherche et ses filtres, exactement comme la carte suit les mêmes
 * résultats. Deux sources de vérité donneraient deux totaux sur le même écran.
 *
 * En revanche le panneau POSSÈDE le raffinement — sélection d'un item,
 * drill-down sur un graphe. Il doit donc rendre l'agencement complet : une
 * sélection qui ne toucherait que les graphes, en laissant la liste intacte,
 * n'aurait aucun sens. D'où `renderList`, par quoi l'hôte fournit SA liste et
 * reçoit en retour les entités survivantes.
 *
 * Le raffinement est un état LOCAL, pas un paramètre d'URL : `searchProStatic`
 * est la variante SANS synchronisation URL du module search — plusieurs
 * instances coexistent sur une page, et leurs états ne peuvent pas partager les
 * mêmes clés.
 *
 * Monté en `lazy()` par ses hôtes : il tire recharts, qui pèse.
 */
export default function ObservatoryPanel({
  results,
  conf,
  animate = true,
  renderList,
  listClass,
  panelClass,
}: {
  /** Résultats de la section hôte — convention `serverData` appliquée ici. */
  results: readonly SearchEntity[];
  conf: ObservatoryPanelConf;
  /** Animer l'apparition (false tant que le chargement continue). */
  animate?: boolean;
  /** Liste de l'hôte, rendue à GAUCHE des graphes. Absente : graphes pleine largeur. */
  renderList?: (api: ObservatoryPanelListApi) => ReactNode;
  /** Largeurs des deux colonnes (classes littérales fournies par l'hôte). */
  listClass?: string;
  panelClass?: string;
}) {
  useLoadNamespace("modules/observatoire");
  const t = useT("modules/observatoire");

  const { items, entities } = useMemo(() => toItems(results), [results]);
  const dimensions = conf.dimensions;
  // Libellés canoniques des dimensions à `keyPaths`, dérivés du jeu COMPLET :
  // ils doivent rester stables quel que soit le raffinement en cours.
  const labels = useMemo(() => buildLabelMaps(items, dimensions), [items, dimensions]);

  const [filters, setFilters] = useState<FilterValues>({});
  const [selection, setSelection] = useState("");

  const select = conf.select;
  const selectionDims = useMemo(
    () => (select ? (select.dimensions ?? [select.titleDimension]) : []),
    [select],
  );

  const filtered = useMemo(
    () =>
      applySelection(
        applyFilters(items, filters, dimensions, labels),
        selection,
        dimensions,
        selectionDims,
        labels,
      ),
    [items, filters, dimensions, labels, selection, selectionDims],
  );

  // `entities` est aligné avec `items` index à index, mais `filtered` en est un
  // SOUS-ENSEMBLE — on retrouve les entités par référence d'objet (les
  // helpers ne copient pas les items).
  const filteredEntities = useMemo(() => {
    if (filtered.length === items.length) return entities;
    const byItem = new Map(items.map((item, i) => [item, entities[i]]));
    return filtered
      .map((item) => byItem.get(item))
      .filter((e): e is SearchEntity => e != null);
  }, [filtered, items, entities]);

  const kpis = conf.kpis ?? [];
  const charts = conf.charts ?? [];

  // Drill-down : un clic sur une part pose un filtre. Sans barre de filtres à
  // côté, la puce ci-dessous est le SEUL moyen de le retirer — elle est donc
  // indissociable de la fonctionnalité.
  const onDrill = conf.drilldown
    ? (dimensionId: string, value: string) => setFilters({ ...filters, [dimensionId]: value })
    : undefined;

  const onSelectEntity = select
    ? (entity: SearchEntity) => {
        const item = (entity as { serverData?: unknown }).serverData;
        const def = dimensions[select.titleDimension];
        const title =
          item && def
            ? (dimensionValue(item as Record<string, unknown>, def, labels[select.titleDimension]) ?? "")
            : "";
        // Re-cliquer l'item sélectionné annule la sélection : l'aller-retour
        // se fait sans chercher la puce.
        setSelection((prev) => (prev === title ? "" : title));
      }
    : null;

  const activeFilters = Object.entries(filters).filter(([id, v]) => v && dimensions[id]);
  const hasRefinement = Boolean(selection) || activeFilters.length > 0;

  if (items.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">{t("emptyFiltered")}</p>
    );
  }

  const chip = (label: string, onClear: () => void, key: string) => (
    <Badge
      key={key}
      variant="secondary"
      className="max-w-full gap-1 rounded-full py-1 pl-3 pr-1 text-xs font-normal"
    >
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onClear}
        aria-label={t("list.clearSelection")}
        className="ml-0.5 rounded-full p-0.5 hover:bg-background/60"
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );

  const chartsBlock = charts.length > 0 && (
    <ObservatoryCharts
      charts={charts}
      data={filtered}
      dimensions={dimensions}
      labels={labels}
      animate={animate}
      onDrill={onDrill}
    />
  );

  return (
    <div className="space-y-6">
      {/* Raffinement actif : sans ce rappel, un filtre posé d'un clic reste
          invisible — l'utilisateur ne verrait qu'un tableau de bord écourté. */}
      {hasRefinement && (
        <div className="flex flex-wrap items-center gap-2">
          {selection && chip(selection, () => setSelection(""), "selection")}
          {activeFilters.map(([id, value]) =>
            chip(
              `${dimensionLabel(t, dimensions, id)} : ${value}`,
              () => {
                const next = { ...filters };
                delete next[id];
                setFilters(next);
              },
              id,
            ),
          )}
        </div>
      )}

      {/* KPI en BANDEAU pleine largeur : ce sont les chiffres de synthèse du
          résultat, ils se lisent avant d'entrer dans le détail — et une colonne
          étroite les tasse sur plusieurs lignes. */}
      {kpis.length > 0 && (
        <KpiCards
          data={filtered}
          dimensions={dimensions}
          kpis={kpis}
          labels={labels}
          layout={conf.kpiLayout}
        />
      )}

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("emptyFiltered")}</p>
      ) : renderList ? (
        /* Ce sont les GRAPHES qui commandent la hauteur : ils se déroulent
           ENTIÈREMENT, sans scroll propre — on doit pouvoir tous les lire d'une
           traite. C'est la LISTE qui s'adapte : colonne `relative` + contenu
           `absolute inset-0 overflow-y-auto`. Un enfant flex simplement étiré
           grandit avec son contenu et `overflow-y` y reste lettre morte ;
           l'absolu lui donne enfin une hauteur DÉFINIE, celle de sa colonne. */
        <div className="flex w-full gap-4 min-h-[60vh]">
          <div className={`relative ${listClass ?? "w-2/5"}`}>
            <div className="absolute inset-0 overflow-y-auto pr-1">
              {renderList({ entities: filteredEntities, select: onSelectEntity })}
            </div>
          </div>
          <div className={`${panelClass ?? "w-3/5"} space-y-6`}>{chartsBlock}</div>
        </div>
      ) : (
        chartsBlock
      )}
    </div>
  );
}
