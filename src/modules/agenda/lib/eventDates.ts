import type { Event } from "@communecter/cocolight-api-client";

/** Bornes d'occurrence d'un event pour l'agenda. */
export interface Occurrence {
  start: Date | null;
  end: Date | null;
}

function toDate(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Date d'occurrence d'un event pour l'agenda : `startDate` (ponctuel, normalisé en Date par le SDK)
 * ou `startDateSort` (récurrent — les récurrents purs n'ont PAS de startDate, leur occurrence calculée
 * côté serveur est dans startDateSort/startDateSortFormat). `endDate` si présent (events multi-jours).
 */
export function eventOccurrence(event: Pick<Event, "serverData">): Occurrence {
  const sd = (event.serverData ?? {}) as Record<string, unknown>;
  const start = toDate(sd.startDate) ?? toDate(sd.startDateSort);
  const end = toDate(sd.endDate);
  return { start, end };
}
