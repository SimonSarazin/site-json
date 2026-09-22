import "./i18n";
import { Suspense, useMemo } from "react";
import { lazy } from "vite-preload";
import { useSearchParams } from "react-router";
import { TriangleAlert } from "lucide-react";
import { useT } from "@/hooks/useT";
import { useIsMobile } from "@/hooks/use-mobile";
import { DEFAULT_INSTALLATION_PARAM } from "@/modules/search/schema";
import type { DataObservatorySectionProps, FilterDef } from "./schema";
import { KpiCards } from "./components/KpiCards";
import { Filters } from "./components/Filters";
import { ObservatoryCharts } from "./components/Charts";
import { ObservatoryTable } from "./components/ObservatoryTable";
import { ObservatoryList } from "./components/ObservatoryList";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { sectionMaxWidthClass } from "@/lib/sectionMaxWidth";
import { useObservatoryItemsQuery } from "./hooks/useObservatoryItemsQuery";
import { useObservatoryFilters } from "./hooks/useObservatoryFilters";
import { buildLabelMaps } from "./dimensions";

// Fiche installation ouverte par l'URL (lien partagé) — chunk tiré uniquement
// sur un deep-link effectif.
const InstallationUrlModal = lazy(
  () => import("./components/installation/InstallationUrlModal"),
);

/**
 * Répartition {liste, tableau de bord} du mode `split`, selon `list.splitRatio`.
 * Classes Tailwind écrites EN TOUTES LETTRES : le JIT ne génère pas une classe
 * construite dynamiquement. Défaut "40-60" — parité avec le split liste+carte
 * du module search et de l'agenda.
 */
const SPLIT_LAYOUTS = {
  "40-60": { list: "w-2/5", panel: "w-3/5" },
  "50-50": { list: "w-1/2", panel: "w-1/2" },
  "60-40": { list: "w-3/5", panel: "w-2/5" },
} as const;

interface DataObservatorySectionComponentProps {
  id?: string;
  props: DataObservatorySectionProps;
}

/**
 * Tableau de bord ENTIÈREMENT déclaratif : le périmètre (baseParams), les
 * dimensions et les widgets (filtres, KPI, graphes, table) viennent de la
 * config de section — le code ne connaît aucun dataset. Cf.
 * doc/27-module-observatoire.md pour le format complet.
 */
