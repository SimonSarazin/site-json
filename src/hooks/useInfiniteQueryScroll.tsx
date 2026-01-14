import {
  useInfiniteQuery,
  useQueryClient,
  type UseInfiniteQueryOptions,
  type InfiniteData,
  type QueryKey,
} from "@tanstack/react-query";
import { useCallback, useRef, useEffect, useMemo, type RefCallback } from "react";
import type { PaginatorPage, EntityTypes } from "@communecter/cocolight-api-client";
import Cocolight from "@communecter/cocolight-api-client";
import { restorePaginationFromJSON, transformToEntityInstance } from "@/lib/entityTransform";

type CocolightHelper = typeof Cocolight.helper;
const { isReactive } = Cocolight;

interface InfiniteQueryScrollProps<TData, TError = Error> {
  queryKey: QueryKey;
  queryFn: (context: { pageParam?: unknown }) => Promise<TData>;
  getNextPageParam: (lastPage: TData, allPages: TData[]) => unknown;
  options?: Omit<
    UseInfiniteQueryOptions<TData, TError, InfiniteData<TData>, QueryKey, unknown>,
    "queryKey" | "queryFn" | "getNextPageParam"
  >;
}

interface InfiniteQueryScrollResult<TData, TError> {
  data: InfiniteData<TData> | undefined;
  error: TError | null;
  fetchNextPage: () => Promise<unknown>;
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  isPending: boolean;
  refetch: () => Promise<unknown>;
  lastItemRef: RefCallback<HTMLElement>;
}

export function useInfiniteQueryScroll<TData, TError = Error>({
  queryKey,
  queryFn,
  getNextPageParam,
  options = { initialPageParam: undefined },
}: InfiniteQueryScrollProps<TData, TError>): InfiniteQueryScrollResult<
  TData,
  TError
> {

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isPending,
    refetch,
  } = useInfiniteQuery({
    queryKey,
    queryFn,
    getNextPageParam,
    ...options,
  });

  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastItemRef: RefCallback<HTMLElement> = useCallback(
    (node) => {
      if (isLoading || isFetchingNextPage) return;
      observerRef.current?.disconnect();
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasNextPage) {
          fetchNextPage();
        }
      });
      if (node) observerRef.current.observe(node);
    },
    [isLoading, isFetchingNextPage, hasNextPage, fetchNextPage]
  );

  return {
    data,
    error: (error ?? null) as TError | null,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isPending,
    refetch,
    lastItemRef,
  };
}


// Hook "Next" spécialisé utilisant PaginatorPage de @communecter/cocolight-api-client
interface InfiniteQueryScrollNextProps<TData, TError = unknown> {
  queryKey: QueryKey;
  queryFn: (context: { pageParam?: unknown }) => Promise<PaginatorPage<TData>>;
  options?: Omit<
    UseInfiniteQueryOptions<
      PaginatorPage<TData>,        // TQueryFnData
      TError,                      // TError
      InfiniteData<PaginatorPage<TData>>,  // TData
      QueryKey,                    // TQueryKey
      unknown                      // TPageParam
    >,
    "queryKey" | "queryFn" | "getNextPageParam"
  >;
}

export function useInfiniteQueryScrollNext<TData, TError = unknown>({
  queryKey,
  queryFn,
  options = { initialPageParam: undefined },
}: InfiniteQueryScrollNextProps<TData, TError>): InfiniteQueryScrollResult<
  PaginatorPage<TData>,
  TError
