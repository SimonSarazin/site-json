import { useInfiniteQueryScrollNext } from "@/hooks/useInfiniteQueryScroll";
import type { EntityTypes, Organization, Project, Poi, Event, PaginatorPage } from "@communecter/cocolight-api-client";
import { isUser } from "@/lib/getTypedEntity";
import { useMemo } from "react";

export interface MembershipQueryParams {
  indexStep?: number;
  search?: string;
}

/**
 * Hook pour récupérer les organisations d'un utilisateur avec infinite scroll
 */
export function useUserOrganizations(user: EntityTypes | null, params?: MembershipQueryParams) {
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  } = useInfiniteQueryScrollNext<Organization>({
    queryKey: ["user-organizations", user?.slug, params],
    queryFn: async ({ pageParam }) => {
      if (!user || !isUser(user)) {
        throw new Error("User is required");
      }

      const page = pageParam as PaginatorPage<Organization> | undefined;

      // Utiliser la vraie méthode API
      const result = await user.getOrganizations({
        name: params?.search,
        indexMin: 0,
        indexStep: params?.indexStep || 20
      });

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
      enabled: !!(user && isUser(user)),
      staleTime: 5 * 60 * 1000, // 5 minutes
      initialPageParam: undefined
    }
  });

  const organizations = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap(page => page.results);
  }, [data]);

  const totalCount = useMemo(() => {
    if (!data || data.pages.length === 0) return 0;
    return data.pages[0].count?.total || 0;
  }, [data]);

  return {
    organizations,
    totalCount,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  };
}

/**
 * Hook pour récupérer les projets d'un utilisateur avec infinite scroll
 */
export function useUserProjects(user: EntityTypes | null, params?: MembershipQueryParams) {
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  } = useInfiniteQueryScrollNext<Project>({
    queryKey: ["user-projects", user?.slug, params],
    queryFn: async ({ pageParam }) => {
      if (!user || !isUser(user)) {
        throw new Error("User is required");
      }

      const page = pageParam as PaginatorPage<Project> | undefined;

      // Utiliser la vraie méthode API
      const result = await user.getProjects({
        name: params?.search,
        indexMin: 0,
        indexStep: params?.indexStep || 20
      });

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
      enabled: !!(user && isUser(user)),
      staleTime: 5 * 60 * 1000, // 5 minutes
      initialPageParam: undefined
    }
  });

  const projects = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap(page => page.results);
  }, [data]);

  const totalCount = useMemo(() => {
    if (!data || data.pages.length === 0) return 0;
    return data.pages[0].count?.total || 0;
  }, [data]);

  return {
    projects,
    totalCount,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  };
}

/**
 * Hook pour récupérer les POIs d'un utilisateur avec infinite scroll
 */
export function useUserPois(user: EntityTypes | null, params?: MembershipQueryParams) {
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  } = useInfiniteQueryScrollNext<Poi>({
    queryKey: ["user-pois", user?.slug, params],
    queryFn: async ({ pageParam }) => {
      if (!user || !isUser(user)) {
        throw new Error("User is required");
      }

      const page = pageParam as PaginatorPage<Poi> | undefined;

      // Utiliser la vraie méthode API
      const result = await user.getPois({
        name: params?.search,
        indexMin: 0,
        indexStep: params?.indexStep || 20
      });

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
      enabled: !!(user && isUser(user)),
      staleTime: 5 * 60 * 1000, // 5 minutes
      initialPageParam: undefined
    }
  });

  const pois = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap(page => page.results);
  }, [data]);

  const totalCount = useMemo(() => {
    if (!data || data.pages.length === 0) return 0;
    return data.pages[0].count?.total || 0;
  }, [data]);

  return {
    pois,
    totalCount,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  };
}

/**
 * Hook pour récupérer les événements d'un utilisateur avec infinite scroll
 */
export function useUserEvents(user: EntityTypes | null, params?: MembershipQueryParams) {
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  } = useInfiniteQueryScrollNext<Event>({
    queryKey: ["user-events", user?.slug, params],
    queryFn: async ({ pageParam }) => {
      if (!user || !isUser(user)) {
        throw new Error("User is required");
      }

      const page = pageParam as PaginatorPage<Event> | undefined;

      const result = await user.getEvents({
        name: params?.search,
        indexMin: 0,
        indexStep: params?.indexStep || 20
      });

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
      enabled: !!(user && isUser(user)),
      staleTime: 5 * 60 * 1000, // 5 minutes
      initialPageParam: undefined
    }
  });

  const events = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap(page => page.results);
  }, [data]);

  const totalCount = useMemo(() => {
    if (!data || data.pages.length === 0) return 0;
    return data.pages[0].count?.total || 0;
  }, [data]);

  return {
    events,
    totalCount,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  };
}