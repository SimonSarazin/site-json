import type { useT } from "@/hooks/useT";
import {
  minutesToLabel,
  parseSlot,
  periodsOverlap,
  slotPeriod,
  slotsOverlap,
  type Reservation,
  type ReservationSlot,
} from "./reservations";
import { formatReservationPeriod } from "./reservationPeriod";
import { isIsoDay } from "./slotFilter";

/**
 * Prise de réservation PAR PÉRIODE (opt-in `reservations.periods`), logique pure :
 *  - la période du filtre « du … au … » de la section réservations, qui décide aussi des cases libres ;
 *  - le contrôle d'ENREGISTREMENT, rejoué sur ce que le formulaire va réellement envoyer. Le clic sur une
 *    case ne contrôle que la case : dans le formulaire, on change les heures, on ajoute des créneaux, on
 *    saisit des périodes — c'est le seul moment où tout est connu, et aucun contrôle serveur n'existe ;
 *  - l'AVERTISSEMENT EN DIRECT de la saisie (`slotIssues`), qui en est l'aperçu sous chaque créneau ;
 *  - le contrôle de la MODIFICATION D'HORAIRE d'un créneau existant (`reservations.booking.editHours`).
 */

type Translate = ReturnType<typeof useT>;

/** Période résolue : un début toujours posé, une fin facultative (sans limite). */
export interface PeriodRange {
  periodStart: string;
  periodEnd?: string;
}

/**
 * Période du filtre de la section : « Du » vide → aujourd'hui, « Au » vide → sans limite — les règles du
 * filtre « Créneau disponible » (`slotFilter.ts`). Sans date, la section montre donc les créneaux en cours
 * ou à venir, comme les heures (`reservationHours.ts`). `null` quand la fin précède le début : saisie
 * incohérente, que la section signale.
 */
export function resolvePeriodFilter(from: string, to: string, today: string): PeriodRange | null {
  const periodStart = isIsoDay(from) ? from : today;
  const periodEnd = isIsoDay(to) ? to : undefined;
  if (periodEnd !== undefined && periodEnd < periodStart) return null;
  return { periodStart, periodEnd };
}

export type BookingIssue =
  /** Date de début ou de fin de la réservation absente, ou fin avant début. */
  | { kind: "period" }
  /** Modification d'horaire : l'heure de fin ne suit pas l'heure de début. */
  | { kind: "hours" }
  /** Modification d'horaire : le créneau n'est plus celui affiché (réservation modifiée entre-temps). */
  | { kind: "stale" }
  /** Modification d'horaire : le créneau chevaucherait un autre créneau de SA réservation. */
  | { kind: "sibling"; slot: ReservationSlot }
  /** Période d'un créneau inversée, ou qui déborde celle de la réservation. */
  | { kind: "slotPeriod"; slot: ReservationSlot }
  /** Deux créneaux du formulaire qui se chevauchent : même jour, heures sécantes, périodes communes. */
  | { kind: "overlap"; slot: ReservationSlot }
  /** Un créneau déjà enregistré sur l'équipement occupe la même heure sur une période commune. */
  | { kind: "taken"; slot: ReservationSlot; by: Reservation; bySlot: ReservationSlot };

/** Une période complète (début ET fin), à l'endroit — `isIsoDay` refuse aussi une date-heure. */
function complete(period: { periodStart?: string; periodEnd?: string }): period is PeriodRange & { periodEnd: string } {
  return isIsoDay(period.periodStart) && isIsoDay(period.periodEnd) && period.periodStart <= period.periodEnd;
}

/** Premier créneau d'une AUTRE réservation d'`existing` qui occupe `slot` sur une période commune — périodes
 *  effectives des deux côtés (`slotPeriod`). `selfId` : la réservation de `slot`, qui ne se gêne pas elle-même. */
