import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { useT } from "@/hooks/useT";
import type { DimensionsConfig, ObservatoryItem, KpiDef } from "../schema";
import { TOKEN_TINT_CLASSES, dimensionLabel, type LabelMaps } from "../dimensions";
import { computeKpiValue } from "../dashboard";

/** Taille de police adaptée à la longueur de la valeur. */
function valueClass(value: string): string {
  if (value.length <= 6) return "text-3xl whitespace-nowrap";
  if (value.length <= 12) return "text-2xl whitespace-nowrap";
  return "text-base leading-snug break-words";
}

interface KpiCardProps {
  icon: string;
  label: string;
  value: string;
  accentClasses: string;
}

// Exporté : réutilisé par la modal installation (même look de carte KPI).
export function KpiCard({ icon, label, value, accentClasses }: KpiCardProps) {
  return (
    <Card className="gap-0 rounded-2xl border-border/50 py-5 hover:shadow-md transition-shadow min-w-0">
      <CardContent className="px-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              {label}
            </p>
            <p className={`mt-2 font-bold text-foreground tabular-nums ${valueClass(value)}`}>
              {value}
            </p>
          </div>
          <div className={`rounded-xl p-2.5 ${accentClasses}`}>
            <DynamicIcon name={icon as IconName} className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface KpiCardsProps {
  data: ObservatoryItem[];
  dimensions: DimensionsConfig;
  /** KPI déclarés par la config de section. */
  kpis: readonly KpiDef[];
  /** Libellés canoniques (dimensions à `keyPaths`). */
  labels?: LabelMaps;
  /**
   * Densité de rendu. `cards` (défaut) = une carte par indicateur, pour une
   * page d'observatoire où le tableau de bord EST le sujet. `inline` = une
   * ligne de chiffres tabulaires, pour poser deux ou trois repères sur une page
   * dont le sujet est ailleurs (accueil, en-tête de rubrique) sans y bâtir un
   * tableau de bord.
   */
  layout?: "cards" | "inline";
}

export function KpiCards({ data, dimensions, kpis, labels, layout = "cards" }: KpiCardsProps) {
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
    value: computeKpiValue(def, data, dimensions, labels),
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
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 lg:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
      {entries.map((e) => (
        <KpiCard
          key={e.key}
          icon={e.icon}
          label={e.label}
          value={e.value}
          accentClasses={e.accentClasses}
        />
      ))}
    </div>
  );
}
