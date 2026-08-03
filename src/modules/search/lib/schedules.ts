/**
 * Regroupement des créneaux horaires des réponses CoForm (activités).
 *
 * Factorisé depuis `CardAnswer` et `PreviewCoformAnswer` (logique dupliquée).
 * Les jours sont regroupés sur une **clé canonique** (anglais minuscule, = clé
 * i18n `days.<key>`) et **triés** Lundi→Dimanche — l'ancienne version regroupait
 * sur le libellé français et affichait les jours dans l'ordre de la donnée (bug).
 * Le libellé d'affichage est laissé à l'i18n (`t("days." + dayKey)`).
 */

/** Jours ordonnés Lundi → Dimanche. Clés canoniques = clés i18n `days.*`. */
export const DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type DayKey = (typeof DAY_KEYS)[number];

const DAY_INDEX: Record<string, number> = Object.fromEntries(
  DAY_KEYS.map((k, i) => [k, i]),
);

export interface DaySchedule {
  /** Clé canonique (anglais) — à traduire via i18n `days.<dayKey>`. */
  dayKey: DayKey;
  times: string[];
}

/** Normalise un nom de jour brut (`"Monday"`, `" monday "`…) → clé canonique ou `null`. */
export function normalizeDayKey(raw: unknown): DayKey | null {
  if (typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase();
  return (DAY_KEYS as readonly string[]).includes(key) ? (key as DayKey) : null;
}

/**
 * Regroupe des créneaux CoForm (`{ day, startHour, startMinute, endHour, endMinute }`)
 * par jour, triés Lundi→Dimanche. Les jours non reconnus sont ignorés.
 */
export function groupSchedules(scheduleRaw: unknown): DaySchedule[] {
  const grouped: Record<string, string[]> = {};

  if (Array.isArray(scheduleRaw)) {
    for (const entry of scheduleRaw) {
      const slot = entry as Record<string, unknown>;
      const dayKey = normalizeDayKey(slot?.day);
      if (!dayKey) continue;

      const timeRange =
        `${String(slot.startHour ?? "")}H${String(slot.startMinute ?? "")}` +
        ` - ${String(slot.endHour ?? "")}H${String(slot.endMinute ?? "")}`;

      (grouped[dayKey] ??= []).push(timeRange);
    }
  }

  return Object.entries(grouped)
    .sort(([a], [b]) => DAY_INDEX[a] - DAY_INDEX[b])
    .map(([dayKey, times]) => ({ dayKey: dayKey as DayKey, times }));
}
