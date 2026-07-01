import type { Event } from "@communecter/cocolight-api-client";
import { eventOccurrence } from "./eventDates";

export type TimeBucket = "ongoing" | "upcoming" | "past";

/**
 * Statut temporel d'un event vis-à-vis de `now` :
 *  - `past`    : fin (end ?? start) < now
 *  - `upcoming`: début > now
 *  - `ongoing` : start ≤ now ≤ (end ?? start)
 */
export function eventTimeBucket(start: Date, end: Date | null, now: Date): TimeBucket {
  const effectiveEnd = end ?? start;
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
