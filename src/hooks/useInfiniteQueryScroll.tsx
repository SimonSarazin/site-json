import {
  useInfiniteQuery,
  type UseInfiniteQueryOptions,
  type InfiniteData,
  type QueryKey,
} from "@tanstack/react-query";
import { useCallback, useRef, type RefCallback } from "react";
import type { PaginatorPage } from "@communecter/cocolight-api-client";

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

  const observerRef = useRef<IntersectionObserver>();
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
