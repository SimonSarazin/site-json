import {
  useInfiniteQuery,
  type UseInfiniteQueryOptions,
  type InfiniteData,
  type QueryKey,
} from "@tanstack/react-query";
import { useCallback, useRef, type RefCallback } from "react";

interface InfiniteQueryScrollProps<TData, TError = unknown> {
  queryKey: QueryKey;
  queryFn: (context: { pageParam?: unknown }) => Promise<TData>;
  getNextPageParam: (lastPage: TData, allPages: TData[]) => unknown;
  options?: Omit<
    UseInfiniteQueryOptions<
      TData,                  // TQueryFnData
      TError,                 // TError
      InfiniteData<TData>,  // TData   // TData (la valeur retournée par le hook)
      QueryKey,               // TQueryKey
      unknown                 // TPageParam
    >,
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
  refetch: () => Promise<unknown>;
  lastItemRef: RefCallback<HTMLElement>;
}

export function useInfiniteQueryScroll<TData, TError = unknown>({
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
    error: error ?? null,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
    lastItemRef,
  };
}


// Si vous avez besoin d’un hook “Next” spécialisé
export interface PageData<T> {
  results: T;
  hasNext: boolean;
  pageNumber: number;
  next?: () => Promise<PageData<T>>;
}

interface InfiniteQueryScrollNextProps<TData, TError = unknown> {
  queryKey: QueryKey;
  queryFn: (context: { pageParam?: unknown }) => Promise<PageData<TData>>;
  options?: Omit<
    UseInfiniteQueryOptions<
      PageData<TData>,        // TQueryFnData
      TError,                 // TError
      InfiniteData<PageData<TData>>,  // TData
      QueryKey,               // TQueryKey
      unknown                 // TPageParam
    >,
    "queryKey" | "queryFn" | "getNextPageParam"
  >;
}

export function useInfiniteQueryScrollNext<TData, TError = unknown>({
  queryKey,
  queryFn,
  options = { initialPageParam: undefined },
}: InfiniteQueryScrollNextProps<TData, TError>): InfiniteQueryScrollResult<
  PageData<TData>,
  TError
> {
  return useInfiniteQueryScroll<PageData<TData>, TError>({
    queryKey,
    queryFn: ({ pageParam }) =>
      pageParam != null && typeof pageParam === "object" && "next" in pageParam
        ? (pageParam as PageData<TData>).next!()
        : queryFn({ pageParam }),
    getNextPageParam: (lastPage) =>
      lastPage.hasNext
        ? { pageNumber: lastPage.pageNumber + 1, next: lastPage.next }
        : undefined,
    options
  });
}
