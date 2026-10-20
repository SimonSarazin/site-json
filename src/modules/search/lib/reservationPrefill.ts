import type { AllStepsData } from "@/modules/coform/types";
import type { DayKey } from "./schedules";
import type { ReservationsConf } from "../schema";

/**
 * Pré-remplissage du formulaire CoForm de réservation depuis la fiche d'un
 * équipement : l'équipement consulté et le créneau cliqué sont posés d'avance,
 * l'usager reste à saisir.
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
  /** Créneau cliqué. Absent = formulaire ouvert sans créneau pré-choisi. */
  slot?: { day: DayKey; startMinutes: number; endMinutes: number };
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
  return { defaultValues: { [step]: values }, lockedFields: [finderKey] };
}
