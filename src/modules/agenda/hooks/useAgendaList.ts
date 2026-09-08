import { useMemo } from "react";
import { useCocolight } from "@/hooks/useCocolight";
import { useInfiniteQueryScrollNextWithTransform } from "@/hooks/useInfiniteQueryScroll";
import type { Event } from "@communecter/cocolight-api-client";
import { AGENDA_QUERY_KEYS } from "../constants/queryKeys";
import {
  agendaBaseSig,
  agendaBoundsSig,
  agendaListIndexStep,
  buildAgendaListParams,
  type AgendaBaseParams,
  type AgendaListBounds,
} from "../lib/buildAgendaParams";

export interface UseAgendaListParams {
  type?: string;
  name?: string;
  /** Scope/filtres de la section (sourceKey multi, fediverse, indexStepList…) — même convention que search. */
  baseParams?: AgendaBaseParams;
  /**
   * Bornes et tri SERVEUR du flux (cf. `AgendaListBounds`). `{ from: now, to: now+fenêtre, order: "asc" }`
   * = les prochains (en cours en tête) ; `{ to: now, order: "desc", recurrency: false }` = les passés.
   * Sans bornes : flux DESC non borné d'avant (à éviter pour un onglet « À venir »).
   */
  bounds?: AgendaListBounds;
  enabled?: boolean;
}

/**
 * Flux d'events en mode LISTE de `searchEventsCostum` — une ligne par event, récurrents compris (le
 * backend porte leur PROCHAINE occurrence et, dès que le flux est borné, sa FIN : `endDateSortFormat`),
 * **paginé** via `next()`. C'est le mode CALENDRIER qui déplie une ligne par OCCURRENCE, d'où son
 * cantonnement à la grille.
 *
 * Le tri et les bornes sont faits CÔTÉ SERVEUR (`bounds`) : « À venir » ne dépend plus de la taille de
 * page. L'ancre `from` est rejouée telle quelle par `next()` (pagination stable) — elle doit venir de
 * l'horloge figée (`useAgendaClock`), pas d'un `new Date()` au render.
 *
 * Transform SSR + hydratation gérés par le hook commun. Scope = baseParams.sourceKey sinon costum courant.
 */
export function useAgendaList({ type, name, baseParams, bounds, enabled = true }: UseAgendaListParams) {
  const { entity, helper } = useCocolight();
  const scope = (entity as { serverData?: { slug?: string } } | null)?.serverData?.slug;
  const indexStep = agendaListIndexStep(baseParams);

  const { data, error, lastItemRef, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch, totalCount, hasCount } =
    useInfiniteQueryScrollNextWithTransform<Event>({
      queryKey: AGENDA_QUERY_KEYS.LIST({ scope, type, name, base: agendaBaseSig(baseParams), bounds: agendaBoundsSig(bounds) }),
      // 1ʳᵉ page seulement : le hook commun appelle `.next()` pour les suivantes (mêmes bornes rejouées).
      queryFn: async () => {
        if (!entity) throw new Error("API non initialisée - entity manquante");
        return entity.searchEventsCostum(buildAgendaListParams(indexStep, { type, name }, baseParams, bounds));
      },
      options: { enabled: !!entity && enabled, staleTime: 60 * 1000, initialPageParam: undefined },
      transform: entity ? { entity, helper } : undefined,
    });

  const events = useMemo<Event[]>(() => data?.pages?.flatMap((p) => p?.results ?? []) ?? [], [data?.pages]);

  return { events, error, lastItemRef, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch, totalCount, hasCount };
}
