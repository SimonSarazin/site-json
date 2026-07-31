/**
 * Logique pure du champ `tpls.forms.cplx.timeSlots` (créneaux jour + plage
 * horaire) — hors composant pour être testable (règle « helper pur = test »).
 *
 * Format de sauvegarde = celui du legacy (`timeSlots.php`), vérifié sur les
 * answers réelles du CoForm SSBE : jours en ANGLAIS Capitalisés ("Monday"),
 * heures/minutes en strings zéro-paddées séparées. Les données legacy en
 * format 12h portent en plus `startAmPm`/`endAmPm` — on les lit (conversion
 * vers 24h) mais on sauve TOUJOURS en 24h, le format des données observées.
 */

import type { TimeSlotValue } from "../types";

/** Jours de la semaine — clés EXACTES stockées en base (legacy, capitalisées). */
export const TIME_SLOT_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/** Clé i18n du jour (ex. "Monday" → "monday") — les libellés vivent dans le namespace coform. */
export function dayI18nKey(day: string): string {
  return day.toLowerCase();
}

function pad2(value: string): string {
  return value.length === 1 ? `0${value}` : value;
}

/**
 * Convertit heure+minute (+AmPm legacy éventuel) en "HH:MM" 24h — la valeur
 * d'un `<input type="time">`. Renvoie "" si le morceau est incomplet (slot en
 * cours de saisie) : l'input time affiche alors son état vide.
 */
export function toTimeString(hour: string, minute: string, amPm?: string): string {
  if (!hour || !minute) return "";
  let h = parseInt(hour, 10);
  if (Number.isNaN(h)) return "";
  // Conversion 12h legacy → 24h : 12 AM = 00h, 12 PM = 12h, sinon PM = +12.
  if (amPm === "PM" && h < 12) h += 12;
  if (amPm === "AM" && h === 12) h = 0;
  return `${pad2(String(h))}:${pad2(minute)}`;
}

/** Décompose "HH:MM" (valeur d'un input time) en { hour, minute } zéro-paddés. */
export function fromTimeString(time: string): { hour: string; minute: string } {
  const [hour = "", minute = ""] = time.split(":");
  return { hour: pad2(hour), minute: pad2(minute) };
}

/** Slot vide pré-rempli avec les heures par défaut de la config ("HH:MM"). */
export function createEmptySlot(defaultStartTime?: string, defaultEndTime?: string): TimeSlotValue {
  const start = fromTimeString(defaultStartTime ?? "");
  const end = fromTimeString(defaultEndTime ?? "");
  return {
    day: "",
    startHour: start.hour,
    startMinute: start.minute,
    endHour: end.hour,
    endMinute: end.minute,
  };
}

/** Tous les morceaux du slot sont renseignés (jour + début + fin). */
export function isSlotComplete(slot: TimeSlotValue): boolean {
  return Boolean(
    slot.day && slot.startHour && slot.startMinute && slot.endHour && slot.endMinute,
  );
}

/**
 * L'heure de fin est strictement après l'heure de début (en 24h, AmPm legacy
 * résolu). Un slot incomplet n'est pas « désordonné » — il est incomplet.
 */
export function isSlotOrdered(slot: TimeSlotValue): boolean {
  if (!isSlotComplete(slot)) return true;
  const start = toTimeString(slot.startHour, slot.startMinute, slot.startAmPm);
  const end = toTimeString(slot.endHour, slot.endMinute, slot.endAmPm);
  return Boolean(start && end && end > start);
}

/**
 * Normalise un slot venu du serveur pour l'édition : résout l'éventuel format
 * 12h legacy en 24h (les clés AmPm disparaissent — on sauve en 24h).
 */
export function normalizeSlot(slot: TimeSlotValue): TimeSlotValue {
  const start = fromTimeString(toTimeString(slot.startHour, slot.startMinute, slot.startAmPm));
  const end = fromTimeString(toTimeString(slot.endHour, slot.endMinute, slot.endAmPm));
  return {
    day: slot.day ?? "",
    startHour: start.hour,
    startMinute: start.minute,
    endHour: end.hour,
    endMinute: end.minute,
  };
}
