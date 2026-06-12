import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import type { ReactNode } from "react";
import type { Equipment } from "../schema";
import { useT } from "@/hooks/useT";
import {
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

// Palette catégorielle distincte (qualitative) — assez contrastée sur fond sombre.
const CATEGORICAL_COLORS = [
  "#22d3ee", // cyan
  "#f97316", // orange
  "#a78bfa", // violet
  "#facc15", // jaune
  "#34d399", // vert menthe
  "#f472b6", // rose
  "#60a5fa", // bleu
  "#fb7185", // rouge corail
  "#4ade80", // vert
  "#fbbf24", // ambre
  "#c084fc", // mauve
  "#2dd4bf", // teal
  "#fda4af", // rose pâle
  "#818cf8", // indigo
  "#84cc16", // lime
  "#f59e0b", // amber foncé
  "#ec4899", // pink
  "#10b981", // emerald
  "#0ea5e9", // sky
  "#eab308", // gold
] as const;

// Palette spécifique nature (Intérieur / Extérieur / Site naturel...)
const NATURE_COLORS: Record<string, string> = {
  "Découvert": "#f97316",
  "Intérieur": "#a78bfa",
  "Site naturel": "#22c55e",
  "Site naturel aménagé": "#0ea5e9",
  "Donnée non renseignée": "#64748b",
};

function natureColor(name: string, fallbackIndex: number): string {
  return NATURE_COLORS[name] ?? CATEGORICAL_COLORS[fallbackIndex % CATEGORICAL_COLORS.length];
}

const tooltipStyle = {
  backgroundColor: "#1e293b",
  border: "1px solid #334155",
  borderRadius: 12,
  fontSize: 12,
  color: "#f8fafc",
} as const;

const tooltipItemStyle = { color: "#f8fafc" } as const;
const tooltipLabelStyle = { color: "#f8fafc" } as const;

interface ChartCardProps {
  title: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

function ChartCard({ title, children, className, bodyClassName }: ChartCardProps) {
  return (
    <div
      className={`rounded-2xl bg-card p-5 shadow-sm border border-border/50 ${className ?? ""}`}
    >
      <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
      <div className={bodyClassName ?? "h-72"}>{children}</div>
    </div>
  );
}

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
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={items}
            dataKey="value"
            nameKey="name"
            outerRadius={140}
            innerRadius={70}
            paddingAngle={1}
          >
            {items.map((item, i) => (
              <Cell key={item.name} fill={CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            wrapperStyle={{ fontSize: 11, maxWidth: "45%", maxHeight: "100%", overflowY: "auto" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function NatureChart({ data }: ChartProps) {
  const t = useT("modules/observatoire");
  const items = countBy(data, getNature).sort((a, b) => b.value - a.value);
  return (
    <ChartCard title={t("charts.indoorOutdoor")}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={items} dataKey="value" nameKey="name" outerRadius={100}>
            {items.map((it, i) => (
              <Cell key={i} fill={natureColor(it.name, i)} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
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
      <ResponsiveContainer>
        <BarChart data={items}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          />
          <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} cursor={{ fill: "var(--muted)" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey={yesKey} stackId="a" fill="#22c55e" />
          <Bar
            dataKey={noKey}
            stackId="a"
            fill="#ef4444"
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function CommuneChart({ data }: ChartProps) {
  const t = useT("modules/observatoire");
  const items = countBy(data, getCommune).sort((a, b) => b.value - a.value);
  return (
    <ChartCard title={t("charts.byCommune")} bodyClassName="h-[420px]">
      <ResponsiveContainer>
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
          <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} cursor={{ fill: "var(--muted)" }} />
          <Bar dataKey="value" fill="#22d3ee" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
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
      <ResponsiveContainer>
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
          <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} cursor={{ fill: "var(--muted)" }} />
          <Bar dataKey="value" fill="#22d3ee" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function EpciChart({ data }: ChartProps) {
  const t = useT("modules/observatoire");
  const items = countBy(data, getEpci).sort((a, b) => b.value - a.value);
  return (
    <ChartCard title={t("charts.byEpci")}>
      <ResponsiveContainer>
        <BarChart data={items}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} cursor={{ fill: "var(--muted)" }} />
          <Bar dataKey="value" fill="var(--chart-3)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