function takenBy(
  slot: ReservationSlot,
  period: { periodStart?: string; periodEnd?: string },
  existing: readonly Reservation[],
  selfId?: string,
): { by: Reservation; bySlot: ReservationSlot } | null {
  for (const r of existing) {
    if (selfId && r.id === selfId) continue;
    const bySlot = r.slots.find((rs) => slotsOverlap(slot, rs) && periodsOverlap(period, slotPeriod(rs, r)));
    if (bySlot) return { by: r, bySlot };
  }
  return null;
}

/**
 * Ce qui interdit d'enregistrer `submitted` — la réservation telle que le formulaire va l'envoyer —, ou
 * `null`. Dans l'ordre :
 *  1. la réservation a une période complète (« l'ajout d'un créneau doit contenir la période », règle de
 *     Peterson du 20/10) : sans fin, elle occuperait le créneau pour toujours ;
 *  2. la période de chaque créneau est à l'endroit et reste dans celle de la réservation — sinon les dates
 *     de la réservation, que la fiche affiche, ne diraient plus quand elle occupe l'équipement ;
 *  3. deux créneaux du formulaire ne se chevauchent pas ;
 *  4. aucun créneau ne chevauche un créneau déjà enregistré sur l'équipement (`existing`, la liste de la
 *     ressource — cf. `reservationConflicts`), périodes effectives comprises (`slotPeriod`).
 * La réponse éditée, si `submitted` en porte l'identifiant, ne se gêne pas elle-même.
 */
export function bookingIssue(submitted: Reservation, existing: readonly Reservation[]): BookingIssue | null {
  if (!complete(submitted)) return { kind: "period" };
  for (const slot of submitted.slots) {
    const period = slotPeriod(slot, submitted);
    if (
      !complete(period)
      || period.periodStart < submitted.periodStart
      || period.periodEnd > submitted.periodEnd
    ) {
      return { kind: "slotPeriod", slot };
    }
  }

  const { slots } = submitted;
  for (let j = 1; j < slots.length; j += 1) {
    for (let i = 0; i < j; i += 1) {
      if (
        slotsOverlap(slots[i], slots[j])
        && periodsOverlap(slotPeriod(slots[i], submitted), slotPeriod(slots[j], submitted))
      ) {
        return { kind: "overlap", slot: slots[j] };
      }
    }
  }

  for (const slot of slots) {
    const pris = takenBy(slot, slotPeriod(slot, submitted), existing, submitted.id);
    if (pris) return { kind: "taken", slot, ...pris };
  }
  return null;
}

/**
 * AVERTISSEMENTS EN DIRECT de la saisie d'un ajout (`slotCheck` du formulaire) : ce qui empêcherait d'enregistrer
 * chaque créneau, rangé par index BRUT (`ReservationSlot.index`, celui du champ `timeSlots`). Rien tant que la
 * réservation n'a pas sa période complète : l'avertissement attend que la saisie nécessaire — les dates, puis le
 * jour et les heures — soit faite (demande de Peterson du 26/10). Pour un créneau complet (la fin après le début ;
 * sinon le champ signale déjà l'ordre) :
 *  1. `taken` : un créneau déjà enregistré sur l'équipement l'occupe sur une période commune (`bookingIssue`, 4) ;
 *  2. sinon `overlap` : il chevauche un créneau PLUS HAUT du formulaire (`bookingIssue`, 3).
 * Un aperçu seulement : ce qui bloque l'enregistrement reste `bookingIssue`, rejoué sur des réservations relues.
 */
export function slotIssues(submitted: Reservation, existing: readonly Reservation[]): Map<number, BookingIssue> {
  const issues = new Map<number, BookingIssue>();
  if (!complete(submitted)) return issues;
  const { slots } = submitted;
  slots.forEach((slot, i) => {
    if (slot.index === undefined || !(slot.startMinutes < slot.endMinutes)) return;
    const period = slotPeriod(slot, submitted);
    const pris = takenBy(slot, period, existing, submitted.id);
    if (pris) {
      issues.set(slot.index, { kind: "taken", slot, ...pris });
      return;
    }
    const chevauche = slots
      .slice(0, i)
      .some((s) => slotsOverlap(s, slot) && periodsOverlap(slotPeriod(s, submitted), period));
    if (chevauche) issues.set(slot.index, { kind: "overlap", slot });
  });
  return issues;
}

