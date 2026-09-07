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
 * REPLI CLIENT (grille CALENDRIER, endpoints sans occurrence — `searchCostum`) : heure de fin du jour
 * de `start`, d'après `openingHours`. Approximation : jour et heure sont posés dans le fuseau du
 * NAVIGATEUR, pas dans celui de l'événement, et sur le DERNIER créneau du jour là où le serveur lit
 * le premier. Dès qu'un flux LISTE est borné (`from`/`to`/`order`), le serveur envoie la vraie fin
 * (`endDateSortFormat`, fuseau de l'event) et ce repli ne sert plus. `null` si le jour de `start`
 * n'a pas d'entrée exploitable dans `openingHours`.
 *
 * CRÉNEAU QUI FRANCHIT MINUIT (`21:00`→`01:00`, ou une fermeture à `00:00`) : l'heure posée sur le
 * jour de `start` tomberait AVANT lui, et `eventTimeBucket` — qui teste la fin d'abord — rangerait
 * l'événement dans « Passés » alors qu'il n'a pas encore commencé, le jour même où il a lieu. On
 * reporte donc la fin au lendemain, seule lecture cohérente d'une fermeture antérieure à l'ouverture.
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
  // Fermeture antérieure (ou égale) au début : le créneau court sur le jour suivant.
  if (end.getTime() <= start.getTime()) end.setDate(end.getDate() + 1);
  return end;
}

/**
 * Date d'occurrence d'un event pour l'agenda : `resolveEventStartDate` (`@/helpers/formatDate`,
 * partagé — `startDate` ponctuel sinon `startDateSort`/`startDateSortFormat` récurrent).
 *
 * `end`, par priorité :
 *  1. `endDateSortFormat` — fin d'occurrence calculée par le SERVEUR (fuseau de l'event, minuit
 *     franchi → lendemain), présente sur chaque ligne d'un flux LISTE borné (`from`/`to`/`order`) ;
 *  2. `endDate` (ponctuel multi-jours) ;
 *  3. repli client `closingTimeOnDay` (grille CALENDRIER, autres endpoints) — sans lui, `end` valait
 *     `null` pour un récurrent et « En cours » (`start ≤ now ≤ end ?? start`) était inatteignable.
 */
export function eventOccurrence(event: Pick<Event, "serverData">): Occurrence {
  const sd = (event.serverData ?? {}) as Record<string, unknown>;
  const start = resolveEventStartDate(sd);
  const end = toValidDate(sd.endDateSortFormat) ?? toValidDate(sd.endDate) ?? (start ? closingTimeOnDay(sd.openingHours, start) : null);
  return { start, end };
}
