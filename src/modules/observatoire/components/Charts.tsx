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
import type { Equipment } from "../schema";
import {
  NATURE_VALUES,
  countBy,
  getCommune,
  getEpci,
  getNature,
  getType,
  isPmrAccessible,
  isPshsAccessible,
  isTrue,
  normalizeAps,
} from "../utils";

// Palette catégorielle issue du THÈME du site (config.theme → --chart-1..5),
// cyclée pour les séries longues — jamais d'hex en dur : les couleurs doivent
// suivre le thème light/dark de chaque site (cf. doc/22 theming).
const CATEGORICAL_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

// Palette spécifique nature (vocabulaire RES centralisé dans utils) — mappée
// sur les tokens de thème ; « Donnée non renseignée » reste neutre. Même
// correspondance chart-1..4 que les badges d'EquipmentTable.
const NATURE_COLORS: Record<string, string> = {
  [NATURE_VALUES.OUTDOOR]: "var(--chart-2)",
  [NATURE_VALUES.INDOOR]: "var(--chart-1)",
  [NATURE_VALUES.NATURAL]: "var(--chart-3)",
  [NATURE_VALUES.NATURAL_DEVELOPED]: "var(--chart-4)",
  [NATURE_VALUES.UNKNOWN]: "var(--muted-foreground)",
};

function natureColor(name: string, fallbackIndex: number): string {
  return NATURE_COLORS[name] ?? CATEGORICAL_COLORS[fallbackIndex % CATEGORICAL_COLORS.length];
}

interface ChartCardProps {
  title: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/** Carte de graphe — shadcn Card + hauteur du corps pilotée par le graphe. */
function ChartCard({ title, children, className, bodyClassName }: ChartCardProps) {
  return (
    <Card className={`gap-0 rounded-2xl border-border/50 py-5 ${className ?? ""}`}>
      <CardContent className="px-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
        <div className={bodyClassName ?? "h-72"}>{children}</div>
      </CardContent>
    </Card>
  );
}

/** ChartContainer plein-cadre (le parent fixe la hauteur) — tooltip/axes thémés. */
const CHART_CONTAINER_CLASS = "h-full w-full aspect-auto";

interface ChartProps {
  data: Equipment[];
}

export function TypeChart({ data }: ChartProps) {
  const t = useT("modules/observatoire");
  const items = countBy(data, getType).sort((a, b) => b.value - a.value);
  return (
    <ChartCard
      title={t("charts.byType")}
      bodyClassName="h-[420px]"
    >
      <ChartContainer config={{}} className={CHART_CONTAINER_CLASS}>
        <PieChart>
          {/* Rayons en POURCENTAGES (pas en px fixes) : avec la légende
              verticale qui prend jusqu'à 45 % de la largeur, un rayon fixe
              de 140px débordait/clippait le camembert sur mobile. */}
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

export function NatureChart({ data }: ChartProps) {
  const t = useT("modules/observatoire");
  const items = countBy(data, getNature).sort((a, b) => b.value - a.value);
  return (
    <ChartCard title={t("charts.indoorOutdoor")}>
      <ChartContainer config={{}} className={CHART_CONTAINER_CLASS}>
        <PieChart>
          <Pie data={items} dataKey="value" nameKey="name" outerRadius="70%">
            {items.map((it, i) => (
              <Cell key={it.name} fill={natureColor(it.name, i)} />
            ))}
          </Pie>
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ChartContainer>
    </ChartCard>
  );
}

export function AccessibilityChart({ data }: ChartProps) {
  const t = useT("modules/observatoire");
  const total = data.length;
  const pmrYes = data.filter(isPmrAccessible).length;
  const pshsYes = data.filter(isPshsAccessible).length;
  const handi = data.filter((d) => isTrue(d.inst_acc_handi_bool)).length;
  const items = [
    { name: t("charts.accessibilityPmr"), [t("charts.accessibilityYes")]: pmrYes, [t("charts.accessibilityNo")]: total - pmrYes },
    { name: t("charts.accessibilityPshs"), [t("charts.accessibilityYes")]: pshsYes, [t("charts.accessibilityNo")]: total - pshsYes },
    { name: t("charts.accessibilityHandi"), [t("charts.accessibilityYes")]: handi, [t("charts.accessibilityNo")]: total - handi },
  ];
  const yesKey = t("charts.accessibilityYes");
  const noKey = t("charts.accessibilityNo");
  return (
    <ChartCard title={t("charts.accessibility")}>
      <ChartContainer config={{}} className={CHART_CONTAINER_CLASS}>
        <BarChart data={items}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          />
          <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "var(--muted)" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey={yesKey} stackId="a" fill="var(--chart-2)" />
          <Bar
            dataKey={noKey}
            stackId="a"
            fill="var(--destructive)"
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}

export function CommuneChart({ data }: ChartProps) {
  const t = useT("modules/observatoire");
  const items = countBy(data, getCommune).sort((a, b) => b.value - a.value);
  return (
    <ChartCard title={t("charts.byCommune")} bodyClassName="h-[420px]">
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

export function ApsChart({ data }: ChartProps) {
  const t = useT("modules/observatoire");
  const counts: Record<string, number> = {};
  for (const d of data) {
    for (const a of normalizeAps(d.aps_name)) {
      counts[a] = (counts[a] ?? 0) + 1;
    }
  }
  const items = Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
  return (
    <ChartCard
      title={t("charts.topAps")}
      bodyClassName="h-[440px]"
    >
      <ChartContainer config={{}} className={CHART_CONTAINER_CLASS}>
        <BarChart data={items} layout="vertical" margin={{ left: 30, top: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
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

export function EpciChart({ data }: ChartProps) {
  const t = useT("modules/observatoire");
  const items = countBy(data, getEpci).sort((a, b) => b.value - a.value);
  return (
    <ChartCard title={t("charts.byEpci")}>
      <ChartContainer config={{}} className={CHART_CONTAINER_CLASS}>
        <BarChart data={items}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "var(--muted)" }} />
          <Bar dataKey="value" fill="var(--chart-3)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}
