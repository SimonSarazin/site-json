import { useInfiniteQueryScrollNext } from "@/hooks/useInfiniteQueryScroll";
import type { EntityTypes, Organization, Project, Poi } from "@communecter/cocolight-api-client";
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
  } = useInfiniteQueryScrollNext<Organization[]>({
    queryKey: ["user-organizations", user?.slug, params],
    queryFn: async ({ pageParam }) => {
      if (!user || !isUser(user)) {
        throw new Error("User is required");
      }

      const indexMin = typeof pageParam === 'number' ? pageParam : 0;

      // Utiliser la vraie méthode API
      const result = await user.getOrganizations({
        name: params?.search,
        indexMin,
        indexStep: params?.indexStep || 20
      });

      return {
        results: result.results,
        count: result.count,
        hasNext: result.hasNext,
        pageNumber: Math.floor(indexMin / (params?.indexStep || 20)) + 1,
        next: result.next
      };
    },
    options: {
      enabled: !!(user && isUser(user)),
      staleTime: 5 * 60 * 1000, // 5 minutes
      initialPageParam: 0
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
  } = useInfiniteQueryScrollNext<Project[]>({
    queryKey: ["user-projects", user?.slug, params],
    queryFn: async ({ pageParam }) => {
      if (!user || !isUser(user)) {
        throw new Error("User is required");
      }

      const indexMin = typeof pageParam === 'number' ? pageParam : 0;

      // Utiliser la vraie méthode API
      const result = await user.getProjects({
        name: params?.search,
        indexMin,
        indexStep: params?.indexStep || 20
      });

      return {
        results: result.results,
        count: result.count,
        hasNext: result.hasNext,
        pageNumber: Math.floor(indexMin / (params?.indexStep || 20)) + 1,
        next: result.next
      };
    },
    options: {
      enabled: !!(user && isUser(user)),
      staleTime: 5 * 60 * 1000, // 5 minutes
      initialPageParam: 0
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
  } = useInfiniteQueryScrollNext<Poi[]>({
    queryKey: ["user-pois", user?.slug, params],
    queryFn: async ({ pageParam }) => {
      if (!user || !isUser(user)) {
        throw new Error("User is required");
      }

      const indexMin = typeof pageParam === 'number' ? pageParam : 0;

      // Utiliser la vraie méthode API
      const result = await user.getPois({
        name: params?.search,
        indexMin,
        indexStep: params?.indexStep || 20
      });

      return {
        results: result.results,
        count: result.count,
        hasNext: result.hasNext,
        pageNumber: Math.floor(indexMin / (params?.indexStep || 20)) + 1,
        next: result.next
      };
    },
    options: {
      enabled: !!(user && isUser(user)),
      staleTime: 5 * 60 * 1000, // 5 minutes
      initialPageParam: 0
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
 * Hook pour récupérer les événements d'un utilisateur
 */
export function useUserEvents() {
  // Pour l'instant, retournons des données vides car l'API getEvents n'est pas encore disponible
  return {
    events: [],
    totalCount: 0,
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    lastItemRef: () => {},
    error: null,
    refetch: async () => {},
  };
}