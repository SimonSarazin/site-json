import { PieChart, Pie, Cell, Legend } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useT } from "@/hooks/useT";
import { ChartCard } from "../Charts";
import { CATEGORICAL_COLORS } from "../../dashboard";

interface ActivityDonutProps {
  /** `{name, value}` déjà triés (cf. `activityDistribution`). */
  items: Array<{ name: string; value: number }>;
  metric: "hours" | "slots";
  loading: boolean;
}

/** Dimensions avant 1ʳᵉ mesure / SSR — alignées sur la hauteur du corps
 *  (h-72) ; la largeur est recalée par le ResizeObserver de ChartContainer. */
const INITIAL_DIMENSION = { width: 600, height: 288 };

/**
 * Répartition des activités de l'installation en donut recharts. `ChartCard`
 * apporte le `ClientOnly` + Skeleton SSR-safe (recharts ne s'hydrate pas) ;
 * couleurs = tokens de thème (`CATEGORICAL_COLORS`).
 */
export function ActivityDonut({ items, metric, loading }: ActivityDonutProps) {
  const t = useT("modules/observatoire");
  const title = t("installation.activityChart.title");

  if (loading) {
    return (
      <ChartCard title={title}>
        <Skeleton className="h-full w-full rounded-md" />
      </ChartCard>
    );
  }

  if (items.length === 0) {
    return (
      <ChartCard title={title}>
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          {t("installation.activityChart.empty")}
        </div>
      </ChartCard>
    );
  }

  const unit = t(`installation.activityChart.unit.${metric}`);

  return (
    <ChartCard title={`${title} (${unit})`}>
      <ChartContainer config={{}} className="h-full w-full aspect-auto" initialDimension={INITIAL_DIMENSION}>
        <PieChart>
          <Pie
            data={items}
            dataKey="value"
            nameKey="name"
            outerRadius="75%"
            innerRadius="45%"
            paddingAngle={1}
          >
            {items.map((item, i) => (
              <Cell key={item.name} fill={CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]} />
            ))}
          </Pie>
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            wrapperStyle={{ fontSize: 11, maxWidth: "45%", maxHeight: "100%", overflowY: "auto" }}
          />
        </PieChart>
      </ChartContainer>
    </ChartCard>
  );
}
