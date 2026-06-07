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

export interface EligiblePlacesQueryParams extends MembershipQueryParams {
  /**
   * Filtres MongoDB arbitraires propagés à `searchFilters` côté serveur.
   * Ex: `{ tags: "Tiers-Lieu", "source.key": "tiersliexorg" }`. Mergé côté
   * SDK avec les filtres `links.members.{id}` qui restreignent à memberOf.
   */
  filters?: Record<string, unknown>;
  /**
   * Désactive le filtre automatique par sourceKey du contexte (cf.
   * SearchNew.php). Configurable selon la config du finder du formulaire.
   */
  notSourceKey?: boolean;
  /** Skip le fetch si false (en plus du `user && isUser(user)` requis). */
  enabled?: boolean;
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
 * Hook pour récupérer les organisations memberOf de l'utilisateur, filtrées
 * côté serveur par des `filters` arbitraires et un flag `notSourceKey`.
 *
 * Utilisé par la vue collaborative coform/place — permet de pré-filtrer les
 * lieux éligibles à un formulaire (tags, sourceKey, etc.) directement côté
 * serveur, pour avoir une pagination correcte indépendamment du filtre.
 */
export function useUserEligiblePlaces(
  user: EntityTypes | null,
  params?: EligiblePlacesQueryParams
) {
  const userContextId = useHydratedUserContextId();
  const { helper } = useCocolight();

  const {
    data,
    totalCount,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    fetchNextPage,
    error,
    refetch,
  } = useInfiniteQueryScrollNextWithTransform<Organization>({
    queryKey: [
      ...PROFIL_QUERY_KEYS.USER_ORGANIZATIONS(user?.slug ?? null, userContextId),
      "eligible",
      params,
    ],
    queryFn: async ({ pageParam }) => {
      if (!user || !isUser(user)) {
        throw new Error("User is required");
      }

      const page = pageParam as PaginatorPage<Organization> | undefined;

      const result = await user.getEligiblePlaces({
        name: params?.search,
        indexMin: 0,
        indexStep: params?.indexStep || 20,
        filters: params?.filters,
        notSourceKey: params?.notSourceKey,
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
      enabled: !!(user && isUser(user)) && (params?.enabled ?? true),
      staleTime: 5 * 60 * 1000,
      initialPageParam: undefined,
    },
    transform: user ? { entity: user, helper } : undefined,
  });

  const organizations = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap((page) => page.results);
  }, [data]);

  return {
    organizations,
    totalCount,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    fetchNextPage,
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