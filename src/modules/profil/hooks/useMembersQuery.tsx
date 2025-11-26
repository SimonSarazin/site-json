import { useInfiniteQueryScrollNext } from "@/hooks/useInfiniteQueryScroll";
import type { EntityTypes, User, Organization } from "@communecter/cocolight-api-client";
import { isOrganization, isProject, isEvent } from "@/lib/getTypedEntity";
import { useMemo } from "react";

export interface MemberQueryOptions {
  toBeValidated?: boolean;
  isAdmin?: boolean;
  isAdminPending?: boolean;
  isInviting?: boolean;
  roles?: any[];
}

export interface MemberQueryParams {
  indexStep?: number;
  search?: string;
}

/**
 * Hook pour récupérer les membres d'une organisation
 */
export function useOrganizationMembers(
  entity: EntityTypes | null,
  options: MemberQueryOptions = {},
  params?: MemberQueryParams
) {
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  } = useInfiniteQueryScrollNext<(User | Organization)[]>({
    queryKey: ["organization-members", entity?.slug, options, params],
    queryFn: async ({ pageParam }) => {
      if (!entity || !isOrganization(entity)) {
        throw new Error("Entity must be an organization");
      }

      const page = pageParam as { pageNumber?: number; next?: () => Promise<{ results: any[]; count: any; hasNext: boolean; pageNumber: number; next?: () => Promise<any> }> } | undefined;
      const pagination = {
        name: params?.search,
        indexStep: params?.indexStep || 20
      };

        const result = await entity.getMembers(pagination, options);

        console.log("useOrganizationMembers result:", result);

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
      enabled: !!entity && isOrganization(entity),
      staleTime: 5 * 60 * 1000,
      initialPageParam: undefined
    }
  });

  const members = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap(page => page.results);
  }, [data]);

  const totalCount = useMemo(() => {
    if (!data || data.pages.length === 0) return 0;
    return data.pages[0].count?.total || 0;
  }, [data]);

  return {
    totalCount: totalCount,
    members,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  };
}

/**
 * Hook pour récupérer les contributeurs d'un projet
 */
export function useProjectContributors(
  entity: EntityTypes | null,
  options: MemberQueryOptions = {},
  params?: MemberQueryParams
) {
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  } = useInfiniteQueryScrollNext<(User | Organization)[]>({
    queryKey: ["project-contributors", entity?.slug, options, params],
    queryFn: async ({ pageParam }) => {
      if (!entity || !isProject(entity)) {
        throw new Error("Entity must be a project");
      }

      const page = pageParam as { pageNumber?: number; next?: () => Promise<{ results: any[]; count: any; hasNext: boolean; pageNumber: number; next?: () => Promise<any> }> } | undefined;
      const pagination = {
        name: params?.search,
        indexStep: params?.indexStep || 20
      };

      const result = await entity.getContributors(pagination, options);

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
      enabled: !!entity && isProject(entity),
      staleTime: 5 * 60 * 1000,
      initialPageParam: undefined
    }
  });

  const contributors = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap(page => page.results);
  }, [data]);

  const totalCount = useMemo(() => {
    if (!data || data.pages.length === 0) return 0;
    return data.pages[0].count?.total || 0;
  }, [data]);

  return {
    totalCount: totalCount,
    contributors,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  };
}

/**
 * Hook pour récupérer les participants d'un événement
 */
export function useEventAttendees(
  entity: EntityTypes | null,
  options: MemberQueryOptions = {},
  params?: MemberQueryParams
) {
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  } = useInfiniteQueryScrollNext<(User | Organization)[]>({
    queryKey: ["event-attendees", entity?.slug, options, params],
    queryFn: async ({ pageParam }) => {
      if (!entity || !isEvent(entity)) {
        throw new Error("Entity must be an event");
      }

      const page = pageParam as { pageNumber?: number; next?: () => Promise<{ results: any[]; count: any; hasNext: boolean; pageNumber: number; next?: () => Promise<any> }> } | undefined;
      const pagination = {
        name: params?.search,
        indexStep: params?.indexStep || 20
      };

      const result = await entity.getAttendees(pagination, options);

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
      enabled: !!entity && isEvent(entity),
      staleTime: 5 * 60 * 1000,
      initialPageParam: undefined
    }
  });

  const attendees = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap(page => page.results);
  }, [data]);

  const totalCount = useMemo(() => {
    if (!data || data.pages.length === 0) return 0;
    return data.pages[0].count?.total || 0;
  }, [data]);

  return {
    totalCount: totalCount,
    attendees,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  };
}

/**
 * Hook générique pour récupérer les membres selon le type d'entité
 */
export function useEntityMembers(
  entity: EntityTypes | null,
  options: MemberQueryOptions = {},
  pagination = {}
) {
  const orgQuery = useOrganizationMembers(
    entity && isOrganization(entity) ? entity : null,
    options,
    pagination
  );
  const projectQuery = useProjectContributors(
    entity && isProject(entity) ? entity : null,
    options,
    pagination
  );
  const eventQuery = useEventAttendees(
    entity && isEvent(entity) ? entity : null,
    options,
    pagination
  );

  if (entity && isOrganization(entity)) {
    return {
      ...orgQuery,
      members: orgQuery.members
    };
  } else if (entity && isProject(entity)) {
    return {
      ...projectQuery,
      members: projectQuery.contributors
    };
  } else if (entity && isEvent(entity)) {
    return {
      ...eventQuery,
      members: eventQuery.attendees
    };
  }

  return {
    totalCount: 0,
    members: [],
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    lastItemRef: () => {},
    error: null,
    refetch: async () => {}
  };
}