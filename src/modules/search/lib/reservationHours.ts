import type { useT } from "@/hooks/useT";
import { formatHours } from "@/modules/observatoire/installation";
import { DAY_KEYS, type DayKey } from "./schedules";
import { periodsOverlap, slotPeriod, type Reservation } from "./reservations";
import { dayKeyOf, isIsoDay } from "./slotFilter";

/**
 * Volume horaire des réservations : par SEMAINE (somme des durées des créneaux hebdomadaires) et
 * CUMULÉ (chaque créneau multiplié par le nombre de fois où son jour tombe réellement dans SA période
 * — celle du créneau, sinon celle de la réservation, cf. `slotPeriod`). Consommé par la fiche
 * équipement (`PreviewReservations`), la fiche organisation (`PreviewBookedResources`) et le KPI
 * `reservationHours` de l'observatoire.
 *
 * Seuls comptent les créneaux EN COURS OU À VENIR — la règle du filtre « Créneau disponible »
 * (`slotFilter.ts`), tranchée par Peterson : une saison terminée n'occupe plus l'équipement, et la
 * compter doublerait l'hebdomadaire d'un club qui reconduit ses créneaux d'une saison à l'autre. La
 * règle se juge CRÉNEAU par créneau : le cycle terminé d'une réservation de saison ne compte plus.
 *
 * Ni jours fériés ni vacances ne sont déduits du cumul : la base n'en porte aucune trace.
 */

export interface ReservationHours {
  weeklyMinutes: number;
  cumulativeMinutes: number;
}

const JOUR_MS = 24 * 60 * 60 * 1000;

/** Borne ISO exploitable (les 10 premiers caractères, comme `periodsOverlap`), sinon `null`. */
function isoDay(value: string | undefined): string | null {
  const day = value?.slice(0, 10);
  return isIsoDay(day) ? day : null;
}

/** Nombre de `day` entre deux jours ISO, bornes INCLUSES (une période d'un jour couvre ce jour). */
export function countWeekdays(periodStart: string, periodEnd: string, day: DayKey): number {
  const span = Math.round((Date.parse(periodEnd) - Date.parse(periodStart)) / JOUR_MS) + 1;
  if (span <= 0) return 0;
  // Décalage du premier `day` depuis le début de la période, puis une occurrence par semaine pleine.
  const offset = (DAY_KEYS.indexOf(day) - DAY_KEYS.indexOf(dayKeyOf(periodStart)) + 7) % 7;
  return offset < span ? Math.floor((span - 1 - offset) / 7) + 1 : 0;
}

/** Heures d'UNE réservation, chaque créneau sur sa période effective. Avec `today`, seuls comptent les
 *  créneaux en cours ou à venir. Sans période exploitable, le cumul d'un créneau est inconnu : il vaut 0
 *  plutôt qu'une estimation (une période ouverte n'a pas de fin à compter). */
export function hoursOf(reservation: Reservation, today?: string): ReservationHours {
  let weeklyMinutes = 0;
  let cumulativeMinutes = 0;
  for (const slot of reservation.slots) {
    const period = slotPeriod(slot, reservation);
    // Même test que le filtre créneau sans période saisie : le créneau finit aujourd'hui ou après.
    if (today && !periodsOverlap({ periodStart: today }, period)) continue;
    // Même règle que `computeEquipmentUsage` : une durée nulle ou inversée (donnée dégradée) ne compte pas.
    const minutes = Math.max(0, slot.endMinutes - slot.startMinutes);
    weeklyMinutes += minutes;
    const start = isoDay(period.periodStart);
    const end = isoDay(period.periodEnd);
    if (start && end) cumulativeMinutes += minutes * countWeekdays(start, end, slot.day);
  }
  return { weeklyMinutes, cumulativeMinutes };
}

/**
 * Total des créneaux en cours ou à venir à `today`. Avec `resourceIds`, une réservation compte
 * autant de fois qu'elle pointe d'équipements du lot : elle les occupe tous, et le total reste la
 * somme des fiches équipement.
 */
export function sumReservationHours(
  reservations: readonly Reservation[],
  today: string,
  resourceIds?: ReadonlySet<string>,
): ReservationHours {
  const total: ReservationHours = { weeklyMinutes: 0, cumulativeMinutes: 0 };
  for (const r of reservations) {
    const times = resourceIds ? r.resourceIds.filter((id) => resourceIds.has(id)).length : 1;
    if (times === 0) continue;
    const { weeklyMinutes, cumulativeMinutes } = hoursOf(r, today);
    total.weeklyMinutes += weeklyMinutes * times;
    total.cumulativeMinutes += cumulativeMinutes * times;
  }
  return total;
}

type Translate = ReturnType<typeof useT>;

/** « 4,5 h/sem · 180 h cumulées », ou « Total : … » — même phrase sur les deux fiches. Arrondi au
 *  dixième d'heure par `formatHours`, la règle du tableau de bord installation. */
export function formatReservationHours(hours: ReservationHours, t: Translate, total = false): string {
  return t(total ? "ReservationHours.total" : "ReservationHours.summary", undefined, {
    weekly: formatHours(hours.weeklyMinutes),
    cumulative: formatHours(hours.cumulativeMinutes),
  });
}
