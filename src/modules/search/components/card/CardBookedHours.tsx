import { useT } from "@/hooks/useT";
import { formatHours } from "@/modules/observatoire/installation";
import { KpiCard } from "@/modules/observatoire/components/KpiCard";
import { PLACEHOLDER } from "@/modules/observatoire/dashboard";
import { useOrgaBookedHours } from "../../hooks/useOrgaBookedHours";
import type { SearchCardProps } from "../../schema";

/**
 * « Heures / semaine » et « Heures cumulées » d'une organisation sur sa carte d'annuaire (`card.bookedHours`) : les
 * indicateurs de sa fiche (`PreviewBookedResources`), mêmes icônes et mêmes teintes, un cran plus petits. Monté par
 * la carte seulement avec l'option : les autres annuaires ne lisent aucune réservation.
 */
export default function CardBookedHours({ orgaId, list }: { orgaId?: string; list?: SearchCardProps["list"] }) {
  const t = useT("modules/search");
  const { hours, loading, failed } = useOrgaBookedHours(orgaId, list?.preview?.reservations, list?.preview?.bookedResources);
  const value = (minutes: number | undefined) => (failed || minutes === undefined ? PLACEHOLDER : formatHours(minutes));
  return (
    // `text-left` : la carte profil centre son texte, l'indicateur se lit aligné comme sur la fiche.
    <div className="grid w-full grid-cols-2 gap-2 text-left">
      <KpiCard
        size="sm"
        icon="clock"
        label={t("PreviewReservations.kpiWeekly")}
        value={value(hours?.weeklyMinutes)}
        accentClasses="bg-chart-2/15 text-chart-2"
        loading={loading}
        loadingLabel={t("PreviewReservations.kpiLoading")}
      />
      <KpiCard
        size="sm"
        icon="calendar-clock"
        label={t("PreviewReservations.kpiCumulative")}
        value={value(hours?.cumulativeMinutes)}
        accentClasses="bg-chart-4/15 text-chart-4"
        loading={loading}
        loadingLabel={t("PreviewReservations.kpiLoading")}
      />
    </div>
  );
}
