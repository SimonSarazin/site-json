import { useMemo } from "react";
import { useCocolight } from "@/hooks/useCocolight";
import { useInfiniteQueryScrollNextWithTransform } from "@/hooks/useInfiniteQueryScroll";
import type { Event } from "@communecter/cocolight-api-client";
import { AGENDA_QUERY_KEYS } from "../constants/queryKeys";
import { agendaBaseSig, agendaListIndexStep, buildAgendaListParams, type AgendaBaseParams } from "../lib/buildAgendaParams";

export interface UseAgendaListParams {
  type?: string;
  name?: string;
  /** Scope/filtres de la section (sourceKey multi, fediverse, indexStepList…) — même convention que search. */
  baseParams?: AgendaBaseParams;
  enabled?: boolean;
}

/**
 * Flux d'events en mode LISTE de `searchEventsCostum` (sans bornes de dates, `startDate` DESC,
 * **paginé** via scroll infini `next()`).
 *
 * Sert les TROIS onglets de la vue liste (En cours / À venir / Passés) depuis un seul flux, le
 * partitionnement étant client (`partitionByTime`) : une ligne par event, récurrents compris — c'est
 * le mode CALENDRIER qui déplie une ligne par OCCURRENCE, d'où son cantonnement à la grille.
 *
 * ⚠ Le tri DESC porte sur TOUT le flux : la première page contient les events les plus LOINTAINS, pas
 * les prochains. Un onglet « À venir » ne montre donc que ce que les pages déjà chargées contiennent
 * — garder `baseParams.indexStepList` au-dessus du volume d'events à venir du site (cf. la docstring
 * de `limit` dans `schema.ts`).
 *
 * Transform SSR + hydratation gérés par le hook commun. Scope = baseParams.sourceKey sinon costum courant.
 */
export function useAgendaList({ type, name, baseParams, enabled = true }: UseAgendaListParams) {
  const { entity, helper } = useCocolight();
  const scope = (entity as { serverData?: { slug?: string } } | null)?.serverData?.slug;
  const indexStep = agendaListIndexStep(baseParams);

  const { data, error, lastItemRef, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch, totalCount, hasCount } =
    useInfiniteQueryScrollNextWithTransform<Event>({
      queryKey: AGENDA_QUERY_KEYS.LIST({ scope, type, name, base: agendaBaseSig(baseParams) }),
      // 1ʳᵉ page seulement : le hook commun appelle `.next()` pour les suivantes.
      queryFn: async () => {
        if (!entity) throw new Error("API non initialisée - entity manquante");
        return entity.searchEventsCostum(buildAgendaListParams(indexStep, { type, name }, baseParams));
      },
      options: { enabled: !!entity && enabled, staleTime: 60 * 1000, initialPageParam: undefined },
      transform: entity ? { entity, helper } : undefined,
    });

  const events = useMemo<Event[]>(() => data?.pages?.flatMap((p) => p?.results ?? []) ?? [], [data?.pages]);

  return { events, error, lastItemRef, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch, totalCount, hasCount };
}
