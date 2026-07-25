import type { SearchEntity } from "@communecter/cocolight-api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/hooks/useT";
import {
  formatHours,
  utilizationRate,
  type EquipmentUsage,
} from "../../installation";

interface EquipmentUtilizationListProps {
  pois: SearchEntity[];
  usage: Map<string, EquipmentUsage>;
  /** Amplitude hebdo de référence (minutes) — dénominateur du taux. */
  amplitudeMinutes: number;
  loading: boolean;
}

/**
 * Jauge de taux d'utilisation par équipement (taux = heures occupées/semaine
 * ÷ amplitude de référence). Les équipements sans créneau restent listés à
 * 0 % ; la jauge est clampée à 100 mais le pourcentage réel est affiché.
 */
export function EquipmentUtilizationList({
  pois,
  usage,
  amplitudeMinutes,
  loading,
}: EquipmentUtilizationListProps) {
  const t = useT("modules/observatoire");

  const rows = pois
    .map((poi) => {
      const id = (poi as { id?: string }).id ?? "";
      const sd = poi.serverData as { name?: string } | undefined;
      const u = usage.get(id) ?? {
        reservedMinutes: 0,
        occupiedMinutes: 0,
        slotCount: 0,
        activities: [],
      };
      return {
        id,
        name: sd?.name ?? "—",
        usage: u,
        rate: utilizationRate(u.occupiedMinutes, amplitudeMinutes),
      };
    })
    .sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name, "fr"));

  return (
    <Card className="gap-0 rounded-2xl border-border/50 py-5">
      <CardContent className="space-y-4 px-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {t("installation.gauges.title")}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("installation.gauges.reference", undefined, {
              hours: formatHours(amplitudeMinutes),
            })}
          </p>
        </div>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-3/4" />
          </div>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-medium text-foreground">{row.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {t("installation.gauges.hoursPerWeek", undefined, {
                    hours: formatHours(row.usage.occupiedMinutes),
                  })}
                  {" · "}
                  {Math.round(row.rate * 100)}%
                </span>
              </div>
              {/* Jauge clampée à 100 — la valeur réelle (possiblement > 100 %)
                  reste affichée en texte. */}
              <Progress value={Math.min(100, row.rate * 100)} />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
