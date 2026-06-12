import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { useT } from "@/hooks/useT";
import type { DimensionsConfig, Equipment, KpiDef } from "../schema";
import {
  TOKEN_TINT_CLASSES,
  dimensionBool,
  dimensionLabel,
  dimensionValue,
} from "../dimensions";
import { countBy } from "../utils";

/** Taille de police adaptée à la longueur de la valeur. */
function valueClass(value: string): string {
  if (value.length <= 6) return "text-3xl whitespace-nowrap";
  if (value.length <= 12) return "text-2xl whitespace-nowrap";
  return "text-base leading-snug break-words";
}

/** Calcule la valeur d'un KPI déclaratif (formes : count/distinct/percentTrue/valueSplit/top). */
function computeKpiValue(
  def: KpiDef,
  data: Equipment[],
  dims: DimensionsConfig,
): string {
  const total = data.length;
  const dim = def.dimension ? dims[def.dimension] : undefined;
  switch (def.kind) {
    case "count":
      return String(total);
    case "distinct": {
      if (!dim) return "—";
      const set = new Set(
        data.map((d) => dimensionValue(d, dim)).filter(Boolean),
      );
      return String(set.size);
    }
    case "percentTrue": {
      if (!dim) return "—";
      const n = data.filter((d) => dimensionBool(d, dim)).length;
      return total ? `${Math.round((n / total) * 100)}%` : "0%";
    }
    case "valueSplit": {
      if (!dim || !def.value) return "—";
      const n = data.filter((d) => dimensionValue(d, dim) === def.value).length;
      return `${n} / ${total - n}`;
    }
    case "top": {
      if (!dim) return "—";
      const counts = countBy(data, (d) => dimensionValue(d, dim));
      return counts.sort((a, b) => b.value - a.value)[0]?.name ?? "—";
    }
  }
}

interface KpiCardProps {
  icon: string;
  label: string;
  value: string;
  accentClasses: string;
}

function KpiCard({ icon, label, value, accentClasses }: KpiCardProps) {
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
  data: Equipment[];
  dimensions: DimensionsConfig;
  /** KPI déclarés (config ou preset RES). */
  kpis: readonly KpiDef[];
}

export function KpiCards({ data, dimensions, kpis }: KpiCardsProps) {
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
            value={computeKpiValue(def, data, dimensions)}
            accentClasses={TOKEN_TINT_CLASSES[def.accent ?? "primary"]}
          />
        );
      })}
    </div>
  );
}
