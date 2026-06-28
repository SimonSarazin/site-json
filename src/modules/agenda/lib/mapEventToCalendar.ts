import { Temporal } from "temporal-polyfill";
import type { Event } from "@communecter/cocolight-api-client";
import { eventOccurrence } from "./eventDates";

/** Event schedule-x (v4, API Temporal) minimal + lien vers l'entité d'origine. */
export interface AgendaCalendarEvent {
  id: string;
  title: string;
  start: Temporal.ZonedDateTime;
  end: Temporal.ZonedDateTime;
  calendarId: string;
}

function toZoned(d: Date): Temporal.ZonedDateTime {
  return Temporal.Instant.fromEpochMilliseconds(d.getTime()).toZonedDateTimeISO(Temporal.Now.timeZoneId());
}

/**
 * EventEntity[] (résultats `searchEventsCostum`) → événements schedule-x (Temporal) + `entityMap` (id → Event)
 * pour retrouver l'entité complète au clic (→ détail). Events sans date d'occurrence ignorés. `calendarId` = type
 * (→ couleur). Sans `endDate`, fin = début + 1h (occurrence ponctuelle visible).
 */
export function mapEventsToCalendar(events: Event[]): { calendarEvents: AgendaCalendarEvent[]; entityMap: Map<string, Event> } {
  const calendarEvents: AgendaCalendarEvent[] = [];
  const entityMap = new Map<string, Event>();
  for (const ev of events) {
    const { start, end } = eventOccurrence(ev);
    if (!start) continue;
    const sd = (ev.serverData ?? {}) as Record<string, unknown>;
    const id = String(sd.id ?? sd._id ?? "");
    if (!id || entityMap.has(id)) continue;
    const startZ = toZoned(start);
    calendarEvents.push({
      id,
      title: typeof sd.name === "string" && sd.name ? sd.name : "(sans titre)",
      start: startZ,
      end: end ? toZoned(end) : startZ.add({ hours: 1 }),
      calendarId: typeof sd.type === "string" && sd.type ? sd.type : "others",
    });
    entityMap.set(id, ev);
  }
  return { calendarEvents, entityMap };
}
