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

import type { useT } from "@/hooks/useT";
import type { TimeSlotValue } from "../types";

type Translate = ReturnType<typeof useT>;

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
 * Normalise la CASSE d'un jour stocké : le template legacy ACTUEL écrit des jours en minuscules
 * ("monday" — timeSlots.php pose la value lowercase), le parc historique est Capitalisé
 * ("Monday"). Sans ce recalage, un slot legacy récent s'affichait en Select VIDE à l'édition
 * (aucune option ne matche) et sa journée partait perdue au save.
 */
export function normalizeDay(day: string | undefined): string {
  if (!day) return "";
  const canonical = TIME_SLOT_DAYS.find((d) => d.toLowerCase() === day.toLowerCase());
  return canonical ?? day;
}

/**
 * Normalise un slot venu du serveur pour l'édition : résout l'éventuel format 12h legacy en 24h
 * (SEULES les clés AmPm disparaissent — on sauve en 24h) et recale la casse du jour.
 * ⚠ Les clés INCONNUES du slot sont PRÉSERVÉES (spread) : les slots réels portent du payload
 * hors form (`duree` sur 123/124 slots equipementsSportifs974, `prix` — import legacy) que le
 * legacy conserve à l'édition. L'ancienne version reconstruisait le slot aux 5 clés canoniques :
 * une seule édition détruisait `duree` de TOUS les slots (y compris via l'autosave).
 */
export function normalizeSlot(slot: TimeSlotValue): TimeSlotValue {
  const start = fromTimeString(toTimeString(slot.startHour, slot.startMinute, slot.startAmPm));
  const end = fromTimeString(toTimeString(slot.endHour, slot.endMinute, slot.endAmPm));
  const { startAmPm: _s, endAmPm: _e, ...rest } = slot;
  return {
    ...rest,
    day: normalizeDay(slot.day),
    startHour: start.hour,
    startMinute: start.minute,
    endHour: end.hour,
    endMinute: end.minute,
  };
}

/**
 * La période propre du créneau, si elle a ses deux bornes, va dans le bon sens (comparaison
 * lexicographique, valide sur des jours ISO). Un créneau sans période, ou à une seule borne, n'est pas
 * « désordonné » : il prend le reste de la période de la réponse.
 */
export function isSlotPeriodOrdered(slot: TimeSlotValue): boolean {
  return !slot.periodStart || !slot.periodEnd || slot.periodStart <= slot.periodEnd;
}

/**
 * Jour ISO → date courte de la locale (« 19/08/2026 ») ; repli sur la valeur brute si ce n'est pas un jour
 * ISO. Construite en heure LOCALE : `new Date("2026-08-19")` vaut minuit UTC, donc la veille sous un fuseau
 * négatif (Antilles).
 */
export function formatSlotDay(iso: string, locale?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** « Du 19/08/2026 au 10/10/2026 » — la période propre d'un créneau, à afficher à côté de lui ; `null`
 *  sans période (le créneau vaut alors pour toute la réponse, rien à dire). */
export function formatSlotPeriod(slot: TimeSlotValue, t: Translate, locale?: string): string | null {
  const start = slot.periodStart ? formatSlotDay(slot.periodStart, locale) : undefined;
  const end = slot.periodEnd ? formatSlotDay(slot.periodEnd, locale) : undefined;
  if (start && end) return t("coform.timeSlots.period", undefined, { start, end });
  if (start) return t("coform.timeSlots.periodFrom", undefined, { start });
  if (end) return t("coform.timeSlots.periodUntil", undefined, { end });
  return null;
}
