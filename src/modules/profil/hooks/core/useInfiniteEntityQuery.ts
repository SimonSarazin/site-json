import { useInfiniteQueryScrollNext } from "@/hooks/useInfiniteQueryScroll";
import { useMemo } from "react";
import type { QueryKey } from "@tanstack/react-query";
import type { PaginatorPage } from "@communecter/cocolight-api-client";

export interface InfiniteEntityQueryConfig<TEntity, TResult> {
  /**
   * L'entité source (peut être null)
   */
  entity: TEntity | null;

  /**
   * Fonction pour vérifier si l'entité est du bon type
   */
  typeCheck: (e: TEntity) => boolean;

  /**
   * Query key de base
   */
  queryKey: QueryKey;

  /**
   * Fonction pour récupérer les données
   */
  fetchFn: (
    entity: TEntity,
    pagination: { name?: string; indexStep: number }
  ) => Promise<PaginatorPage<TResult>>;

  /**
   * Paramètres de pagination et recherche
   */
  params?: {
    indexStep?: number;
    search?: string;
  };

  /**
   * Temps de péremption du cache (défaut: 5 minutes)
   */
  staleTime?: number;
}

export interface InfiniteEntityQueryResult<TResult> {
  items: TResult[];
  totalCount: number;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean | undefined;
  lastItemRef: (node: HTMLElement | null) => void;
  error: unknown;
  refetch: () => Promise<unknown>;
}

/**
 * Hook générique pour les queries infinies d'entités
 *
 * @example
 * const { items, totalCount, isLoading, lastItemRef } = useInfiniteEntityQuery({
 *   entity,
 *   typeCheck: isOrganization,
 *   queryKey: ["organization-members", entity?.slug],
 *   fetchFn: (e, pagination) => e.getMembers(pagination, options),
 *   params: { search, indexStep: 20 },
 * });
 */
export function useInfiniteEntityQuery<TEntity, TResult>({
  entity,
  typeCheck,
  queryKey,
  fetchFn,
  params,
  staleTime = 5 * 60 * 1000,
}: InfiniteEntityQueryConfig<TEntity, TResult>): InfiniteEntityQueryResult<TResult> {
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  } = useInfiniteQueryScrollNext<TResult>({
    queryKey,
    queryFn: async () => {
      if (!entity || !typeCheck(entity)) {
        throw new Error("Invalid entity type");
      }

      const pagination = {
        name: params?.search,
        indexStep: params?.indexStep || 20,
      };

      return fetchFn(entity, pagination);
    },
    options: {
      enabled: !!entity && typeCheck(entity),
      staleTime,
      initialPageParam: undefined,
    },
  });

  const items = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap((page) => page.results);
  }, [data]);

  const totalCount = useMemo(() => {
    if (!data || data.pages.length === 0) return 0;
    return data.pages[0].count?.total || 0;
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
