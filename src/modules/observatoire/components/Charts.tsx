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
import { dimensionBool, dimensionLabel } from "../dimensions";
import { chartRows, chartTitle, colorFor, itemsFor } from "../dashboard";

type T = ReturnType<typeof useT>;

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

/** Curseur pointeur sur les secteurs/barres quand le drill-down est actif. */
const DRILL_CLASS = "[&_.recharts-sector]:cursor-pointer [&_.recharts-bar-rectangle]:cursor-pointer";

/** Extrait la valeur cliquée d'un évènement recharts (Pie sector ou Bar). */
function clickedName(entry: unknown): string | undefined {
  const e = entry as { name?: unknown; payload?: { name?: unknown } } | undefined;
  const name = e?.name ?? e?.payload?.name;
  return typeof name === "string" ? name : undefined;
}

interface RendererProps {
  def: ChartDef;
  data: ObservatoryItem[];
  dims: DimensionsConfig;
  t: T;
  /** Animations recharts — coupées pendant le chargement progressif (sinon
   *  les 5 graphes re-animent à CHAQUE page de 500 qui arrive). */
  animate: boolean;
  /** Drill-down (opt-in config) : clic sur une part/barre → applique le
   *  filtre de la dimension. Non défini = désactivé. */
  onDrill?: (dimensionId: string, value: string) => void;
}

/* ── Formes de rendu ─────────────────────────────────────────────────────── */

function DonutChart({ def, data, dims, t, animate, onDrill }: RendererProps) {
  const items = itemsFor(def, data, dims);
  const drill = onDrill && def.dimension
    ? (entry: unknown) => { const v = clickedName(entry); if (v) onDrill(def.dimension!, v); }
    : undefined;
  return (
    <ChartCard title={chartTitle(def, dims, t)} bodyClassName="h-[420px]">
      <ChartContainer config={{}} className={`${CHART_CONTAINER_CLASS} ${drill ? DRILL_CLASS : ""}`}>
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
            isAnimationActive={animate}
            onClick={drill}
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

function SimplePieChart({ def, data, dims, t, animate, onDrill }: RendererProps) {
  const items = itemsFor(def, data, dims);
  const drill = onDrill && def.dimension
    ? (entry: unknown) => { const v = clickedName(entry); if (v) onDrill(def.dimension!, v); }
    : undefined;
  return (
    <ChartCard title={chartTitle(def, dims, t)}>
      <ChartContainer config={{}} className={`${CHART_CONTAINER_CLASS} ${drill ? DRILL_CLASS : ""}`}>
        <PieChart>
          <Pie data={items} dataKey="value" nameKey="name" outerRadius="70%" isAnimationActive={animate} onClick={drill}>
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

function BarsChart({ def, data, dims, t, animate, onDrill }: RendererProps) {
  const items = itemsFor(def, data, dims);
  const drill = onDrill && def.dimension
    ? (entry: unknown) => { const v = clickedName(entry); if (v) onDrill(def.dimension!, v); }
    : undefined;
  return (
    <ChartCard title={chartTitle(def, dims, t)} bodyClassName="h-[420px]">
      <ChartContainer config={{}} className={`${CHART_CONTAINER_CLASS} ${drill ? DRILL_CLASS : ""}`}>
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
          <Bar dataKey="value" fill="var(--chart-1)" radius={[6, 6, 0, 0]} isAnimationActive={animate} onClick={drill} />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}

function BarsHorizontalChart({ def, data, dims, t, animate, onDrill }: RendererProps) {
  const items = itemsFor(def, data, dims).slice(0, def.top ?? 10);
  const drill = onDrill && def.dimension
    ? (entry: unknown) => { const v = clickedName(entry); if (v) onDrill(def.dimension!, v); }
    : undefined;
  return (
    <ChartCard title={chartTitle(def, dims, t)} bodyClassName="h-[440px]">
      <ChartContainer config={{}} className={`${CHART_CONTAINER_CLASS} ${drill ? DRILL_CLASS : ""}`}>
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
          <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 6, 6, 0]} isAnimationActive={animate} onClick={drill} />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}

/** Oui/non empilés pour N dimensions anyTrue (ex. PMR / PSHS / Handi). */
function BooleanGroupsChart({ def, data, dims, t, animate }: RendererProps) {
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
          <Bar dataKey={yesKey} stackId="a" fill="var(--chart-2)" isAnimationActive={animate} />
          <Bar dataKey={noKey} stackId="a" fill="var(--destructive)" radius={[6, 6, 0, 0]} isAnimationActive={animate} />
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
  animate?: boolean;
  onDrill?: (dimensionId: string, value: string) => void;
}

/**
 * Compose les graphes déclarés : les `layout: "half"` consécutifs sont
 * appairés en 2 colonnes (lg), les `full` occupent leur rangée.
 */
export function ObservatoryCharts({ charts, data, dimensions, animate = true, onDrill }: ObservatoryChartsProps) {
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
                {render({ def, data, dims: dimensions, t, animate, onDrill })}
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}
