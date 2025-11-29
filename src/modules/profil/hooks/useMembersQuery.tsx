import type { EntityTypes, User, Organization } from "@communecter/cocolight-api-client";
import { isOrganization, isProject, isEvent } from "@/lib/getTypedEntity";
import { useInfiniteEntityQuery } from "./core";

export interface MemberQueryOptions {
  toBeValidated?: boolean;
  isAdmin?: boolean;
  isAdminPending?: boolean;
  isInviting?: boolean;
  roles?: unknown[];
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
  const result = useInfiniteEntityQuery<EntityTypes, User | Organization>({
    entity,
    typeCheck: isOrganization,
    queryKey: ["organization-members", entity?.slug, options, params],
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
  const result = useInfiniteEntityQuery<EntityTypes, User | Organization>({
    entity,
    typeCheck: isProject,
    queryKey: ["project-contributors", entity?.slug, options, params],
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
  const result = useInfiniteEntityQuery<EntityTypes, User | Organization>({
    entity,
    typeCheck: isEvent,
    queryKey: ["event-attendees", entity?.slug, options, params],
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
