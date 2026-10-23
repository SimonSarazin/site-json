import type { useT } from "@/hooks/useT";
import type { SearchByFieldValue } from "../contexts/pageFilters";
import { keyFor, splitKey } from "./dropdownFilters";
import { EXCLUDE_TYPE } from "./searchByFieldsToQuery";
import {
  DEFAULT_END_HOUR,
  DEFAULT_START_HOUR,
  minutesToLabel,
  reservationConflicts,
  type BookingAmplitude,
  type Reservation,
} from "./reservations";
import { DAY_KEYS, normalizeDayKey, type DayKey } from "./schedules";

/**
 * Logique PURE du filtre « créneau » du bandeau (`searchHeader.slotFilter`) : des JOURS DE LA SEMAINE,
 * une PLAGE HORAIRE et, au besoin, une PÉRIODE. La liste ne garde que les ressources libres sur ce
 * créneau, d'après les réservations enregistrées — des créneaux HEBDOMADAIRES valables sur une période
 * (cf. `reservations.ts`). On cherche donc comme on réserve : « chaque lundi et chaque jeudi, de 15 h à
 * 18 h, du 17/08/2026 au 12/08/2027 », et non un jour daté.
 *
 * Règles du créneau :
 *  - plusieurs jours → libre CHACUN d'eux : une réservation sur l'un suffit à exclure ; aucun jour → les 7 ;
 *  - début et fin → la plage choisie ; début seul → jusqu'à la fin de l'amplitude (22 h par défaut) ;
 *    fin seule → depuis son début (8 h par défaut) ; aucune heure → toute l'amplitude ;
 *  - période facultative, bornes incluses ; début absent → aujourd'hui, fin absente → sans limite. Sans
 *    période, une réservation TERMINÉE ne gêne donc plus, une réservation À VENIR gêne déjà ;
 *  - période de moins d'une semaine → seuls les jours qu'elle contient comptent (le 14/11 seul : un samedi) ;
 *  - une ressource SANS réservation enregistrée est libre : le filtre ne retire que les occupées.
 *
 * Contrat d'état — celui du filtre « installation » (`installationFilter.ts`) : UNE entrée de
 * `searchByFields` sous la clé composite `${id}:${valeur d'URL}` (`keyFor`). Le créneau se relit dans
 * la clé ; l'entrée porte les ressources OCCUPÉES (`type: EXCLUDE_TYPE`), que `searchByFieldsToQuery`
 * traduit en `{ _id: { $nin } }`. Le filtre se combine donc en ET avec tous les autres, et la liste,
 * la carte, l'observatoire et l'export le suivent sans le connaître.
 *
 * Contrat d'URL : `?<id>=<jours>_<heures>_<période>`, chaque partie facultative et les vides de fin
 * omis — `monday.thursday_15h00-18h00`, `_18h00-20h00` (tous les jours), `monday_15h00-` (début seul),
 * `monday.thursday_15h00-18h00_2026-08-17-2027-08-12`, `__-2027-08-12` (période seule). Ni virgule
 * (format maison des filtres) ni « : » à encoder. La date du jour n'y figure jamais : un lien partagé
 * sans période se lit « à partir d'aujourd'hui » chez qui l'ouvre.
 */

type Translate = ReturnType<typeof useT>;

export interface SlotWindow {
  /** Jours de la semaine (clés `DAY_KEYS`) ; absents ou vides → les 7. */
  days?: DayKey[];
  /** `HH:MM` sur 24 h — le format des `<input type="time">`. */
  start?: string;
  end?: string;
  /** Période `AAAA-MM-JJ` — le format des `<input type="date">` —, bornes incluses ; début absent →
   *  aujourd'hui, fin absente → sans limite (cf. `resolveSlotRange`). */
  periodStart?: string;
  periodEnd?: string;
}

/** Créneau résolu : les jours EFFECTIVEMENT cherchés, une plage en minutes depuis minuit, semi-ouverte
 *  `[début, fin)`, et une période au début toujours posé. */
