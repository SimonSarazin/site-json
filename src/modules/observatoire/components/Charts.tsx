import type { ReactNode } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useT } from "@/hooks/useT";
import type { ChartDef, DimensionsConfig, ObservatoryItem } from "../schema";
import {
  TOKEN_CSS_VARS,
  dimensionBool,
  dimensionLabel,
  dimensionList,
  dimensionValue,
} from "../dimensions";
import { countBy } from "../utils";

type T = ReturnType<typeof useT>;

// Palette catégorielle issue du THÈME du site (config.theme → --chart-1..5),
// cyclée pour les séries longues — jamais d'hex : les couleurs suivent le
// thème light/dark de chaque site.
const CATEGORICAL_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

/** Couleur d'une valeur : map déclarée (jeton → var) sinon cycle catégoriel. */
export function colorFor(def: ChartDef, name: string, fallbackIndex: number): string {
  const token = def.colors?.[name];
  if (token && TOKEN_CSS_VARS[token]) return TOKEN_CSS_VARS[token];
  return CATEGORICAL_COLORS[fallbackIndex % CATEGORICAL_COLORS.length];
}

/** Décomptes {name, value} triés décroissants pour une dimension. Exporté pur pour test. */
export function itemsFor(
  def: ChartDef,
  data: ObservatoryItem[],
  dims: DimensionsConfig,
): Array<{ name: string; value: number }> {
  const dim = def.dimension ? dims[def.dimension] : undefined;
  if (!dim) return [];
  const counts =
    dim.kind === "list"
      ? countBy(data.flatMap((d) => dimensionList(d, dim)), (v) => v)
      : countBy(data, (d) => dimensionValue(d, dim));
  return counts.sort((a, b) => b.value - a.value);
}

export function chartTitle(def: ChartDef, dims: DimensionsConfig, t: T): string {
  if (def.label) return t(def.label);
  if (def.labelKey) return t(def.labelKey);
  if (def.dimension) return dimensionLabel(t, dims, def.dimension);
  return "";
}

interface ChartCardProps {
  title: string;
  children: ReactNode;
  bodyClassName?: string;
}

/** Carte de graphe — shadcn Card + hauteur du corps pilotée par le graphe. */
function ChartCard({ title, children, bodyClassName }: ChartCardProps) {
  return (
    <Card className="gap-0 rounded-2xl border-border/50 py-5">
      <CardContent className="px-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
        <div className={bodyClassName ?? "h-72"}>{children}</div>
      </CardContent>
    </Card>
  );
}

/** ChartContainer plein-cadre (le parent fixe la hauteur) — tooltip/axes thémés. */
const CHART_CONTAINER_CLASS = "h-full w-full aspect-auto";

interface RendererProps {
  def: ChartDef;
  data: ObservatoryItem[];
  dims: DimensionsConfig;
  t: T;
}

/* ── Formes de rendu ─────────────────────────────────────────────────────── */

