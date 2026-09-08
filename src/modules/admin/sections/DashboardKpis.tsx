import { useMemo, type ReactNode } from "react";
import { ChartLine, Database, Minus, TrendingDown, TrendingUp, Users } from "lucide-react";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { Link } from "react-router";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";
import { useEntityMembers } from "@/modules/profil/hooks/useMembersQuery";
import { useSearchAllResults } from "@/modules/search/hooks/useSearchAllResults";
import "@/modules/admin/i18n";

import { ADMIN_QUERY_KEYS } from "../constants/queryKeys";
import { computeMonthlyTrend } from "../lib/kpiTrend";
import type { AdminDashboardKpi } from "../schema";

/**
 * Tuiles KPI DÉCLARÉES du dashboard (`section.kpis` — cf. AdminDashboardKpiSchema).
 * Rendues dans la MÊME grille que les tuiles dérivées, avec la même anatomie de Card
 * (titre + icône / valeur / ligne secondaire) pour rester un seul système visuel.
 */

type SearchCountKpi = Extract<AdminDashboardKpi, { type: "searchCount" }>;

/** Lecture défensive de `serverData.created` sur un item de recherche (shape non typé côté transform). */
const createdOf = (item: unknown): unknown =>
  item && typeof item === "object" ? (item as { serverData?: { created?: unknown } }).serverData?.created : null;

function KpiTileShell({
  kpi,
  fallbackIcon,
  children,
}: {
  kpi: AdminDashboardKpi;
  fallbackIcon: ReactNode;
  children: ReactNode;
}) {
  const t = useT();
  const card = (
    <Card className={kpi.linkTo ? "h-full cursor-pointer transition-colors hover:bg-muted/40" : "h-full"}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{t(kpi.label)}</CardTitle>
        {kpi.icon ? <DynamicIcon name={kpi.icon as IconName} className="h-4 w-4 text-muted-foreground" /> : fallbackIcon}
      </CardHeader>
      <CardContent>
        {children}
        {kpi.hint && <p className="mt-1 text-xs text-muted-foreground">{t(kpi.hint)}</p>}
      </CardContent>
    </Card>
  );
  if (!kpi.linkTo) return card;
  return (
    <Link to={kpi.linkTo} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      {card}
    </Link>
  );
}

function KpiSearchCountTile({ kpi, index }: { kpi: SearchCountKpi; index: number }) {
  const tAdmin = useT("modules/admin");
  const wantTrend = kpi.trend === "monthly";
  const { total, results, isComplete, isLoading } = useSearchAllResults({
    queryKeyPrefix: ADMIN_QUERY_KEYS.KPI_SEARCH_PREFIX(index, kpi.entityType),
    searchType: { type: [kpi.entityType] },
    baseParams: kpi.source ?? {},
    // Sans tendance, inutile d'aspirer le périmètre : le total vient du count de la 1ʳᵉ page.
    ...(wantTrend ? {} : { maxResults: 1 }),
  });

  // Tendance calculée UNIQUEMENT sur périmètre complet (un partiel biaiserait les compteurs).
  const trend = useMemo(
    () => (wantTrend && isComplete ? computeMonthlyTrend(results.map(createdOf), new Date()) : null),
    [wantTrend, isComplete, results],
  );

  const TrendIcon = trend && trend.delta > 0 ? TrendingUp : trend && trend.delta < 0 ? TrendingDown : Minus;
  const trendClass =
    trend && trend.delta > 0
      ? "text-emerald-700 dark:text-emerald-400"
      : trend && trend.delta < 0
        ? "text-red-700 dark:text-red-400"
        : "text-muted-foreground";

  return (
    <KpiTileShell kpi={kpi} fallbackIcon={<Database className="h-4 w-4 text-muted-foreground" />}>
      {isLoading && total == null ? (
        <Skeleton className="h-8 w-16" />
      ) : (
        <span className="text-2xl font-bold">{total ?? "—"}</span>
      )}
      {trend && (
        <p className={`mt-1 flex items-center gap-1 text-xs ${trendClass}`}>
          <TrendIcon className="h-3 w-3" />
          {tAdmin("DashboardKpis.trendMonthly", undefined, {
            added: String(trend.addedThisMonth),
            delta: `${trend.delta > 0 ? "+" : ""}${trend.delta}`,
          })}
        </p>
      )}
    </KpiTileShell>
  );
}

function KpiMembersPendingTile({ kpi }: { kpi: AdminDashboardKpi }) {
  const tAdmin = useT("modules/admin");
  const { entity } = useCocolight();
  const pending = useEntityMembers(entity, { toBeValidated: true });

  return (
    <KpiTileShell kpi={kpi} fallbackIcon={<Users className="h-4 w-4 text-muted-foreground" />}>
      {pending.isLoading ? (
        <Skeleton className="h-8 w-16" />
      ) : (
        <span className="text-2xl font-bold">{pending.totalCount ?? 0}</span>
      )}
      <p className="mt-1 text-xs text-muted-foreground">{tAdmin("DashboardKpis.membersPending")}</p>
    </KpiTileShell>
  );
}

function KpiAnalyticsTile({ kpi }: { kpi: AdminDashboardKpi }) {
  const tAdmin = useT("modules/admin");
  return (
    <KpiTileShell kpi={kpi} fallbackIcon={<ChartLine className="h-4 w-4 text-muted-foreground" />}>
      <span className="text-2xl font-bold text-muted-foreground">—</span>
      {/* Pas de source de mesure d'audience raccordée : état explicite, jamais un chiffre inventé. */}
      {!kpi.hint && <p className="mt-1 text-xs text-muted-foreground">{tAdmin("DashboardKpis.analyticsPending")}</p>}
    </KpiTileShell>
  );
}

export function DashboardKpis({ kpis }: { kpis: readonly AdminDashboardKpi[] }) {
  return (
    <>
      {kpis.map((kpi, index) => {
        const key = `kpi-${index}-${kpi.type}`;
        if (kpi.type === "searchCount") return <KpiSearchCountTile key={key} kpi={kpi} index={index} />;
        if (kpi.type === "membersPending") return <KpiMembersPendingTile key={key} kpi={kpi} />;
        return <KpiAnalyticsTile key={key} kpi={kpi} />;
      })}
    </>
  );
}
