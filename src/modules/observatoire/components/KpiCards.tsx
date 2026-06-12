import type { LucideIcon } from "lucide-react";
import {
  Activity,
  MapPin,
  Accessibility,
  Eye,
  Home,
  Trophy,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Equipment } from "../schema";
import { useT } from "@/hooks/useT";
import {
  getCommune,
  getType,
  isIndoor,
  isPmrAccessible,
  isPshsAccessible,
} from "../utils";

interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  accent?: string;
}

/** Taille de police adaptée à la longueur de la valeur. */
function valueClass(value: string): string {
  if (value.length <= 6) return "text-3xl whitespace-nowrap";
  if (value.length <= 12) return "text-2xl whitespace-nowrap";
  return "text-base leading-snug break-words";
}

function KpiCard({ icon: Icon, label, value, accent }: KpiCardProps) {
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
          <div
            className={`rounded-xl p-2.5 ${
              accent ?? "bg-primary/10 text-primary"
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface KpiCardsProps {
  data: Equipment[];
}

export function KpiCards({ data }: KpiCardsProps) {
  const t = useT("modules/observatoire");
  const total = data.length;
  const communes = new Set(
    data.map((d) => getCommune(d)).filter((v): v is string => !!v),
  ).size;
  const pmr = data.filter(isPmrAccessible).length;
  const pshs = data.filter(isPshsAccessible).length;
  const interieur = data.filter(isIndoor).length;

  const typeCounts: Record<string, number> = {};
  for (const d of data) {
    const typeVal = getType(d); // pas `t` : shadowerait le t() d'i18n
    if (!typeVal) continue;
    typeCounts[typeVal] = (typeCounts[typeVal] ?? 0) + 1;
  }
  const topType =
    Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  const pct = (n: number) =>
    total ? `${Math.round((n / total) * 100)}%` : "0%";

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <KpiCard icon={Activity} label={t("kpi.equipments")} value={String(total)} />
      <KpiCard
        icon={MapPin}
        label={t("kpi.communes")}
        value={String(communes)}
        // `text-accent` (pas `accent-foreground` : celui-ci est calibré pour un
        // bg-accent PLEIN — sur une teinte /15 il devient illisible en dark).
        accent="bg-accent/15 text-accent"
      />
      <KpiCard
        icon={Accessibility}
        label={t("kpi.pmr")}
        value={pct(pmr)}
        accent="bg-chart-2/15 text-chart-2"
      />
      <KpiCard
        icon={Eye}
        label={t("kpi.pshs")}
        value={pct(pshs)}
        accent="bg-chart-4/15 text-chart-4"
      />
      <KpiCard
        icon={Home}
        label={t("kpi.indoor")}
        value={`${interieur} / ${total - interieur}`}
        accent="bg-chart-3/15 text-chart-3"
      />
      <KpiCard
        icon={Trophy}
        label={t("kpi.topType")}
        value={topType}
        accent="bg-chart-5/15 text-chart-5"
      />
    </div>
  );
}
