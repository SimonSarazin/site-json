import "./i18n";
import { useT } from "@/hooks/useT";
import type { EquipmentObservatorySectionProps } from "./schema";
import { KpiCards } from "./components/KpiCards";
import { Filters } from "./components/Filters";
import {
  AccessibilityChart,
  ApsChart,
  CommuneChart,
  NatureChart,
  TypeChart,
} from "./components/Charts";
import { EquipmentTable } from "./components/EquipmentTable";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useObservatoryEquipmentsQuery } from "./hooks/useObservatoryEquipmentsQuery";
import { useObservatoryFilters } from "./hooks/useObservatoryFilters";

interface EquipmentObservatorySectionComponentProps {
  id?: string;
  props: EquipmentObservatorySectionProps;
}

export default function EquipmentObservatorySection({
  id,
  props,
}: EquipmentObservatorySectionComponentProps) {
  // useT(namespace) résout AUSSI les LocalizedString du config (il enveloppe
  // useLocalization) — un seul hook pour les clés i18n ET les props localisées.
  const t = useT("modules/observatoire");

  const { equipments, error, stillLoading, progress } =
    useObservatoryEquipmentsQuery(props.baseParams);
  const { filtered, setFilters } = useObservatoryFilters(equipments);

  // Premier rendu sans aucune donnée (ni SSR-hydratée, ni chargée) : squelette.
  const isEmpty = equipments.length === 0 && stillLoading && !error;

  const headline = props.headline ? t(props.headline) : null;
  const description = props.description ? t(props.description) : null;

  return (
    <section
      id={id}
      className="w-full bg-background py-8"
      data-section="equipment-observatory"
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

        {/* Progression : total connu dès la 1ʳᵉ page — le dashboard se remplit
            au fil des pages, la barre rend l'attente lisible. */}
        {stillLoading && progress.total !== null && progress.loaded > 0 && (
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
            <Filters data={equipments} onChange={setFilters} />
            <KpiCards data={filtered} />

            <div className="grid grid-cols-1">
              <TypeChart data={filtered} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <NatureChart data={filtered} />
              <AccessibilityChart data={filtered} />
            </div>

            <div className="grid grid-cols-1">
              <ApsChart data={filtered} />
            </div>

            <div className="grid grid-cols-1">
              <CommuneChart data={filtered} />
            </div>

            <EquipmentTable data={filtered} />
          </>
        )}
      </div>
    </section>
  );
}