function DonutChart({ def, data, dims, t }: RendererProps) {
  const items = itemsFor(def, data, dims);
  return (
    <ChartCard title={chartTitle(def, dims, t)} bodyClassName="h-[420px]">
      <ChartContainer config={{}} className={CHART_CONTAINER_CLASS}>
        <PieChart>
          {/* Rayons en POURCENTAGES (pas en px fixes) : avec la légende
              verticale (jusqu'à 45 % de largeur), un rayon fixe clippe sur
              mobile. */}
          <Pie
            data={items}
            dataKey="value"
            nameKey="name"
            outerRadius="75%"
            innerRadius="45%"
            paddingAngle={1}
          >
            {items.map((item, i) => (
              <Cell key={item.name} fill={colorFor(def, item.name, i)} />
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

function SimplePieChart({ def, data, dims, t }: RendererProps) {
  const items = itemsFor(def, data, dims);
  return (
    <ChartCard title={chartTitle(def, dims, t)}>
      <ChartContainer config={{}} className={CHART_CONTAINER_CLASS}>
        <PieChart>
          <Pie data={items} dataKey="value" nameKey="name" outerRadius="70%">
            {items.map((it, i) => (
              <Cell key={it.name} fill={colorFor(def, it.name, i)} />
            ))}
          </Pie>
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ChartContainer>
    </ChartCard>
  );
}

function BarsChart({ def, data, dims, t }: RendererProps) {
  const items = itemsFor(def, data, dims);
  return (
    <ChartCard title={chartTitle(def, dims, t)} bodyClassName="h-[420px]">
      <ChartContainer config={{}} className={CHART_CONTAINER_CLASS}>
        <BarChart data={items} margin={{ left: -10, bottom: 80 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="name"
            angle={-45}
            textAnchor="end"
            interval={0}
            height={90}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          />
          <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "var(--muted)" }} />
          <Bar dataKey="value" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}

function BarsHorizontalChart({ def, data, dims, t }: RendererProps) {
  const items = itemsFor(def, data, dims).slice(0, def.top ?? 10);
  return (
    <ChartCard title={chartTitle(def, dims, t)} bodyClassName="h-[440px]">
      <ChartContainer config={{}} className={CHART_CONTAINER_CLASS}>
        <BarChart data={items} layout="vertical" margin={{ left: 30, top: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <YAxis
            dataKey="name"
            type="category"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            width={160}
            interval={0}
          />
          <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "var(--muted)" }} />
          <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}

/** Oui/non empilés pour N dimensions anyTrue (ex. PMR / PSHS / Handi). */
function BooleanGroupsChart({ def, data, dims, t }: RendererProps) {
  const total = data.length;
  const yesKey = t("charts.yes");
  const noKey = t("charts.no");
  const items = (def.dimensions ?? [])
    .filter((id) => dims[id])
    .map((id) => {
      const yes = data.filter((d) => dimensionBool(d, dims[id])).length;
      return {
        name: dimensionLabel(t, dims, id),
        [yesKey]: yes,
        [noKey]: total - yes,
      };
    });
  return (
    <ChartCard title={chartTitle(def, dims, t)}>
      <ChartContainer config={{}} className={CHART_CONTAINER_CLASS}>
        <BarChart data={items}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
          <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "var(--muted)" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey={yesKey} stackId="a" fill="var(--chart-2)" />
          <Bar dataKey={noKey} stackId="a" fill="var(--destructive)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}

const RENDERERS: Record<ChartDef["kind"], (p: RendererProps) => ReactNode> = {
  donut: (p) => <DonutChart {...p} />,
  pie: (p) => <SimplePieChart {...p} />,
  bars: (p) => <BarsChart {...p} />,
  barsHorizontal: (p) => <BarsHorizontalChart {...p} />,
  booleanGroups: (p) => <BooleanGroupsChart {...p} />,
};

interface ObservatoryChartsProps {
  charts: readonly ChartDef[];
  data: ObservatoryItem[];
  dimensions: DimensionsConfig;
}

/**
 * Compose les graphes déclarés : les `layout: "half"` consécutifs sont
 * appairés en 2 colonnes (lg), les `full` occupent leur rangée.
 */
/** Appairage par layout : les `half` consécutifs vont par deux, les `full`
 *  occupent leur rangée. Exporté pur pour test. */
export function chartRows(charts: readonly ChartDef[]): ChartDef[][] {
  const rows: ChartDef[][] = [];
  for (const def of charts) {
    const last = rows[rows.length - 1];
    if (
      def.layout === "half" &&
      last?.length === 1 &&
      last[0].layout === "half"
    ) {
      last.push(def);
    } else {
      rows.push([def]);
    }
  }
  return rows;
}

export function ObservatoryCharts({ charts, data, dimensions }: ObservatoryChartsProps) {
  const t = useT("modules/observatoire");
  const rows = chartRows(charts);

  return (
    <>
      {rows.map((row, i) => (
        <div
          key={i}
          className={row.length === 2 ? "grid grid-cols-1 lg:grid-cols-2 gap-4" : "grid grid-cols-1"}
        >
          {row.map((def, j) => {
            const render = RENDERERS[def.kind];
            return (
              <div key={`${def.kind}-${def.dimension ?? j}`} className="min-w-0">
                {render({ def, data, dims: dimensions, t })}
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}
