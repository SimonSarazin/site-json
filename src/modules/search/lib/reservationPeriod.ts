import { format, parseISO } from "date-fns";
import getDateFnsLocale from "@/dateFns";
import type { useT } from "@/hooks/useT";

/**
 * Formatage de la PÉRIODE de validité d'une réservation, partagé par les deux
 * presenters qui l'affichent : la section réservations d'une fiche équipement
 * (`PreviewReservations`) et la section « équipements réservés » d'une fiche
 * organisation (`PreviewBookedResources`).
 *
 * Les libellés restent sous les clés `PreviewReservations.*` : une même phrase
 * traduite deux fois finirait par diverger.
 */

type Translate = ReturnType<typeof useT>;

/** "2026-01-01" → "1 janv. 2026" (locale) ; repli sur l'ISO brut si invalide. */
export function formatIsoDate(iso: string): string {
  // `parseISO` traite une date-only ("2026-01-01") comme minuit LOCAL, alors que
  // `new Date(iso)` la parse en UTC → recul d'un jour aux offsets UTC négatifs.
  const date = parseISO(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return format(date, "d MMM yyyy", { locale: getDateFnsLocale() });
}

/** "Du 1 sept. 2026 au 30 juin 2027" — bornes absentes tolérées (une seule, ou aucune). */
export function formatReservationPeriod(
  { periodStart, periodEnd }: { periodStart?: string; periodEnd?: string },
  t: Translate,
): string {
  const start = periodStart ? formatIsoDate(periodStart) : undefined;
  const end = periodEnd ? formatIsoDate(periodEnd) : undefined;
  if (start && end) return t("PreviewReservations.period", undefined, { start, end });
  if (start) return t("PreviewReservations.periodFrom", undefined, { start });
  return t("PreviewReservations.periodUntil", undefined, { end });
}