/**
 * Ce qui interdit de passer le créneau d'index BRUT `target.slotIndex` (cf. `ReservationSlot.index`) de la
 * réservation `target.reservationId` à `startMinutes`–`endMinutes`, ou `null`. Seules les heures changent : le
 * jour et la période restent ceux du créneau (NB de Peterson du 23/10 : « seul l'horaire peut être modifié »).
 *
 * `existing` : les réservations RELUES de chaque équipement de la réservation, elle comprise — c'est sur elle,
 * fraîche, que se lisent le créneau visé et ses voisins. Dans l'ordre :
 *  1. la fin suit le début ;
 *  2. le créneau existe toujours, au même jour (sinon la réservation a changé depuis l'affichage) ;
 *  3. il ne chevauche aucun autre créneau de sa réservation (même jour, périodes communes) ;
 *  4. ni aucun créneau d'une autre réservation des mêmes équipements (`bookingIssue`, étape 4).
 */
export function slotHoursIssue(
  target: { reservationId: string; slotIndex: number; day: ReservationSlot["day"] },
  startMinutes: number,
  endMinutes: number,
  existing: readonly Reservation[],
): BookingIssue | null {
  if (!(startMinutes < endMinutes)) return { kind: "hours" };
  const reservation = existing.find((r) => r.id === target.reservationId);
  const current = reservation?.slots.find((s) => s.index === target.slotIndex);
  if (!reservation || !current || current.day !== target.day) return { kind: "stale" };

  const slot: ReservationSlot = {
    ...current,
    startMinutes,
    endMinutes,
    start: minutesToLabel(startMinutes),
    end: minutesToLabel(endMinutes),
  };
  const period = slotPeriod(slot, reservation);
  for (const voisin of reservation.slots) {
    if (voisin.index === target.slotIndex) continue;
    if (slotsOverlap(slot, voisin) && periodsOverlap(period, slotPeriod(voisin, reservation))) {
      return { kind: "sibling", slot };
    }
  }
  const pris = takenBy(slot, period, existing, reservation.id);
  return pris ? { kind: "taken", slot, ...pris } : null;
}

/** Le créneau BRUT relu dans la réponse est-il toujours celui affiché — même jour, mêmes heures ? Garde de
 *  l'écriture par index : si le tableau a changé depuis l'affichage, l'index viserait un autre créneau. */
export function isSameSlot(raw: unknown, slot: ReservationSlot): boolean {
  const relu = parseSlot(raw, slot.index ?? -1);
  return relu !== null
    && relu.day === slot.day
    && relu.startMinutes === slot.startMinutes
    && relu.endMinutes === slot.endMinutes;
}

/** Message du refus, dans les mots de la fiche : le créneau en cause et, s'il est pris, par qui et sur
 *  quelle période. */
export function bookingIssueMessage(issue: BookingIssue, t: Translate): string {
  if (issue.kind === "period") return t("PreviewReservations.issue.period");
  if (issue.kind === "hours") return t("PreviewReservations.issue.hours");
  if (issue.kind === "stale") return t("PreviewReservations.issue.stale");
  const slot = `${t(`days.${issue.slot.day}`)} ${issue.slot.start} – ${issue.slot.end}`;
  if (issue.kind === "slotPeriod") return t("PreviewReservations.issue.slotPeriod", undefined, { slot });
  if (issue.kind === "overlap") return t("PreviewReservations.issue.overlap", undefined, { slot });
  if (issue.kind === "sibling") return t("PreviewReservations.issue.sibling", undefined, { slot });
  const occupied = slotPeriod(issue.bySlot, issue.by);
  return t("PreviewReservations.issue.taken", undefined, {
    slot,
    user: issue.by.user || t("PreviewReservations.unknownUser"),
    // Une réservation sans aucune borne (donnée dégradée) occupe le créneau sans limite.
    period: occupied.periodStart || occupied.periodEnd
      ? formatReservationPeriod(occupied, t)
      : t("PreviewReservations.issue.noPeriod"),
  });
}
