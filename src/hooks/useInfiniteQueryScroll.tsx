import { useInfiniteQuery, type UseInfiniteQueryOptions, type InfiniteData, type QueryKey } from "@tanstack/react-query";
import { useCallback, useRef, RefCallback } from "react";

interface InfiniteQueryScrollProps<TData, TError> {
  queryKey: QueryKey;
  queryFn: (context: { pageParam: any }) => Promise<TData>;
  getNextPageParam: (lastPage: TData, allPages: TData[]) => any | undefined;
  options?: Omit<UseInfiniteQueryOptions<TData, TError, TData, TData, QueryKey>, 'queryKey' | 'queryFn' | 'getNextPageParam'>;
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

export const useInfiniteQueryScroll = <TData, TError = unknown>({
  queryKey,
  queryFn,
  getNextPageParam,
  options = {}
}: InfiniteQueryScrollProps<TData, TError>): InfiniteQueryScrollResult<TData, TError> => {

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
    ...options
  });

  const observerRef = useRef<IntersectionObserver>();
  
  const lastItemRef = useCallback<RefCallback<HTMLElement>>(
    (node) => {
      if (isLoading || isFetchingNextPage) return;
      if (observerRef.current) observerRef.current.disconnect();
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
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
    lastItemRef
  };
};

interface PageData<TData> extends TData {
  hasNext: boolean;
  pageNumber: number;
  next?: () => Promise<PageData<TData>>;
}

interface InfiniteQueryScrollNextProps<TData, TError> {
  queryKey: QueryKey;
  queryFn: (context: { pageParam: any }) => Promise<PageData<TData>>;
  options?: Omit<UseInfiniteQueryOptions<PageData<TData>, TError, PageData<TData>, PageData<TData>, QueryKey>, 'queryKey' | 'queryFn' | 'getNextPageParam'>;
}

export const useInfiniteQueryScrollNext = <TData, TError = unknown>({
  queryKey,
  queryFn,
  options = {}
}: InfiniteQueryScrollNextProps<TData, TError>): InfiniteQueryScrollResult<PageData<TData>, TError> => {

  return useInfiniteQueryScroll<PageData<TData>, TError>({
    queryKey,
    queryFn: ({ pageParam = 0 }) => {
      if (typeof pageParam?.next === "function") {
        return pageParam.next();
      } else {
        return queryFn({ pageParam });
      }
    },
    getNextPageParam: (lastPage) => {
      if (lastPage?.hasNext === true) {
        return { pageNumber: lastPage?.pageNumber + 1, next: lastPage?.next };
      }
      return undefined;
    },
    options
  });
};
