import type { Event } from "@communecter/cocolight-api-client";
import { eventOccurrence } from "./eventDates";

export type TimeBucket = "ongoing" | "upcoming" | "past";

/**
 * Statut temporel d'un event vis-à-vis de `now` :
 *  - `past`    : fin (end ?? start) < now
 *  - `upcoming`: début > now
 *  - `ongoing` : start ≤ now ≤ (end ?? start)
 *
 * Une fin ANTÉRIEURE au début est écartée (on retombe sur `start`) : le test de fin passe en
 * premier, si bien qu'une telle borne rangerait dans « Passés » un événement qui n'a pas commencé —
 * le jour même où il a lieu. Deux sources en produisent : une fermeture d'`openingHours` franchissant
 * minuit (traitée à la source, cf. `closingTimeOnDay`) et une `endDate` incohérente en base, que
 * personne ne redresse en amont.
 */
export function eventTimeBucket(start: Date, end: Date | null, now: Date): TimeBucket {
  const effectiveEnd = end && end.getTime() >= start.getTime() ? end : start;
  if (effectiveEnd.getTime() < now.getTime()) return "past";
  if (start.getTime() > now.getTime()) return "upcoming";
  return "ongoing";
}

/**
 * Répartit des events (résultats `searchEventsCostum`) en En cours / À venir / Passés.
 * Les events sans date d'occurrence exploitable sont ignorés. `now` injectable (tests).
 */
export function partitionByTime(events: Event[], now: Date = new Date()): Record<TimeBucket, Event[]> {
  const buckets: Record<TimeBucket, Event[]> = { ongoing: [], upcoming: [], past: [] };
  for (const ev of events) {
    const { start, end } = eventOccurrence(ev);
    if (!start) continue;
    buckets[eventTimeBucket(start, end, now)].push(ev);
  }
  return buckets;
}
