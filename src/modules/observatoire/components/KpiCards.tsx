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
}

export function KpiCards({ data, dimensions, kpis, labels }: KpiCardsProps) {
  const t = useT("modules/observatoire");

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 lg:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
      {kpis.map((def, i) => {
        const label = def.label
          ? t(def.label)
          : def.labelKey
            ? t(def.labelKey)
            : def.dimension
              ? dimensionLabel(t, dimensions, def.dimension)
              : "";
        return (
          <KpiCard
            key={`${def.kind}-${def.dimension ?? i}`}
            icon={def.icon ?? "activity"}
            label={label}
            value={computeKpiValue(def, data, dimensions, labels)}
            accentClasses={TOKEN_TINT_CLASSES[def.accent ?? "primary"]}
          />
        );
      })}
    </div>
  );
}
