import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import type { Event } from "@communecter/cocolight-api-client";
import { AGENDA_QUERY_KEYS } from "../constants/queryKeys";
import { buildAgendaCalendarParams } from "../lib/buildAgendaParams";

export interface UseAgendaCalendarParams {
  /** Bornes de la période demandée (mode CALENDRIER de `searchEventsCostum` → récurrence dépliée). */
  rangeStart: Date;
  rangeEnd: Date;
  /** Type d'event (scalaire côté SDK) — filtre backend. */
  type?: string;
  /** Recherche texte (name) — filtre backend. */
  name?: string;
  enabled?: boolean;
}

/**
 * Events d'un costum sur une plage (mode CALENDRIER de `searchEventsCostum` : récurrents dépliés,
 * triés par occurrence, **une seule page**). Sert la grille calendrier ET les onglets À venir/En cours.
 * La plage/type/name sont dans la queryKey → refetch auto à la navigation/filtre. Scope costum auto (sourceKey=[slug]).
 */
export function useAgendaCalendar({ rangeStart, rangeEnd, type, name, enabled = true }: UseAgendaCalendarParams) {
  const { entity } = useCocolight();
  const scope = (entity as { serverData?: { slug?: string } } | null)?.serverData?.slug;

  const query = useQuery({
    queryKey: AGENDA_QUERY_KEYS.CALENDAR({
      scope,
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
      type,
      name,
    }),
    queryFn: async (): Promise<Event[]> => {
      if (!entity) throw new Error("API non initialisée - entity manquante");
      try {
        const page = await entity.searchEventsCostum(
          buildAgendaCalendarParams(rangeStart, rangeEnd, { type, name }),
        );
        return page.results;
      } catch (e) {
        console.error("[agenda] searchEventsCostum (calendar) a échoué", e);
        throw e;
      }
    },
    enabled: !!entity && enabled,
    staleTime: 60 * 1000,
  });

  return {
    events: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