export interface SlotRange {
  days: DayKey[];
  startMinutes: number;
  endMinutes: number;
  periodStart: string;
  periodEnd?: string;
}

/** Saisie incohérente, que le formulaire signale et refuse : heures inversées, période inversée, ou
 *  période trop courte pour contenir l'un des jours choisis. */
export type SlotIssue = "hours" | "period" | "days";

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const HOUR = /^([01]\d|2[0-3]):([0-5]\d)$/;
const PARAM =
  /^([a-z]+(?:\.[a-z]+)*)?(?:_(?:(\d{2}h\d{2})?-(\d{2}h\d{2})?)?(?:_(\d{4}-\d{2}-\d{2})?-(\d{4}-\d{2}-\d{2})?)?)?$/;
const OBJECT_ID = /^[0-9a-f]{24}$/i;
const JOURNEE_MINUTES = 24 * 60;
const JOUR_MS = 24 * 60 * 60 * 1000;

/** Jour calendaire RÉEL (`2026-02-30` refusé), vérifié en UTC pour ne dépendre d'aucun fuseau. */
export function isIsoDay(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = ISO_DAY.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** `HH:MM` → minutes depuis minuit, `null` si absent ou invalide. */
function hourMinutes(value: string | undefined): number | null {
  const m = value ? HOUR.exec(value) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Jour de la semaine d'un jour ISO, en clé `DAY_KEYS` (celle des créneaux de réservation). */
export function dayKeyOf(isoDay: string): DayKey {
  const [y, m, d] = isoDay.split("-").map(Number);
  // `getUTCDay` compte depuis le dimanche ; `DAY_KEYS` commence au lundi.
  return DAY_KEYS[(new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7];
}

/** Date LOCALE en `AAAA-MM-JJ` : « aujourd'hui » pour qui consulte. En UTC, La Réunion (UTC+4)
 *  serait encore la veille jusqu'à 4 h du matin. */
export function localIsoDay(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Jours dans l'ordre de la semaine, sans doublon : une même sélection donne une seule valeur d'URL. */
function weekOrder(days: readonly DayKey[] | undefined): DayKey[] {
  return DAY_KEYS.filter((d) => days?.includes(d));
}

/** Créneau → valeur d'URL ; `null` quand rien n'est choisi (le param est alors supprimé). Une partie
 *  invalide est omise plutôt que recopiée. */
export function slotToParam(slot: SlotWindow): string | null {
  const days = weekOrder(slot.days).join(".");
  const hour = (value?: string) => (value && hourMinutes(value) !== null ? value.replace(":", "h") : "");
  const day = (value?: string) => (isIsoDay(value) ? value : "");
  const [start, end] = [hour(slot.start), hour(slot.end)];
  const [from, to] = [day(slot.periodStart), day(slot.periodEnd)];
  const hours = start || end ? `${start}-${end}` : "";
  if (from || to) return `${days}_${hours}_${from}-${to}`;
  if (hours) return `${days}_${hours}`;
  return days || null;
}

/** Valeur d'URL → créneau, `null` si elle est vide ou mal formée : un lien abîmé ne filtre rien. */
export function slotFromParam(raw: string | null | undefined): SlotWindow | null {
  const m = raw ? PARAM.exec(raw) : null;
  if (!m) return null;
  const [, days, start, end, periodStart, periodEnd] = m;
  const slot: SlotWindow = {};
  if (days) {
    const keys = days.split(".").map(normalizeDayKey);
    if (!keys.every((k): k is DayKey => k !== null)) return null;
    slot.days = weekOrder(keys);
  }
  for (const [key, part] of [["start", start], ["end", end]] as const) {
    if (!part) continue;
    const hour = part.replace("h", ":");
    if (hourMinutes(hour) === null) return null;
    slot[key] = hour;
  }
  for (const [key, part] of [["periodStart", periodStart], ["periodEnd", periodEnd]] as const) {
    if (!part) continue;
    if (!isIsoDay(part)) return null;
    slot[key] = part;
  }
  return Object.keys(slot).length > 0 ? slot : null;
}

/** Jours que contient une période de MOINS d'une semaine ; `null` au-delà, ou sans fin : chaque jour de
 *  la semaine y revient. */
function daysWithin(periodStart: string, periodEnd: string | undefined): DayKey[] | null {
  if (!periodEnd) return null;
  // Jours ISO lus en UTC (`Date.parse`) : l'écart est un multiple exact d'un jour.
  const span = Math.round((Date.parse(periodEnd) - Date.parse(periodStart)) / JOUR_MS);
  if (span >= DAY_KEYS.length - 1) return null;
  const first = DAY_KEYS.indexOf(dayKeyOf(periodStart));
  return Array.from({ length: span + 1 }, (_, i) => DAY_KEYS[(first + i) % DAY_KEYS.length]);
}

/** Résolution commune à `resolveSlotRange` et `slotIssue` : le créneau concret, ou ce qui l'empêche. */
function resolve(slot: SlotWindow, today: string, amplitude: BookingAmplitude): SlotRange | SlotIssue {
  // Une borne choisie HORS de l'amplitude l'emporte sur elle : un début à 22 h 30 vaut jusqu'à minuit,
  // une fin à 7 h depuis minuit — jamais une plage vide ou inversée qu'on n'aurait pas saisie.
  const open = (amplitude.startHour ?? DEFAULT_START_HOUR) * 60;
  const close = (amplitude.endHour ?? DEFAULT_END_HOUR) * 60;
  const start = hourMinutes(slot.start);
  const end = hourMinutes(slot.end);
  const startMinutes = start ?? (end !== null && end <= open ? 0 : open);
  const endMinutes = end ?? (start !== null && start >= close ? JOURNEE_MINUTES : close);
  if (startMinutes >= endMinutes) return "hours";

  const periodStart = slot.periodStart ?? today;
  const { periodEnd } = slot;
  if (!isIsoDay(periodStart) || (periodEnd !== undefined && (!isIsoDay(periodEnd) || periodEnd < periodStart))) {
    return "period";
  }

  const within = daysWithin(periodStart, periodEnd);
  const days = DAY_KEYS.filter(
    (d) => (!slot.days?.length || slot.days.includes(d)) && (!within || within.includes(d)),
  );
  if (days.length === 0) return "days";
  return { days, startMinutes, endMinutes, periodStart, periodEnd };
}

/** Créneau → plage concrète, selon les règles de l'en-tête ; `null` si la saisie est incohérente. */
export function resolveSlotRange(
  slot: SlotWindow,
  today: string,
  amplitude: BookingAmplitude = {},
): SlotRange | null {
  const resolved = resolve(slot, today, amplitude);
  return typeof resolved === "string" ? null : resolved;
}

/** Ce qui rend la saisie incohérente — le message du formulaire —, `null` si elle est valable. */
export function slotIssue(slot: SlotWindow, today: string, amplitude: BookingAmplitude = {}): SlotIssue | null {
  const resolved = resolve(slot, today, amplitude);
  return typeof resolved === "string" ? resolved : null;
}

/** Créneau tel que l'affichent le bouton et la pastille : jours et plage RÉSOLUS (un début seul se lit
 *  « 14:00–22:00 », le 14/11 seul « Sam »), période telle que SAISIE — la période par défaut (« à partir
 *  d'aujourd'hui ») n'est pas un choix et ne s'affiche pas. `null` si le créneau est incohérent. */
export function describeSlot(
  slot: SlotWindow,
  today: string,
  amplitude: BookingAmplitude = {},
): { days: DayKey[]; start: string; end: string; periodStart?: string; periodEnd?: string } | null {
  const range = resolveSlotRange(slot, today, amplitude);
  if (!range) return null;
  return {
    days: range.days,
    start: minutesToLabel(range.startMinutes),
    end: minutesToLabel(range.endMinutes),
    periodStart: slot.periodStart,
    periodEnd: slot.periodEnd,
  };
}

/** Bornes de l'amplitude en `HH:MM` — l'aide du formulaire dit à quoi se complète une borne absente. */
export function amplitudeLabels(amplitude: BookingAmplitude = {}): { open: string; close: string } {
  return {
    open: minutesToLabel((amplitude.startHour ?? DEFAULT_START_HOUR) * 60),
    close: minutesToLabel((amplitude.endHour ?? DEFAULT_END_HOUR) * 60),
  };
}

/** Jour en abrégé, tiré de son nom (`days.*`) : « Lundi » → « Lun », « Monday » → « Mon ». Pas de second
 *  jeu de libellés à tenir — même parti que la bande de la semaine des créneaux (`CreneauRow`). */
export function shortDayLabel(day: DayKey, t: Translate): string {
  return t(`days.${day}`).slice(0, 3);
}

/** Jours d'un créneau : « Lun, Jeu », ou « Tous les jours » pour les 7. */
export function formatSlotDays(days: readonly DayKey[], t: Translate): string {
  if (days.length === DAY_KEYS.length) return t("SlotFilter.everyDay");
  return days.map((d) => shortDayLabel(d, t)).join(", ");
}

/**
 * Ressources OCCUPÉES sur le créneau : celles d'une réservation dont un créneau hebdomadaire chevauche
 * la plage l'un des jours cherchés, sur une période — celle du créneau, sinon celle de la réservation
 * (`slotPeriod`) — qui recouvre celle de la recherche. Réutilise la
 * détection de conflit de la prise de réservation (`reservationConflicts`), le créneau cherché tenant
 * lieu de réservation envisagée — mêmes règles : bornes de période incluses, créneaux semi-ouverts
 * (18 h–20 h ne gêne pas 20 h–21 h).
 *
 * Identifiants retenus au format ObjectId : le backend convertit chaque valeur de `_id.$nin`
 * (`SearchNew`) et échouerait sur une valeur malformée. Triés, sans doublon : même créneau, même requête.
 */
export function busyResourceIds(reservations: Reservation[], range: SlotRange): string[] {
  const candidate = {
    slots: range.days.map((day) => ({ day, startMinutes: range.startMinutes, endMinutes: range.endMinutes })),
    periodStart: range.periodStart,
    periodEnd: range.periodEnd,
  };
  const ids = new Set<string>();
  for (const r of reservationConflicts(candidate, reservations)) {
    for (const id of r.resourceIds) if (OBJECT_ID.test(id)) ids.add(id);
  }
  return [...ids].sort();
}

/** Valeur d'URL du créneau ACTIF, lue dans la clé de l'entrée du filtre ; `null` sans entrée. */
export function activeSlotParam(
  searchByFields: Record<string, SearchByFieldValue>,
  id: string,
): string | null {
  for (const key of Object.keys(searchByFields)) {
    const parsed = splitKey(key);
    if (parsed?.filterId === id) return parsed.optionId;
  }
  return null;
}

function sameValues(value: SearchByFieldValue["value"], busy: readonly string[]): boolean {
  return Array.isArray(value) && value.length === busy.length && value.every((v, i) => v === busy[i]);
}

/**
 * État avec l'entrée du filtre remplacée, ou retirée quand `param` est `null`. Rend `prev` LUI-MÊME
 * quand rien ne change : le rafraîchissement des réservations recalcule l'exclusion sans relancer la
 * liste si les occupés sont les mêmes.
 */
export function withSlotEntry(
  prev: Record<string, SearchByFieldValue>,
  id: string,
  param: string | null,
  busy: string[],
): Record<string, SearchByFieldValue> {
  const key = param ? keyFor(id, param) : null;
  const own = Object.keys(prev).filter((k) => splitKey(k)?.filterId === id);
  if (!key && own.length === 0) return prev;
  if (key && own.length === 1 && own[0] === key && sameValues(prev[key].value, busy)) return prev;
  const next = Object.fromEntries(Object.entries(prev).filter(([k]) => splitKey(k)?.filterId !== id));
  if (key) next[key] = { field: "_id", type: EXCLUDE_TYPE, value: busy };
  return next;
}
