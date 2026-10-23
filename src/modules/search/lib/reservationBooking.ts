import type { useT } from "@/hooks/useT";
import {
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
 *    saisit des périodes — c'est le seul moment où tout est connu, et aucun contrôle serveur n'existe.
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
    const period = slotPeriod(slot, submitted);
    for (const r of existing) {
      if (submitted.id && r.id === submitted.id) continue;
      const bySlot = r.slots.find((rs) => slotsOverlap(slot, rs) && periodsOverlap(period, slotPeriod(rs, r)));
      if (bySlot) return { kind: "taken", slot, by: r, bySlot };
    }
  }
  return null;
}

/** Message du refus, dans les mots de la fiche : le créneau en cause et, s'il est pris, par qui et sur
 *  quelle période. */
export function bookingIssueMessage(issue: BookingIssue, t: Translate): string {
  if (issue.kind === "period") return t("PreviewReservations.issue.period");
  const slot = `${t(`days.${issue.slot.day}`)} ${issue.slot.start} – ${issue.slot.end}`;
  if (issue.kind === "slotPeriod") return t("PreviewReservations.issue.slotPeriod", undefined, { slot });
  if (issue.kind === "overlap") return t("PreviewReservations.issue.overlap", undefined, { slot });
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
