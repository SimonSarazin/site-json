import { useInfiniteQueryScroll } from "@/hooks/useInfiniteQueryScroll";
import type { EntityTypes, User, Organization, GetMembersNoAdminData } from "@communecter/cocolight-api-client";
import { PROFIL_QUERY_KEYS } from "../constants/queryKeys";

interface UseProfilMembersQueryProps {
  entity: EntityTypes;
  entityType: string;
  enabled: boolean;
  indexStep?: number;
  searchQuery?: string;
}

const MEMBERS_SUPPORTED_TYPES = new Set(["organizations"]);

const DEFAULT_SEARCH_TYPE: GetMembersNoAdminData["searchType"] = ["citoyens", "NGO", "LocalBusiness", "Group", "GovernmentOrganization", "Cooperative"];

export function useProfilMembersQuery({
  entity,
  entityType,
  enabled,
  indexStep = 12,
  searchQuery = "",
}: UseProfilMembersQueryProps) {
  const canFetchMembers = MEMBERS_SUPPORTED_TYPES.has(entityType);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  } = useInfiniteQueryScroll<(User | Organization)[]>({
    queryKey: PROFIL_QUERY_KEYS.PROFILE_MEMBERS(entity.id ?? null, searchQuery),
    queryFn: async ({ pageParam = 0 }) => {
      if (!canFetchMembers) {
        return [];
      }

      const orgEntity = entity as Organization;
      const params: GetMembersNoAdminData = {
        indexMin: pageParam as number,
        indexStep,
        searchType: DEFAULT_SEARCH_TYPE,
        initType: "",
        count: true,
        countType: DEFAULT_SEARCH_TYPE,
        notSourceKey: true,
        locality: "",
        fediverse: false,
        filters: {
          [`links.memberOf.${entity.id}`]: { "$exists": true },
          [`links.memberOf.${entity.id}.toBeValidated`]: { "$exists": false },
          [`links.memberOf.${entity.id}.isInviting`]: { "$exists": false }
        },
        ...(searchQuery ? { name: searchQuery } : {}),
      };

      const result = await orgEntity.endpointApi.getMembersNoAdmin(params);

      return result?.data?.results || [];
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < indexStep) {
        return undefined;
      }

      const currentIndex = allPages.reduce((acc, page) => acc + page.length, 0);
      return currentIndex;
    },
    options: {
      enabled: enabled && canFetchMembers,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      initialPageParam: 0,
    },
  });

  const members = data ? data.pages.flatMap((page) => page) : [];

  return {
    members,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  };
}
