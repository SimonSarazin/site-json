import "./i18n";
import { useMemo } from "react";
import { TriangleAlert } from "lucide-react";
import { useT } from "@/hooks/useT";
import type { DataObservatorySectionProps, FilterDef } from "./schema";
import { KpiCards } from "./components/KpiCards";
import { Filters } from "./components/Filters";
import { ObservatoryCharts } from "./components/Charts";
import { ObservatoryTable } from "./components/ObservatoryTable";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useObservatoryItemsQuery } from "./hooks/useObservatoryItemsQuery";
import { useObservatoryFilters } from "./hooks/useObservatoryFilters";
import { buildLabelMaps } from "./dimensions";

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

  const { items, entities, error, stillLoading, progress, capped } = useObservatoryItemsQuery(
    props.baseParams,
    dimensions,
  );
  // Libellés canoniques des dimensions à `keyPaths` (ex. departement regroupé
  // par `address.level4`) : construits UNE fois sur le dataset COMPLET (`items`)
  // pour rester stables quel que soit le filtrage, puis partagés à tous les
  // widgets (filtres/KPI/graphes/table).
  const labels = useMemo(() => buildLabelMaps(items, dimensions), [items, dimensions]);
  const { filters, filtered, setFilters, q, setQ } = useObservatoryFilters(
    items,
    dimensions,
    filterIds,
    props.search?.dimensions,
    labels,
  );

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

  // Premier rendu sans aucune donnée (ni SSR-hydratée, ni chargée) : squelette.
  const isEmpty = items.length === 0 && stillLoading && !error;
  // Des données existent mais filtres/recherche excluent tout : état dédié
  // (sinon : KPI à 0 et graphes vides, muets sur la cause).
  const noResults = !isEmpty && items.length > 0 && filtered.length === 0;

  return (
    <section
      id={id}
      className="w-full bg-background py-8"
      data-section="data-observatory"
    >
      <div className="mx-auto w-full max-w-8xl px-4 sm:px-6 lg:px-8 space-y-6">
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
                <Button variant="outline" size="sm" onClick={() => setFilters({})}>
                  {t("filters.reset")}
                </Button>
              </div>
            ) : (
              <>
                {kpis.length > 0 && (
                  <KpiCards data={filtered} dimensions={dimensions} kpis={kpis} labels={labels} />
                )}

                {charts.length > 0 && (
                  <ObservatoryCharts
                    charts={charts}
                    data={filtered}
                    dimensions={dimensions}
                    labels={labels}
                    animate={!stillLoading}
                    onDrill={onDrill}
                  />
                )}

                {props.table && (
                  <ObservatoryTable
                    data={filtered}
                    dimensions={dimensions}
                    table={props.table}
                    exportCsv={props.export ?? null}
                    entities={entities}
                    labels={labels}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
