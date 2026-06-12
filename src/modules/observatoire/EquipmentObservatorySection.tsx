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

  const { equipments, error, stillLoading } = useObservatoryEquipmentsQuery(
    props.baseParams,
  );
  const { filtered, setFilters } = useObservatoryFilters(equipments);

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

        {stillLoading && (
          <p className="text-center text-xs text-muted-foreground">
            {t("loading")}
          </p>
        )}
      </div>
    </section>
  );
}
