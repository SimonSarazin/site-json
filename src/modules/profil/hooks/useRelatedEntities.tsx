import { useInfiniteQueryScrollNext } from "@/hooks/useInfiniteQueryScroll";
import type { EntityTypes, Project, Event, Poi } from "@communecter/cocolight-api-client";
import { isOrganization, isProject } from "@/lib/getTypedEntity";
import { useMemo } from "react";

// Types de relations supportés pour ProfileRelated
export type RelationType = "projects" | "events" | "poi";

export interface RelatedEntitiesParams {
  indexStep?: number;
  search?: string;
}

export interface UseRelatedEntitiesResult {
  entities: (Project | Event | Poi)[];
  totalCount: number;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  lastItemRef: (node: HTMLElement | null) => void;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook pour récupérer les entités liées (projets, événements, POI) d'une organisation ou projet
 * avec infinite scroll
 */
export function useRelatedEntities(
  entity: EntityTypes | null,
  relationType: RelationType,
  params?: RelatedEntitiesParams
): UseRelatedEntitiesResult {
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  } = useInfiniteQueryScrollNext<(Project | Event | Poi)[]>({
    queryKey: ["related-entities", entity?.slug, relationType, params],
    queryFn: async ({ pageParam }) => {
      if (!entity) {
        throw new Error("Entity is required");
      }

      const page = pageParam as {
        pageNumber?: number;
        next?: () => Promise<{
          results: (Project | Event | Poi)[];
          count: { total: number };
          hasNext: boolean;
          pageNumber: number;
          next?: () => Promise<unknown>;
        }>;
      } | undefined;

      const queryParams = {
        name: params?.search,
        indexMin: 0,
        indexStep: params?.indexStep || 20,
      };

      // Type pour le résultat de l'API
      type ApiResult = {
        results: (Project | Event | Poi)[];
        count: { total: number };
        hasNext: boolean;
        pageNumber: number;
        next?: () => Promise<ApiResult>;
      };

      let result: ApiResult | undefined;

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
              pageNumber: 1,
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
            return { results: [], count: { total: 0 }, hasNext: false, pageNumber: 1 };
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
              pageNumber: 1,
            };
          }
          break;

        default:
          return {
            results: [],
            count: { total: 0 },
            hasNext: false,
            pageNumber: 1,
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
      staleTime: 5 * 60 * 1000, // 5 minutes
      initialPageParam: undefined,
    },
  });

  const entities = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap((page) => page.results);
  }, [data]);

  const totalCount = useMemo(() => {
    if (!data || data.pages.length === 0) return 0;
    return data.pages[0].count?.total || 0;
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

/**
 * Détermine le type d'entité (pour EntityCard) à partir du relationType
 */
export function getEntityTypeFromRelation(
  relationType: RelationType
): "project" | "event" | "poi" {
  switch (relationType) {
    case "projects":
      return "project";
    case "events":
      return "event";
    case "poi":
      return "poi";
  }
}
