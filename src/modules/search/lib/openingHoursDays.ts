import { DAY_KEYS, type DayKey } from "./schedules";

/**
 * `openingHours` (schéma partagé formEngine/agenda — 7 entrées indexées Lundi→Dimanche, code court
 * `dayOfWeek` "Mo".."Su", cf. `src/constants/DAYS.ts`) → clés i18n canoniques `DayKey` de `schedules.ts`
 * (`days.<key>`), pour réutiliser les mêmes libellés traduits que les créneaux CoForm.
 */
const OPENING_HOURS_CODE_TO_DAY_KEY: Record<string, DayKey> = {
  Mo: "monday",
  Tu: "tuesday",
  We: "wednesday",
  Th: "thursday",
  Fr: "friday",
  Sa: "saturday",
  Su: "sunday",
};

interface OpeningHoursEntry {
  dayOfWeek?: unknown;
  hours?: unknown;
}

/** Jours (Lundi→Dimanche) ayant au moins un créneau dans `openingHours` — libellé laissé à l'i18n `days.<key>`. */
export function recurringDayKeys(openingHours: unknown): DayKey[] {
  if (!Array.isArray(openingHours)) return [];
  const present = new Set<DayKey>();
  for (const entry of openingHours as OpeningHoursEntry[]) {
    if (!entry || typeof entry !== "object" || !Array.isArray(entry.hours) || entry.hours.length === 0) continue;
    const dayKey = typeof entry.dayOfWeek === "string" ? OPENING_HOURS_CODE_TO_DAY_KEY[entry.dayOfWeek] : undefined;
    if (dayKey) present.add(dayKey);
  }
  return DAY_KEYS.filter((k) => present.has(k));
}

/** « mercredi, jeudi et vendredi » — pas de `Intl.ListFormat` (hors du `lib` TS ES2020 du projet). */
function joinWithAnd(items: string[], and: string): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`;
}

/** Signature compatible `useT` (`@/hooks/useT`) — évite de coupler ce module à React. */
export type Translate = (key: string, fallback?: string, params?: Record<string, unknown>) => string;

/**
 * « Chaque vendredi » / « Chaque mercredi et jeudi » — libellé de récurrence à partir d'`openingHours`.
 * `null` si l'event n'est pas récurrent ou n'a aucun jour exploitable (date d'occurrence isolée à
 * afficher à la place). `t` : `useT("modules/search")` (clés `days.*` / `card.event.recurring*`) — ce
 * module vit dans `search`, mais la fonction est réutilisable par d'autres modules affichant des
 * events (ex. `profil`), en leur passant un `t` bindé sur le namespace `modules/search`.
 */
export function formatRecurrenceLabel(recurrency: unknown, openingHours: unknown, t: Translate): string | null {
  if (!recurrency) return null;
  const days = recurringDayKeys(openingHours).map((k) => t(`days.${k}`).toLowerCase());
  if (!days.length) return null;
  const joined = joinWithAnd(days, t("card.event.recurringAnd"));
  return t("card.event.recurring", undefined, { days: joined });
}
