import type { Event } from "@communecter/cocolight-api-client";
import { DAYS, type DayOfWeek } from "@/constants/DAYS";
import { resolveEventStartDate, toValidDate } from "@/helpers/formatDate";

/** Bornes d'occurrence d'un event pour l'agenda. */
export interface Occurrence {
  start: Date | null;
  end: Date | null;
}

interface OpeningHoursEntry {
  dayOfWeek?: unknown;
  hours?: Array<{ opens?: unknown; closes?: unknown }>;
}

/** `Date.getDay()` (0=dimanche) → code `openingHours`/`DAYS` ("Mo".."Su", `src/constants/DAYS.ts`). */
const JS_DAY_TO_CODE: DayOfWeek[] = [DAYS[6], DAYS[0], DAYS[1], DAYS[2], DAYS[3], DAYS[4], DAYS[5]];

/**
 * Heure de fin du jour de `start`, d'après `openingHours` (dernier créneau du jour concerné — un
 * événement récurrent n'a pas d'`endDate`, seulement des créneaux hebdo). `null` si le jour de `start`
 * n'a pas d'entrée exploitable dans `openingHours`.
 */
function closingTimeOnDay(openingHours: unknown, start: Date): Date | null {
  if (!Array.isArray(openingHours)) return null;
  const code = JS_DAY_TO_CODE[start.getDay()];
  const entry = (openingHours as OpeningHoursEntry[]).find(
    (e) => e && typeof e === "object" && e.dayOfWeek === code && Array.isArray(e.hours) && e.hours.length > 0,
  );
  const lastSlot = entry?.hours?.[entry.hours.length - 1];
  const match = typeof lastSlot?.closes === "string" ? lastSlot.closes.match(/^(\d{1,2}):(\d{2})/) : null;
  if (!match) return null;
  const end = new Date(start);
  end.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return end;
}

/**
 * Date d'occurrence d'un event pour l'agenda : `resolveEventStartDate` (`@/helpers/formatDate`,
 * partagé — `startDate` ponctuel sinon `startDateSort`/`startDateSortFormat` récurrent).
 *
 * `end` : `endDate` si présent (events ponctuels multi-jours) ; sinon, l'heure de fin de créneau du
 * jour dans `openingHours` (récurrents). Sans ce repli, `end` valait toujours `null` pour un récurrent
 * → `eventTimeBucket` (fin = `end ?? start`) ne pouvait jamais matcher « ongoing » (`start ≤ now ≤
 * start` n'est vrai qu'à la milliseconde exacte du début).
 */
export function eventOccurrence(event: Pick<Event, "serverData">): Occurrence {
  const sd = (event.serverData ?? {}) as Record<string, unknown>;
  const start = resolveEventStartDate(sd);
  const end = toValidDate(sd.endDate) ?? (start ? closingTimeOnDay(sd.openingHours, start) : null);
  return { start, end };
}
