import type { AllStepsData } from "@/modules/coform/types";
import type { DayKey } from "./schedules";
import type { ReservationsConf } from "../schema";

/**
 * Pré-remplissage du formulaire CoForm de réservation depuis la fiche d'un
 * équipement : l'équipement consulté et le créneau cliqué sont posés d'avance,
 * l'usager reste à saisir — sauf depuis la fiche de l'organisation, qui pose
 * aussi l'organisation usagère (`orga`).
 *
 * Les CLÉS de champs sont reconstruites depuis la config (`<step><suffixe>`, et
 * `finder<step><suffixe>` pour le finder) — mêmes règles qu'en lecture
 * (`parseReservationAnswer`). Les VALEURS respectent le format de stockage
 * legacy vérifié en base : jours en anglais Capitalisés, heures et minutes en
 * chaînes zéro-paddées séparées (cf. `modules/coform/utils/timeSlots`).
 */

/** Clé de jour interne (minuscule) → clé stockée par le champ `timeSlots`. */
export function toTimeSlotDay(day: DayKey): string {
  return day.charAt(0).toUpperCase() + day.slice(1);
}

function pad2(value: number): string {
  return String(Math.max(0, Math.floor(value))).padStart(2, "0");
}

/** Minutes depuis minuit → `{ hour: "18", minute: "00" }`. */
function splitMinutes(minutes: number): { hour: string; minute: string } {
  const m = Math.max(0, Math.round(minutes));
  return { hour: pad2(Math.floor(m / 60)), minute: pad2(m % 60) };
}

export interface ReservationPrefillTarget {
  /** Id de l'équipement consulté (valeur du finder). */
  resourceId: string;
  /** Nom affiché dans le finder ; "" si la fiche ne le fournit pas. */
  resourceName?: string;
  /** Organisation usagère imposée — ajout depuis SA fiche : posée dans le finder `userOrga` et verrouillée.
   *  Sans effet si la config ne mappe pas `fields.userOrga`. */
  orga?: { id: string; name?: string };
  /** Créneau cliqué. Absent = formulaire ouvert sans créneau pré-choisi. */
  slot?: { day: DayKey; startMinutes: number; endMinutes: number };
  /** Période choisie dans la section (`reservations.periods`) : Date début / Date fin du formulaire,
   *  jours ISO. Une borne absente reste à saisir. */
  period?: { periodStart?: string; periodEnd?: string };
}

export interface ReservationPrefill {
  /** Valeurs initiales attendues par `SmartCoForm` : `{ [step]: { [champ]: valeur } }`.
   *  Typé sur le contrat coform (import de TYPE seul — aucune arête de build). */
  defaultValues: AllStepsData;
  /** Champs non modifiables dans la modale (l'équipement est imposé par la fiche). */
  lockedFields: string[];
}

export function buildReservationPrefill(
  conf: Pick<ReservationsConf, "step" | "fields">,
  target: ReservationPrefillTarget,
): ReservationPrefill {
  const { step, fields } = conf;
  const finderKey = `finder${step}${fields.finder}`;
  const values: AllStepsData[string] = {
    [finderKey]: {
      [target.resourceId]: {
        id: target.resourceId,
        name: target.resourceName ?? "",
        type: "poi",
      },
    },
  };
  if (target.slot) {
    const start = splitMinutes(target.slot.startMinutes);
    const end = splitMinutes(target.slot.endMinutes);
    values[`${step}${fields.slots}`] = [
      {
        day: toTimeSlotDay(target.slot.day),
        startHour: start.hour,
        startMinute: start.minute,
        endHour: end.hour,
        endMinute: end.minute,
      },
    ];
  }
  // Les dates vont sur la RÉSERVATION, pas sur le créneau cliqué : un créneau sans période vaut pour
  // toute la réservation, la répéter sur lui ne dirait rien de plus. Le format des champs date du
  // formulaire est celui du `<input type="date">`, le jour ISO.
  const { periodStart, periodEnd } = target.period ?? {};
  if (periodStart && fields.periodStart) values[`${step}${fields.periodStart}`] = periodStart;
  if (periodEnd && fields.periodEnd) values[`${step}${fields.periodEnd}`] = periodEnd;
  const lockedFields = [finderKey];
  // Même forme de finder que l'équipement, sous la clé PRÉFIXÉE (cf. `parseReservationAnswer`).
  if (target.orga && fields.userOrga) {
    const orgaKey = `finder${step}${fields.userOrga}`;
    values[orgaKey] = {
      [target.orga.id]: { id: target.orga.id, name: target.orga.name ?? "", type: "organizations" },
    };
    lockedFields.push(orgaKey);
  }
  return { defaultValues: { [step]: values }, lockedFields };
}

/**
 * Le créneau BRUT `raw`, tel que le champ `timeSlots` le stocke, avec de nouvelles heures — la modification
 * d'horaire (`reservations.booking.editHours`). Toutes ses autres clés restent (jour, période propre…), sauf :
 *  - `duree`, la durée en secondes que porte chaque créneau importé (1 014 sur 1 015 en base le 23/10),
 *    recalculée : la garder dirait une autre durée que les heures ;
 *  - `startAmPm` / `endAmPm` d'un ancien format 12 h, retirées : les heures écrites sont en 24 h, les garder
 *    les ferait relire de travers (même règle que `normalizeSlot` du module coform).
 */
export function withSlotHours(
  raw: Record<string, unknown>,
  startMinutes: number,
  endMinutes: number,
): Record<string, unknown> {
  const { startAmPm: _startAmPm, endAmPm: _endAmPm, ...rest } = raw;
  const start = splitMinutes(startMinutes);
  const end = splitMinutes(endMinutes);
  return {
    ...rest,
    startHour: start.hour,
    startMinute: start.minute,
    endHour: end.hour,
    endMinute: end.minute,
    ...("duree" in rest ? { duree: Math.max(0, endMinutes - startMinutes) * 60 } : {}),
  };
}
