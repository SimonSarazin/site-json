import { useT } from "@/hooks/useT";
import type { DataObservatorySectionProps, DimensionsConfig, ObservatoryItem, KpiDef } from "../schema";
import { TOKEN_TINT_CLASSES, dimensionLabel, type LabelMaps } from "../dimensions";
import { computeKpiValue } from "../dashboard";
import type { ReservationHours } from "@/modules/search/lib/reservationHours";
import { KpiCard } from "./KpiCard";

type KpiColumns = NonNullable<DataObservatorySectionProps["kpiColumns"]>;

/** Colonnes dès 1024 px quand la config les fixe (`kpiColumns`). Classes ÉCRITES EN ENTIER : Tailwind
 *  ne génère que celles qu'il lit dans le code ; le `Record` oblige à couvrir chaque valeur du schéma. */
const LG_COLUMNS: Record<KpiColumns, string> = {
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};

interface KpiCardsProps {
  data: ObservatoryItem[];
  dimensions: DimensionsConfig;
  /** KPI déclarés par la config de section. */
  kpis: readonly KpiDef[];
  /** Libellés canoniques (dimensions à `keyPaths`). */
  labels?: LabelMaps;
  /** Heures réservées sur `data`, pour les KPI `reservationHours` — absentes pendant le chargement. */
  reservationHours?: ReservationHours;
  /** Réservations en cours de chargement : les KPI `reservationHours` montrent un sablier plutôt que
   *  « — », qui se lisait comme une absence de données (le chargement prend plusieurs secondes). */
  reservationHoursLoading?: boolean;
  /** Cartes par ligne dès 1024 px (`kpiColumns`) ; absent = remplissage automatique. */
  columns?: KpiColumns;
  /**
   * Densité de rendu. `cards` (défaut) = une carte par indicateur, pour une
   * page d'observatoire où le tableau de bord EST le sujet. `inline` = une
   * ligne de chiffres tabulaires, pour poser deux ou trois repères sur une page
   * dont le sujet est ailleurs (accueil, en-tête de rubrique) sans y bâtir un
   * tableau de bord.
   */
  layout?: "cards" | "inline";
}

export function KpiCards({
  data,
  dimensions,
  kpis,
  labels,
  reservationHours,
  reservationHoursLoading,
  columns,
  layout = "cards",
}: KpiCardsProps) {
  const t = useT("modules/observatoire");

  const entries = kpis.map((def, i) => ({
    key: `${def.kind}-${def.dimension ?? i}`,
    icon: def.icon ?? "activity",
    label: def.label
      ? t(def.label)
      : def.labelKey
        ? t(def.labelKey)
        : def.dimension
          ? dimensionLabel(t, dimensions, def.dimension)
          : "",
    value: computeKpiValue(def, data, dimensions, labels, reservationHours),
    loading: def.kind === "reservationHours" && Boolean(reservationHoursLoading),
    accentClasses: TOKEN_TINT_CLASSES[def.accent ?? "primary"],
  }));

  if (layout === "inline") {
    return (
      <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
        {entries.map((e) => (
          <div key={e.key} className="flex items-baseline gap-2">
            <dd className="text-2xl font-bold text-foreground tabular-nums">{e.value}</dd>
            <dt className="text-sm text-muted-foreground">{e.label}</dt>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <div
      className={`grid grid-cols-2 md:grid-cols-3 gap-4 ${columns ? LG_COLUMNS[columns] : "lg:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]"}`}
    >
      {entries.map((e) => (
        <KpiCard
          key={e.key}
          icon={e.icon}
          label={e.label}
          value={e.value}
          accentClasses={e.accentClasses}
          loading={e.loading}
          loadingLabel={t("kpiComputing")}
        />
      ))}
    </div>
  );
}
