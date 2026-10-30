import type { useT } from "@/hooks/useT";
import { formatHours } from "@/modules/observatoire/installation";
import { DAY_KEYS, type DayKey } from "./schedules";
import { isoBound, JOUR_MS, periodsOverlap, reservationsInPeriod, slotPeriod, type Reservation } from "./reservations";
import { dayKeyOf } from "./slotFilter";

/**
 * Volume horaire des réservations : par SEMAINE (somme des durées des créneaux actifs le JOUR DE RÉFÉRENCE,
 * cf. `weeklyReferenceDay`) et CUMULÉ (chaque créneau multiplié par le nombre de fois où son jour tombe
 * réellement dans SA période — celle du créneau, sinon celle de la réservation, cf. `slotPeriod`). Consommé
 * par la fiche équipement (`PreviewReservations`), la fiche organisation (`PreviewBookedResources`), le KPI
 * `reservationHours` de l'observatoire et le tableau de bord installation.
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

/** Nombre de `day` entre deux jours ISO, bornes INCLUSES (une période d'un jour couvre ce jour). */
export function countWeekdays(periodStart: string, periodEnd: string, day: DayKey): number {
  const span = Math.round((Date.parse(periodEnd) - Date.parse(periodStart)) / JOUR_MS) + 1;
  if (span <= 0) return 0;
  // Décalage du premier `day` depuis le début de la période, puis une occurrence par semaine pleine.
  const offset = (DAY_KEYS.indexOf(day) - DAY_KEYS.indexOf(dayKeyOf(periodStart)) + 7) % 7;
  return offset < span ? Math.floor((span - 1 - offset) / 7) + 1 : 0;
}

/**
 * Jour de RÉFÉRENCE du volume hebdomadaire (règle de Peterson du 23/10) : `since` si un créneau y est actif —
 * sa période effective (`slotPeriod`) couvre ce jour —, sinon le premier jour où commence un créneau à venir ;
 * `since` s'il n'y en a aucun.
 *
 * Depuis l'import « une réservation par période », un club a une réservation par trimestre ou par cycle, avec
 * les mêmes créneaux : additionner tout ce qui est en cours ou à venir comptait chaque créneau autant de fois
 * qu'il reste de périodes (piscine Michel-Debré, base locale du 23/10 : 128,6 h/sem pour 47,6 h réservées
 * cette semaine-là). Hors période — vacances, entre deux saisons —, la prochaine semaine réservée plutôt
 * qu'un zéro qui ne dirait rien de l'occupation de l'équipement.
 */
export function weeklyReferenceDay(reservations: readonly Reservation[], since: string): string {
  const jour = { periodStart: since, periodEnd: since };
  let prochain: string | null = null;
  for (const r of reservations) {
    for (const slot of r.slots) {
      // Une durée nulle ou inversée (donnée dégradée) n'occupe rien : elle ne fixe pas la référence.
      if (slot.endMinutes <= slot.startMinutes) continue;
      const period = slotPeriod(slot, r);
      if (periodsOverlap(jour, period)) return since;
      const start = isoBound(period.periodStart);
      if (start && start > since && (prochain === null || start < prochain)) prochain = start;
    }
  }
  return prochain ?? since;
}

/** Heures d'UNE réservation, chaque créneau sur sa période effective. Avec `today`, seuls comptent les
 *  créneaux en cours ou à venir, et l'hebdomadaire ne retient que ceux actifs le jour de référence —
 *  `referenceDay`, sinon celui de la réservation seule (`weeklyReferenceDay`). Sans `today` ni référence,
 *  tous les créneaux comptent. Sans période exploitable, le cumul d'un créneau est inconnu : il vaut 0
 *  plutôt qu'une estimation (une période ouverte n'a pas de fin à compter). */
export function hoursOf(reservation: Reservation, today?: string, referenceDay?: string): ReservationHours {
  const reference = referenceDay ?? (today ? weeklyReferenceDay([reservation], today) : undefined);
  const semaine = reference ? { periodStart: reference, periodEnd: reference } : null;
  let weeklyMinutes = 0;
  let cumulativeMinutes = 0;
  for (const slot of reservation.slots) {
    const period = slotPeriod(slot, reservation);
    // Même test que le filtre créneau sans période saisie : le créneau finit aujourd'hui ou après.
    if (today && !periodsOverlap({ periodStart: today }, period)) continue;
    // Même règle que `computeEquipmentUsage` : une durée nulle ou inversée (donnée dégradée) ne compte pas.
    const minutes = Math.max(0, slot.endMinutes - slot.startMinutes);
    if (!semaine || periodsOverlap(semaine, period)) weeklyMinutes += minutes;
    const start = isoBound(period.periodStart);
    const end = isoBound(period.periodEnd);
    if (start && end) cumulativeMinutes += minutes * countWeekdays(start, end, slot.day);
  }
  return { weeklyMinutes, cumulativeMinutes };
}

/**
 * Total des créneaux en cours ou à venir à `today`. Avec `resourceIds`, une réservation compte
 * autant de fois qu'elle pointe d'équipements du lot : elle les occupe tous, et le total reste la
 * somme des fiches équipement.
 *
 * L'hebdomadaire se lit au jour de RÉFÉRENCE : `referenceDay` quand l'appelant le fixe — une fiche le
 * calcule une fois sur tout ce qu'elle affiche, pour que le total reste la somme de ses lignes —, sinon
 * celui des réservations sommées.
 */
export function sumReservationHours(
  reservations: readonly Reservation[],
  today: string,
  resourceIds?: ReadonlySet<string>,
  referenceDay?: string,
): ReservationHours {
  const total: ReservationHours = { weeklyMinutes: 0, cumulativeMinutes: 0 };
  const comptees = resourceIds
    ? reservations.filter((r) => r.resourceIds.some((id) => resourceIds.has(id)))
    : reservations;
  const reference = referenceDay ?? weeklyReferenceDay(comptees, today);
  for (const r of comptees) {
    const times = resourceIds ? r.resourceIds.filter((id) => resourceIds.has(id)).length : 1;
    const { weeklyMinutes, cumulativeMinutes } = hoursOf(r, today, reference);
    total.weeklyMinutes += weeklyMinutes * times;
    total.cumulativeMinutes += cumulativeMinutes * times;
  }
  return total;
}

/**
 * Les réservations réduites aux créneaux actifs le jour de référence (`weeklyReferenceDay`) — la SEMAINE
 * TYPE que lit le tableau de bord installation (taux d'occupation d'une semaine). Lui passer toutes les
 * réservations additionnait les saisons passées et, depuis l'import par période, chaque trimestre à venir.
 */
export function weeklyReservations(reservations: readonly Reservation[], since: string): Reservation[] {
  const reference = weeklyReferenceDay(reservations, since);
  return reservationsInPeriod(reservations, { periodStart: reference, periodEnd: reference });
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