> {
  return useInfiniteQueryScroll<PaginatorPage<TData>, TError>({
    queryKey,
    queryFn: ({ pageParam }) =>
      pageParam != null && typeof pageParam === "object" && "next" in pageParam
        ? (pageParam as PaginatorPage<TData>).next!()
        : queryFn({ pageParam }),
    getNextPageParam: (lastPage) =>
      lastPage.hasNext
        ? { pageNumber: lastPage.pageNumber + 1, next: lastPage.next }
        : undefined,
    options
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook avec transformation SSR intégrée
// ─────────────────────────────────────────────────────────────────────────────

interface SSRTransformConfig {
  entity: EntityTypes;
  helper: CocolightHelper;
  /** Restaurer pagination première page (default: true) */
  restoreFirstPage?: boolean;
  /** Transformer résultats en Proxy (default: true) */
  transformResults?: boolean;
}

interface InfiniteQueryScrollNextWithTransformProps<TData, TError = unknown>
  extends InfiniteQueryScrollNextProps<TData, TError> {
  /** Config transformation SSR (optionnel - si absent, pas de transformation) */
  transform?: SSRTransformConfig;
}

/**
 * Hook useInfiniteQueryScrollNext avec transformation SSR automatique
 *
 * Transforme automatiquement les données après hydratation SSR :
 * - Restaure la pagination (next/prev methods) sur la première page
 * - Transforme les résultats en instances Proxy réactives
 *
 * @example
 * const { entity, helper } = useCocolight();
 * const result = useInfiniteQueryScrollNextWithTransform({
 *   queryKey,
 *   queryFn,
 *   options,
 *   transform: { entity, helper },
 * });
 */
export function useInfiniteQueryScrollNextWithTransform<TData, TError = unknown>({
  queryKey,
  queryFn,
  options,
  transform,
}: InfiniteQueryScrollNextWithTransformProps<TData, TError>): InfiniteQueryScrollResult<
  PaginatorPage<TData>,
  TError
> & { totalCount: number; hasCount: boolean } {
  const queryClient = useQueryClient();

  const result = useInfiniteQueryScrollNext<TData, TError>({
    queryKey,
    queryFn,
    options,
  });

  // Transformation SSR après hydratation - met à jour le cache
  useEffect(() => {
    if (!transform?.entity || !result.data?.pages?.length) return;

    const { entity, helper, restoreFirstPage = true, transformResults = true } = transform;
    const firstPage = result.data.pages[0];
    const firstItem = firstPage?.results?.[0];

    // Vérifier si besoin de transformation (plain objects post-SSR)
    if (firstItem && typeof firstItem === 'object' && 'serverData' in firstItem && !isReactive((firstItem as Record<string, unknown>).serverData)) {
      if (import.meta.env.DEV) {
        console.log("🔄 Transformation du cache après hydratation SSR");
      }

      const currentData = queryClient.getQueryData<InfiniteData<PaginatorPage<TData>>>(queryKey);
      if (!currentData?.pages) return;

      queryClient.setQueryData(queryKey, {
        ...currentData,
        pages: currentData.pages.map((page, i) => {
          // Restaurer pagination de la première page
          if (i === 0 && restoreFirstPage) {
            return restorePaginationFromJSON<TData>(page, helper, entity);
          }
          // Transformer les résultats des autres pages
          if (transformResults) {
            return {
              ...page,
              results: page.results?.map(item =>
                transformToEntityInstance<TData>(item as unknown, helper, entity)
              ) ?? [],
            };
          }
          return page;
        }),
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Retourner les données transformées (pour le flux synchrone avant que le cache ne soit mis à jour)
  const transformedData = useMemo(() => {
    if (!transform?.entity || !result.data?.pages?.length) return result.data;

    const { entity, helper, restoreFirstPage = true, transformResults = true } = transform;
    const firstPage = result.data.pages[0];
    const firstItem = firstPage?.results?.[0];

    // Si déjà transformé, retourner tel quel
    if (!firstItem || typeof firstItem !== 'object' || !('serverData' in firstItem) || isReactive((firstItem as Record<string, unknown>).serverData)) {
      return result.data;
    }

    // Transformer les données pour le render synchrone
    return {
      ...result.data,
      pages: result.data.pages.map((page, i) => {
        // Restaurer pagination de la première page
        if (i === 0 && restoreFirstPage) {
          return restorePaginationFromJSON<TData>(page, helper, entity);
        }
        // Transformer les résultats des autres pages en instances Proxy
        if (transformResults && page.results) {
          return {
            ...page,
            results: page.results.map(item => {
              // Si déjà transformé, retourner tel quel
              if (item && typeof item === 'object' && 'serverData' in item && isReactive((item as Record<string, unknown>).serverData)) {
                return item;
              }
              return transformToEntityInstance<TData>(item as unknown, helper, entity);
            }),
          };
        }
        return page;
      }),
    };
  }, [result.data, transform]);

  // Extraire le count de la première page
  const firstPageCount = transformedData?.pages?.[0]?.count;
  const hasCount = !!(firstPageCount && typeof firstPageCount === 'object');
  const totalCount = useMemo(() => {
    if (hasCount && 'total' in firstPageCount) {
      return (firstPageCount as { total: number }).total;
    }
    return 0;
  }, [hasCount, firstPageCount]);

  return {
    ...result,
    data: transformedData,
    totalCount,
    hasCount,
  };
}
