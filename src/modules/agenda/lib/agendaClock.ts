import { addMonths, endOfDay, startOfDay } from "date-fns";

/** Horloge agenda résolue : instant courant + bornes de la fenêtre « À venir » (mode calendrier). */
export interface AgendaClock {
  /** Instant de référence (now) — sert la partition client En cours/À venir. */
  nowIso: string;
  /** Borne basse de la fenêtre À venir (début du jour courant → capte les events en cours du jour). */
  upcomingStartIso: string;
  /** Borne haute = now + fenêtre (mois), fin de journée. */
  upcomingEndIso: string;
}

/**
 * Calcule l'horloge agenda à partir d'un instant. Fonction PURE (déterministe pour un même `now`)
 * partagée par le hook client (`useAgendaClock`) et le prefetch SSR (`prefetchAgenda`) : les bornes
 * ISO produites alimentent la queryKey CALENDAR, donc serveur et client DOIVENT en dériver les mêmes.
 * Le partage se fait via la query `CLOCK` (stockée une fois, hydratée) — pas par recalcul des deux côtés.
 */
export function computeAgendaClock(now: Date, windowMonths: number): AgendaClock {
  const start = startOfDay(now);
  return {
    nowIso: now.toISOString(),
    upcomingStartIso: start.toISOString(),
    upcomingEndIso: endOfDay(addMonths(start, windowMonths)).toISOString(),
  };
}
