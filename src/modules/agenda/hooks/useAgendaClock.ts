import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AGENDA_QUERY_KEYS } from "../constants/queryKeys";
import { computeAgendaClock, type AgendaClock } from "../lib/agendaClock";

/**
 * Horloge agenda partagée et STABLE. Backée par une query react-query `staleTime: Infinity` :
 * - SSR : `prefetchAgenda` pose la valeur → hydratée → le client lit l'instant/les bornes du SERVEUR ;
 * - client (navigation) : `initialData` la calcule une fois.
 * Dans les deux cas la valeur ne change pas au re-render → les bornes alimentant la queryKey CALENDAR
 * sont identiques côté prefetch et côté composant (pas de mismatch, pas de boucle de refetch).
 */
export function useAgendaClock(windowMonths: number) {
  const { data } = useQuery({
    queryKey: AGENDA_QUERY_KEYS.CLOCK(windowMonths),
    queryFn: () => computeAgendaClock(new Date(), windowMonths),
    initialData: (): AgendaClock => computeAgendaClock(new Date(), windowMonths),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  return useMemo(
    () => ({
      now: new Date(data.nowIso),
      upcomingStart: new Date(data.upcomingStartIso),
      upcomingEnd: new Date(data.upcomingEndIso),
      raw: data,
    }),
    [data],
  );
}
