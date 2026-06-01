import { useInfiniteQueryScrollNextWithTransform } from "@/hooks/useInfiniteQueryScroll";
import type { EntityTypes, Organization, Project, Event, Poi, PaginatorPage } from "@communecter/cocolight-api-client";
import { isOrganization, isProject } from "@/lib/getTypedEntity";
import { useMemo } from "react";
import type { RelationType, RelatedEntitiesParams, UseRelatedEntitiesResult } from "../types";
import { useCocolight } from "@/hooks/useCocolight";
import { PROFIL_QUERY_KEYS } from "../constants/queryKeys";

export type { RelationType, RelatedEntitiesParams, UseRelatedEntitiesResult };

/**
 * Hook pour récupérer les entités liées (projets, événements, POI) d'une organisation ou projet
 * avec infinite scroll
 */
export function useRelatedEntities(
  entity: EntityTypes | null,
  relationType: RelationType,
  params?: RelatedEntitiesParams
): UseRelatedEntitiesResult {
  const { helper } = useCocolight();

  const {
    data,
    totalCount,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  } = useInfiniteQueryScrollNextWithTransform<Organization | Project | Event | Poi>({
    queryKey: PROFIL_QUERY_KEYS.RELATED_ENTITIES(entity?.slug ?? null, relationType, params),
    queryFn: async ({ pageParam }) => {
      if (!entity) {
        throw new Error("Entity is required");
      }

      const page = pageParam as PaginatorPage<Organization | Project | Event | Poi> |  undefined

      const queryParams = {
        name: params?.search,
        indexMin: 0,
        indexStep: params?.indexStep || 20,
      };

      let result: PaginatorPage<Organization | Project | Event | Poi>

      // Récupérer les entités liées selon le type de relation
      switch (relationType) {
        case "projects":
          // Les projets sont accessibles depuis les organizations
          if (isOrganization(entity)) {
            result = await entity.getProjects(queryParams);
          } else {
            // Pour les autres types d'entités, retourner un résultat vide
            return {
              results: [],
              count: { total: 0 },
              hasNext: false,
              hasPrev: false,
              pageNumber: 1,
              pageIndex: 0,
            };
          }
          break;

        case "events":
          // Les événements sont accessibles depuis organizations et projects
          if (isOrganization(entity)) {
            result = await entity.getEvents(queryParams);
          } else if (isProject(entity)) {
            result = await entity.getEvents(queryParams);
          } else {
            return { results: [], count: { total: 0 }, hasNext: false, hasPrev: false, pageNumber: 1, pageIndex: 0 };
          }
          break;

        case "poi":
          // Les POI sont accessibles depuis organizations
          if (isOrganization(entity)) {
            result = await entity.getPois(queryParams);
          } else {
            return {
              results: [],
              count: { total: 0 },
              hasNext: false,
              hasPrev: false,
              pageNumber: 1,
              pageIndex: 0,
            };
          }
          break;

        case "organizations":
          // Organisations partenaires : les orgas dont les `links.members`
          // contiennent l'orga courante (= orgas où elle est membre). Pas de
          // méthode dédiée -> searchCostum avec le filtre links.members.<id>.
          if (isOrganization(entity)) {
            const orgParam = {
              searchType: ["organizations"],
              filters: { ["links.members." + entity.id]: { $exists: true } },
              indexMin: 0,
              indexStep: params?.indexStep || 20,
              count: true,
              countType: ["organizations"],
              notSourceKey: true,
              name: params?.search,
            };
            result = (await entity.searchCostum(
              orgParam as unknown as Parameters<typeof entity.searchCostum>[0],
            )) as PaginatorPage<Organization | Project | Event | Poi>;
          } else {
            return { results: [], count: { total: 0 }, hasNext: false, hasPrev: false, pageNumber: 1, pageIndex: 0 };
          }
          break;

        default:
          return {
            results: [],
            count: { total: 0 },
            hasNext: false,
            hasPrev: false,
            pageNumber: 1,
            pageIndex: 0,
          };
      }

      // Use next() function if available and we're on a subsequent page
      if (
        page &&
        page.pageNumber &&
        page.pageNumber > 1 &&
        typeof page.next !== "function" &&
        result.next
      ) {
        return result.next();
      }

      return result;
    },
    options: {
      enabled: !!entity,
      staleTime: 5 * 60 * 1000,
      initialPageParam: undefined,
    },
    transform: entity ? { entity, helper } : undefined,
  });

  const entities = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap((page) => page.results);
  }, [data]);

  return {
    entities,
    totalCount,
    isLoading,
    isFetchingNextPage,
    hasNextPage: !!hasNextPage,
    lastItemRef,
    error: error as Error | null,
    refetch,
  };
}
