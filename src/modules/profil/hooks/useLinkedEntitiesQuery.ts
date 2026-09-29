import { useMemo } from "react";
import { useInfiniteQueryScrollNextWithTransform } from "@/hooks/useInfiniteQueryScroll";
import { useCocolight } from "@/hooks/useCocolight";
import { useHydratedUserContextId } from "@/hooks/useHydratedUserContextId";
import { PROFIL_QUERY_KEYS } from "../constants/queryKeys";
import type { EntityTypes, PaginatorPage, SearchEntity } from "@communecter/cocolight-api-client";

/** Collections acceptées par `searchCostum` (sous-ensemble de `GlobalAutocompleteCostumData.searchType`). */
export type LinkedEntitiesSearchType = "events" | "projects" | "organizations";

/**
 * `{"$or": {"links.attendees.id1": {$exists:true}, "links.organizer.id1": {$exists:true}, …}}`
 *
 * Pour des entités RATTACHÉES par un LIEN à un ensemble d'organisations — ex. les événements où
 * l'utilisateur assiste OU organise via l'un de ses lieux (`linkFields: ["links.attendees",
 * "links.organizer"]`), ou les projets dont ils sont contributeurs (`["links.contributors"]`).
 * Portage du legacy `costum.views.custom.franceTierslieux.listOrga` (onglets Agenda/Projets).
 *
 * ⚠ `$or` en OBJET, pas en tableau Mongo standard — le DSL Communecter n'accepte que cette forme
 * (`doc/05-schemas-sections.md` § `searchProStatic.defaultFilters.$or` : « un tableau provoque une
 * erreur 500 backend »). Confirmé en test réel : la version tableau faisait sortir
 * `MongoException: $or/$and/$nor entries need to be full objects`. Chaque clé
 * (`<champ>.<orgId>`) est déjà unique par construction (les ids diffèrent) : aucune collision
 * n'écrase une clause en repassant par un objet plutôt qu'un tableau.
 */
export function buildLinkedEntitiesFilter(
  orgIds: readonly string[],
  linkFields: readonly string[],
): Record<string, unknown> {
  const or: Record<string, unknown> = {};
  for (const id of orgIds) {
    for (const field of linkFields) {
      or[`${field}.${id}`] = { $exists: true };
    }
  }
  return { $or: or };
}

export interface LinkedEntitiesParams {
  /** Filtre déjà construit (`buildLinkedEntitiesFilter`) — cf. ci-dessus. */
  filters: Record<string, unknown>;
  /** Collection SDK ciblée. */
  searchType: LinkedEntitiesSearchType;
  /** Discrimine le cache d'un autre appel avec le même `searchType` (ids ou slugs des lieux). */
  cacheKey: readonly string[];
  indexStep?: number;
  /** Skip le fetch si false (en plus de `cacheKey.length > 0` requis — un `$or`/`$in` vide matcherait TOUT). */
  enabled?: boolean;
}

/**
 * Entités RATTACHÉES aux lieux de l'utilisateur (`filters` déjà construit par l'appelant) — appel
 * DIRECT `entity.searchCostum()` (le porteur du site, comme tout le moteur de recherche ; cf.
 * `useSearchQuery.ts`), pas `useSearchQuery` : cette requête n'a ni texte, ni tags, ni les couches
 * `defaultTypes`/`searchType`-en-tags de `buildSearchPayload` — un filtre déjà complet suffit, et le
 * passer par le moteur générique aurait exigé de trancher une ambiguïté de ce moteur (`type` vs
 * `defaultTypes`) que rien ici ne permettait de vérifier contre un backend réel.
 */
export function useLinkedEntitiesQuery(params: LinkedEntitiesParams) {
  const { entity, helper } = useCocolight();
  const userContextId = useHydratedUserContextId();
  const { filters, searchType, cacheKey, indexStep = 20, enabled = true } = params;

  const {
    data,
    totalCount,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  } = useInfiniteQueryScrollNextWithTransform<SearchEntity>({
    queryKey: [
      ...PROFIL_QUERY_KEYS.LINKED_ENTITIES(searchType, cacheKey, userContextId),
      indexStep,
    ],
    queryFn: async ({ pageParam }) => {
      if (!entity) throw new Error("Site entity is required");
      const page = pageParam as PaginatorPage<SearchEntity> | undefined;

      const result = await entity.searchCostum({
        searchType: [searchType],
        filters,
        notSourceKey: true,
        indexMin: 0,
        indexStep,
      });

      if (
        page &&
        page.pageNumber &&
        page.pageNumber > 1 &&
        typeof page.next !== "function" &&
        result.next
      ) {
        return result.next() as unknown as PaginatorPage<SearchEntity>;
      }
      return result as unknown as PaginatorPage<SearchEntity>;
    },
    options: {
      enabled: !!entity && cacheKey.length > 0 && enabled,
      staleTime: 5 * 60 * 1000,
      initialPageParam: undefined,
    },
    transform: entity ? { entity, helper } : undefined,
  });

  const items = useMemo(() => {
    if (!data) return [] as EntityTypes[];
    return data.pages.flatMap((page) => page.results) as unknown as EntityTypes[];
  }, [data]);

  return {
    items,
    totalCount,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  };
}
