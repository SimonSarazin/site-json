import type { EntityTypes, User, Organization } from "@communecter/cocolight-api-client";
import { isOrganization, isProject, isEvent } from "@/lib/getTypedEntity";
import { useInfiniteEntityQuery } from "@/hooks/useInfiniteEntityQuery";
import type { MemberQueryOptions, MemberQueryParams } from "../types";
import { PROFIL_QUERY_KEYS } from "../constants/queryKeys";
import { useHydratedUserContextId } from "@/hooks/useHydratedUserContextId";

export type { MemberQueryOptions, MemberQueryParams };

/**
 * Hook pour récupérer les membres d'une organisation
 */
export function useOrganizationMembers(
  entity: EntityTypes | null,
  options: MemberQueryOptions = {},
  params?: MemberQueryParams
) {
  // userContextId compatible SSR : null au premier render, puis la vraie valeur après hydratation
  const userContextId = useHydratedUserContextId();

  const result = useInfiniteEntityQuery<EntityTypes, User | Organization>({
    entity,
    typeCheck: isOrganization,
    queryKey: [...PROFIL_QUERY_KEYS.ORGANIZATION_MEMBERS(entity?.slug ?? null, userContextId), options, params],
    fetchFn: (e, pagination) => {
      if (!isOrganization(e)) throw new Error("Entity must be an organization");
      return e.getMembers(pagination, options);
    },
    params,
  });

  return {
    ...result,
    members: result.items,
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
  // userContextId compatible SSR : null au premier render, puis la vraie valeur après hydratation
  const userContextId = useHydratedUserContextId();

  const result = useInfiniteEntityQuery<EntityTypes, User | Organization>({
    entity,
    typeCheck: isProject,
    queryKey: [...PROFIL_QUERY_KEYS.PROJECT_CONTRIBUTORS(entity?.slug ?? null, userContextId), options, params],
    fetchFn: (e, pagination) => {
      if (!isProject(e)) throw new Error("Entity must be a project");
      return e.getContributors(pagination, options);
    },
    params,
  });

  return {
    ...result,
    contributors: result.items,
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
  // userContextId compatible SSR : null au premier render, puis la vraie valeur après hydratation
  const userContextId = useHydratedUserContextId();

  const result = useInfiniteEntityQuery<EntityTypes, User | Organization>({
    entity,
    typeCheck: isEvent,
    queryKey: [...PROFIL_QUERY_KEYS.EVENT_ATTENDEES(entity?.slug ?? null, userContextId), options, params],
    fetchFn: (e, pagination) => {
      if (!isEvent(e)) throw new Error("Entity must be an event");
      return e.getAttendees(pagination, options);
    },
    params,
  });

  return {
    ...result,
    attendees: result.items,
  };
}

/**
 * Hook générique pour récupérer les membres selon le type d'entité
 */
export function useEntityMembers(
  entity: EntityTypes | null,
  options: MemberQueryOptions = {},
  pagination: MemberQueryParams = {}
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
      members: orgQuery.members,
    };
  } else if (entity && isProject(entity)) {
    return {
      ...projectQuery,
      members: projectQuery.contributors,
    };
  } else if (entity && isEvent(entity)) {
    return {
      ...eventQuery,
      members: eventQuery.attendees,
    };
  }

  return {
    totalCount: 0,
    members: [],
    items: [],
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    lastItemRef: () => {},
    error: null,
    refetch: async () => {},
  };
}
