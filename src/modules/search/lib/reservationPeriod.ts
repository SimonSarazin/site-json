import { format, parseISO } from "date-fns";
import getDateFnsLocale from "@/dateFns";
import type { useT } from "@/hooks/useT";
import { slotPeriod, type Reservation, type ReservationSlot } from "./reservations";

/**
 * Formatage de la PÉRIODE de validité d'une réservation, partagé par ceux qui
 * l'affichent : la section réservations d'une fiche équipement
 * (`PreviewReservations`), la section « équipements réservés » d'une fiche
 * organisation (`PreviewBookedResources`) et la pastille du filtre de
 * disponibilité (`SearchHeaderSection`), dont la période se lit comme celle
 * d'une réservation.
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

/** "2026-01-01" → "01/01/2026" (date courte de la locale, `P`, comme `PreviewEvent`) ; repli sur l'ISO brut. */
export function formatIsoDateShort(iso: string): string {
  const date = parseISO(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return format(date, "P", { locale: getDateFnsLocale() });
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

/**
 * « Collège Joseph Bédier · Lundi · Du 19 août 2026 au 5 nov. 2026 » — ce que la fenêtre de modification
 * d'horaire rappelle du créneau : l'usager, le jour, et la période EFFECTIVE du créneau (`slotPeriod`) quand
 * elle a au moins une borne. Ni le jour ni la période ne s'y modifient.
 */
export function slotHoursContext(
  reservation: Pick<Reservation, "user" | "periodStart" | "periodEnd">,
  slot: ReservationSlot,
  t: Translate,
): string {
  const periode = slotPeriod(slot, reservation);
  return [
    reservation.user || t("PreviewReservations.unknownUser"),
    t(`days.${slot.day}`),
    ...(periode.periodStart || periode.periodEnd ? [formatReservationPeriod(periode, t)] : []),
  ].join(" · ");
}

/**
 * « 19/08/2026 → 05/11/2026 » — la période sur une carte de la grille des créneaux, où la phrase longue ne
 * tient pas. Une seule borne : la phrase « À partir du » / « Jusqu'au », dates courtes. Aucune : chaîne vide,
 * la carte n'affiche alors rien.
 */
export function formatPeriodShort(
  { periodStart, periodEnd }: { periodStart?: string; periodEnd?: string },
  t: Translate,
): string {
  const start = periodStart ? formatIsoDateShort(periodStart) : undefined;
  const end = periodEnd ? formatIsoDateShort(periodEnd) : undefined;
  if (start && end) return t("PreviewReservations.periodShort", undefined, { start, end });
  if (start) return t("PreviewReservations.periodFrom", undefined, { start });
  if (end) return t("PreviewReservations.periodUntil", undefined, { end });
  return "";
}