export default function DataObservatorySection({
  id,
  props,
}: DataObservatorySectionComponentProps) {
  // useT(namespace) résout AUSSI les LocalizedString du config (il enveloppe
  // useLocalization) — un seul hook pour les clés i18n ET les props localisées.
  const t = useT("modules/observatoire");

  const dimensions = useMemo(() => props.dimensions ?? {}, [props.dimensions]);
  if (import.meta.env.DEV && Object.keys(dimensions).length === 0) {
    console.warn(
      "[observatoire] props.dimensions absent de la config — le dashboard n'a rien à afficher (déclarer les dimensions du dataset)",
    );
  }
  // Filtres : forme courte (id) ou riche ({dimension, multiple, searchable}).
  const filterDefs = useMemo<FilterDef[]>(
    () =>
      (props.filters ?? []).map((f) =>
        typeof f === "string" ? { dimension: f } : f,
      ),
    [props.filters],
  );
  const filterIds = useMemo(() => filterDefs.map((f) => f.dimension), [filterDefs]);
  const kpis = props.kpis ?? [];
  const charts = props.charts ?? [];

  // Ouverture de la fiche : déclarée au niveau de la section (`props.rowAction`)
  // ou, pour les configs antérieures au mode `split`, sous `table.rowAction`.
  // Table et liste consomment la MÊME, tout comme le deep-link `?installation=`.
  const rowAction = props.rowAction ?? props.table?.rowAction;

  // Fiche installation partagée : montée seulement si le param est présent.
  const [urlParams] = useSearchParams();
  const previewConf = rowAction?.preview;
  const installationConf = previewConf?.installationDashboard;
  const showInstallationUrlModal = Boolean(
    installationConf &&
      previewConf?.reservations &&
      urlParams.get(installationConf.param ?? DEFAULT_INSTALLATION_PARAM),
  );

  const { items, entities, error, stillLoading, progress, capped } = useObservatoryItemsQuery(
    props.baseParams,
    dimensions,
  );
  // Libellés canoniques des dimensions à `keyPaths` (ex. departement regroupé
  // par `address.level4`) : construits UNE fois sur le dataset COMPLET (`items`)
  // pour rester stables quel que soit le filtrage, puis partagés à tous les
  // widgets (filtres/KPI/graphes/table).
  const labels = useMemo(() => buildLabelMaps(items, dimensions), [items, dimensions]);
  // Dimensions interrogées par un clic sur une ligne de la liste — la config
  // peut en déclarer plusieurs (le nom de l'équipement ET celui de son
  // installation, par ex.) ; à défaut, le libellé de la ligne.
  const selectionDimIds = useMemo(
    () => props.list?.selectDimensions ?? (props.list ? [props.list.titleDimension] : []),
    [props.list],
  );
  const { filters, filtered, setFilters, q, setQ, selection, setSelection, resetAll } =
    useObservatoryFilters(
      items,
      dimensions,
      filterIds,
      props.search?.dimensions,
      labels,
      selectionDimIds,
    );

  // `entities` est aligné avec `items` (index à index) mais `filtered` est un
  // sous-ensemble — on recalcule les entités correspondantes par référence objet
  // (applyFilters/applyTextSearch/applySelection gardent les mêmes références,
  // pas de copie).
  const filteredEntities = useMemo(() => {
    if (entities.length === 0) return entities;
    const itemToEntity = new Map(items.map((item, i) => [item, entities[i]]));
    return filtered
      .map((item) => itemToEntity.get(item))
      .filter((e): e is (typeof entities)[number] => e != null);
  }, [filtered, items, entities]);

  // Drill-down (opt-in) : clic sur une part/barre → applique le filtre —
  // seulement pour les dimensions réellement filtrables (retirables par
  // l'utilisateur). Valeur unique : un clic = un focus.
  const onDrill = props.drilldown
    ? (dimensionId: string, value: string) => {
        if (!filterIds.includes(dimensionId)) return;
        setFilters({ ...filters, [dimensionId]: value });
      }
    : undefined;

  const headline = props.headline ? t(props.headline) : null;
  const description = props.description ? t(props.description) : null;

  // Liste latérale : demandée par la config (`layout: "split"` + `list`), rendue
  // CÔTE À CÔTE sur desktop seulement. Sous 768 px, deux colonnes sont
  // illisibles : la liste repasse alors sous le tableau de bord, à la place
  // qu'occupait la table — elle n'est jamais escamotée.
  const isMobile = useIsMobile();
  const wantsList = props.layout === "split" && !!props.list;
  if (import.meta.env.DEV && props.list && props.layout !== "split") {
    console.warn(
      "[observatoire] props.list déclaré sans props.layout: \"split\" — la liste n'est pas rendue",
    );
  }
  const isSplit = wantsList && !isMobile;
  const splitLayout = SPLIT_LAYOUTS[props.list?.splitRatio ?? "40-60"];

  // Premier rendu sans aucune donnée (ni SSR-hydratée, ni chargée) : squelette.
  const isEmpty = items.length === 0 && stillLoading && !error;
  // Des données existent mais filtres/recherche excluent tout : état dédié
  // (sinon : KPI à 0 et graphes vides, muets sur la cause).
  const noResults = !isEmpty && items.length > 0 && filtered.length === 0;

  // Les blocs de contenu, montés une fois et agencés ensuite : `split` pose les
  // KPI en bandeau puis répartit liste et graphes en deux colonnes, `stacked`
  // empile tout. Aucun n'est dupliqué d'une branche à l'autre — l'agencement
  // change, pas le contenu.
  const kpiBlock = kpis.length > 0 && (
    <KpiCards
      data={filtered}
      dimensions={dimensions}
      kpis={kpis}
      labels={labels}
      layout={props.kpiLayout}
    />
  );

  const chartsBlock = charts.length > 0 && (
    <ObservatoryCharts
      charts={charts}
      data={filtered}
      dimensions={dimensions}
      labels={labels}
      animate={!stillLoading}
      onDrill={onDrill}
    />
  );

  const listBlock = wantsList && props.list && (
    <ObservatoryList
      data={filtered}
      entities={filteredEntities}
      dimensions={dimensions}
      list={props.list}
      rowAction={rowAction}
      exportCsv={props.export ?? null}
      labels={labels}
      selection={selection}
      onSelect={setSelection}
    />
  );

  const tableBlock = props.table && (
    <ObservatoryTable
      data={filtered}
      dimensions={dimensions}
      table={props.table}
      exportCsv={props.export ?? null}
      entities={filteredEntities}
      labels={labels}
    />
  );

  return (
    <section
      id={id}
      className="w-full bg-background py-8"
      data-section="data-observatory"
    >
      <div className={`mx-auto w-full ${sectionMaxWidthClass(props.maxWidth, "8xl")} px-4 sm:px-6 lg:px-8 space-y-6`}>
        {(headline || description) && (
          <header className="space-y-1">
            {headline && (
              <h2 className="text-2xl font-bold text-foreground">{headline}</h2>
            )}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </header>
        )}

        {Boolean(error) && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {t("error.loadFailed")}
          </div>
        )}

        {capped && (
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/60 p-3 text-sm text-muted-foreground">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            {t("cappedNotice", undefined, {
              loaded: progress.loaded,
              total: progress.total ?? progress.loaded,
            })}
          </div>
        )}

        {/* Progression : total connu dès la 1ʳᵉ page — le dashboard se remplit
            au fil des pages, la barre rend l'attente lisible. */}
        {stillLoading && progress.total !== null && (
          <div className="space-y-1">
            <Progress
              value={Math.round((progress.loaded / Math.max(progress.total, 1)) * 100)}
              className="h-1.5"
            />
            <p className="text-right text-xs text-muted-foreground tabular-nums">
              {t("loadingProgress", undefined, {
                loaded: progress.loaded,
                total: progress.total,
              })}
            </p>
          </div>
        )}

        {isEmpty ? (
          /* Avant la 1ʳᵉ page : squelette du dashboard (filtres, KPI, chart). */
          <div className="space-y-6" aria-busy="true">
            <Skeleton className="h-28 rounded-2xl" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-[420px] rounded-2xl" />
            <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Spinner className="size-3" /> {t("loading")}
            </p>
          </div>
        ) : (
          <>
            {(filterDefs.length > 0 || props.search) && (
              <Filters
                data={items}
                dimensions={dimensions}
                filterDefs={filterDefs}
                values={filters}
                onChange={setFilters}
                labels={labels}
                search={
                  props.search
                    ? { q, setQ, placeholder: props.search.placeholder }
                    : null
                }
                partial={stillLoading ? progress : null}
              />
            )}

            {noResults ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/50 bg-card p-10 text-center">
                <p className="text-sm text-muted-foreground">{t("emptyFiltered")}</p>
                {/* `resetAll` et non `setFilters({})` : une sélection ou une
                    recherche seule peut vider le résultat — n'effacer que les
                    filtres laisserait l'utilisateur devant une page vide. */}
                <Button variant="outline" size="sm" onClick={resetAll}>
                  {t("filters.reset")}
                </Button>
              </div>
            ) : isSplit ? (
              <>
                {/* Split (desktop). Les KPI d'abord, en BANDEAU pleine largeur
                    sous les filtres : ce sont les chiffres de synthèse du
                    résultat, ils se lisent avant d'entrer dans le détail — et
                    une colonne étroite les tassait sur plusieurs lignes. */}
                {kpiBlock}
                {/* Puis les deux colonnes. Les graphes commandent la hauteur :
                    ils se déroulent ENTIÈREMENT, sans scroll propre — on doit
                    pouvoir tous les lire d'une traite. C'est la LISTE qui
                    s'adapte. `items-stretch` (défaut flex) étire sa colonne à la
                    hauteur des graphes ; le panneau absolu en épouse exactement
                    les bornes, ce qui lui donne enfin une hauteur définie — sans
                    quoi un enfant flex étiré grandit avec son contenu et
                    `overflow-y` reste lettre morte. `min-h` : filet quand la
                    colonne droite est courte (une section sans graphe la
                    réduirait à rien). */}
                <div className="flex w-full gap-4 min-h-[60vh]">
                  <div className={`relative ${splitLayout.list}`}>
                    <div className="absolute inset-0 overflow-y-auto">{listBlock}</div>
                  </div>
                  <div className={`${splitLayout.panel} space-y-6`}>
                    {chartsBlock}
                    {tableBlock}
                  </div>
                </div>
              </>
            ) : (
              <>
                {kpiBlock}
                {chartsBlock}
                {listBlock}
                {tableBlock}
              </>
            )}
          </>
        )}
      </div>

      {showInstallationUrlModal && (
        <Suspense fallback={null}>
          <InstallationUrlModal preview={previewConf!} />
        </Suspense>
      )}
    </section>
  );
}
