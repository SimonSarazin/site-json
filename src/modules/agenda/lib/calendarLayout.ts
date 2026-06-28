import { isSameDay } from "date-fns";
import type { Event } from "@communecter/cocolight-api-client";
import { eventOccurrence } from "./eventDates";

/** Une occurrence d'event placée sur un jour. */
export interface DayEvent {
  event: Event;
  start: Date;
  end: Date | null;
  title: string;
  type: string | undefined;
}

/** Occurrence positionnée dans une grille horaire (minutes + colonne de chevauchement). */
export interface PositionedEvent extends DayEvent {
  startMin: number;
  endMin: number;
  col: number;
  cols: number;
}

const MIN_PER_DAY = 24 * 60;

function titleOf(ev: Event): string {
  const sd = (ev.serverData ?? {}) as Record<string, unknown>;
  return typeof sd.name === "string" && sd.name ? sd.name : "(sans titre)";
}
function typeOf(ev: Event): string | undefined {
  const sd = (ev.serverData ?? {}) as Record<string, unknown>;
  return typeof sd.type === "string" ? sd.type : undefined;
}

/** Toutes les occurrences (déjà dépliées par searchEventsCostum) en DayEvent, triées par début. */
export function toDayEvents(events: Event[]): DayEvent[] {
  const out: DayEvent[] = [];
  for (const ev of events) {
    const { start, end } = eventOccurrence(ev);
    if (!start) continue;
    out.push({ event: ev, start, end, title: titleOf(ev), type: typeOf(ev) });
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Occurrences d'un jour donné, triées par début. */
export function eventsOnDay(dayEvents: DayEvent[], day: Date): DayEvent[] {
  return dayEvents.filter((d) => isSameDay(d.start, day));
}

const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();

/**
 * Place les occurrences d'UN jour dans une grille horaire : minutes début/fin (bornées au jour) +
 * packing des chevauchements (col / cols) façon Google Agenda. Défaut 1h si pas de fin.
 */
export function layoutDay(dayEvents: DayEvent[], day: Date): PositionedEvent[] {
  const items = eventsOnDay(dayEvents, day)
    .map((d) => {
      const startMin = minutesOfDay(d.start);
      let endMin = d.end && isSameDay(d.end, day) ? minutesOfDay(d.end) : d.end ? MIN_PER_DAY : startMin + 60;
      if (endMin <= startMin) endMin = Math.min(startMin + 60, MIN_PER_DAY);
      return { ...d, startMin, endMin, col: 0, cols: 1 } as PositionedEvent;
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

  const result: PositionedEvent[] = [];
  let cluster: PositionedEvent[] = [];
  let clusterEnd = -1;

  const flush = () => {
    if (!cluster.length) return;
    const colEnds: number[] = []; // fin de la dernière occurrence par colonne
    for (const e of cluster) {
      let placed = false;
      for (let c = 0; c < colEnds.length; c++) {
        if (e.startMin >= colEnds[c]) {
          e.col = c;
          colEnds[c] = e.endMin;
          placed = true;
          break;
        }
      }
      if (!placed) {
        e.col = colEnds.length;
        colEnds.push(e.endMin);
      }
    }
    const total = colEnds.length;
    for (const e of cluster) {
      e.cols = total;
      result.push(e);
    }
    cluster = [];
  };

  for (const e of items) {
    if (cluster.length && e.startMin >= clusterEnd) flush();
    cluster.push(e);
    clusterEnd = cluster.length === 1 ? e.endMin : Math.max(clusterEnd, e.endMin);
  }
  flush();
  return result;
}
