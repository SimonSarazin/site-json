import { useInfiniteQueryScrollNextWithTransform } from "@/hooks/useInfiniteQueryScroll";
import type { EntityTypes, Organization, Project, Poi, Event, PaginatorPage } from "@communecter/cocolight-api-client";
import { isUser } from "@/lib/getTypedEntity";
import { useMemo } from "react";
import { PROFIL_QUERY_KEYS } from "../constants/queryKeys";
import { useHydratedUserContextId } from "@/hooks/useHydratedUserContextId";
import { useCocolight } from "@/hooks/useCocolight";

export interface MembershipQueryParams {
  indexStep?: number;
  search?: string;
  filters?: Record<string, unknown>;
}

/**
 * Hook pour récupérer les organisations d'un utilisateur avec infinite scroll
 */
export function useUserOrganizations(user: EntityTypes | null, params?: MembershipQueryParams) {
  const userContextId = useHydratedUserContextId();
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
  } = useInfiniteQueryScrollNextWithTransform<Organization>({
    queryKey: [...PROFIL_QUERY_KEYS.USER_ORGANIZATIONS(user?.slug ?? null, userContextId), params],
    queryFn: async ({ pageParam }) => {
      if (!user || !isUser(user)) {
        throw new Error("User is required");
      }

      const page = pageParam as PaginatorPage<Organization> | undefined;

      const result = await user.getOrganizations({
        name: params?.search,
        indexMin: 0,
        indexStep: params?.indexStep || 20,
        ...(params?.filters ? { filters: params.filters } : {}),
      });

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
      staleTime: 5 * 60 * 1000,
      initialPageParam: undefined
    },
    transform: user ? { entity: user, helper } : undefined,
  });

  const organizations = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap(page => page.results);
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
  const userContextId = useHydratedUserContextId();
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
  } = useInfiniteQueryScrollNextWithTransform<Project>({
    queryKey: [...PROFIL_QUERY_KEYS.USER_PROJECTS(user?.slug ?? null, userContextId), params],
    queryFn: async ({ pageParam }) => {
      if (!user || !isUser(user)) {
        throw new Error("User is required");
      }

      const page = pageParam as PaginatorPage<Project> | undefined;

      const result = await user.getProjects({
        name: params?.search,
        indexMin: 0,
        indexStep: params?.indexStep || 20
      });

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
      staleTime: 5 * 60 * 1000,
      initialPageParam: undefined
    },
    transform: user ? { entity: user, helper } : undefined,
  });

  const projects = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap(page => page.results);
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
  const userContextId = useHydratedUserContextId();
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
  } = useInfiniteQueryScrollNextWithTransform<Poi>({
    queryKey: [...PROFIL_QUERY_KEYS.USER_POIS(user?.slug ?? null, userContextId), params],
    queryFn: async ({ pageParam }) => {
      if (!user || !isUser(user)) {
        throw new Error("User is required");
      }

      const page = pageParam as PaginatorPage<Poi> | undefined;

      const result = await user.getPois({
        name: params?.search,
        indexMin: 0,
        indexStep: params?.indexStep || 20
      });

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
      staleTime: 5 * 60 * 1000,
      initialPageParam: undefined
    },
    transform: user ? { entity: user, helper } : undefined,
  });

  const pois = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap(page => page.results);
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
  const userContextId = useHydratedUserContextId();
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
  } = useInfiniteQueryScrollNextWithTransform<Event>({
    queryKey: [...PROFIL_QUERY_KEYS.USER_EVENTS(user?.slug ?? null, userContextId), params],
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
      staleTime: 5 * 60 * 1000,
      initialPageParam: undefined
    },
    transform: user ? { entity: user, helper } : undefined,
  });

  const events = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap(page => page.results);
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