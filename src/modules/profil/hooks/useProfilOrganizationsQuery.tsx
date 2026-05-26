import { useInfiniteQueryScroll } from "@/hooks/useInfiniteQueryScroll";
import type { EntityTypes, Organization, GetMembersNoAdminData } from "@communecter/cocolight-api-client";
import { useState } from "react";
import { PROFIL_QUERY_KEYS } from "../constants/queryKeys";

interface UseProfilOrganizationsQueryProps {
  entity: EntityTypes;
  entityType: string;
  enabled: boolean;
  indexStep?: number;
  searchQuery?: string;
}

const ORGANIZATIONS_SUPPORTED_TYPES = new Set(["citoyens", "organizations"]);

const ORGANIZATION_SEARCH_TYPE: GetMembersNoAdminData["searchType"] = [
  "NGO",
  "LocalBusiness",
  "Group",
  "GovernmentOrganization",
  "Cooperative"
];

export function useProfilOrganizationsQuery({
  entity,
  entityType,
  enabled,
  indexStep = 12,
  searchQuery = "",
}: UseProfilOrganizationsQueryProps) {
  const canFetchOrganizations = ORGANIZATIONS_SUPPORTED_TYPES.has(entityType);
  const isOrganizationEntity = entityType === "organizations";
  const [totalCount, setTotalCount] = useState<number>(0);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  } = useInfiniteQueryScroll<Organization[]>({
    queryKey: PROFIL_QUERY_KEYS.PROFILE_ORGANIZATIONS(entity?.id ?? null, entityType, searchQuery),
    queryFn: async ({ pageParam = 0 }) => {
      if (!canFetchOrganizations || !entity?.id) {
        return [];
      }

      if (isOrganizationEntity) {
        const orgEntity = entity as Organization;
        const params: GetMembersNoAdminData = {
          indexMin: pageParam as number,
          indexStep,
          searchType: ORGANIZATION_SEARCH_TYPE,
          initType: "",
          count: true,
          countType: ORGANIZATION_SEARCH_TYPE,
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
        const organizations = (result?.data?.results || []) as Organization[];
        const total = result?.data?.count?.total || organizations.length;
        setTotalCount(total);
        return organizations;
      }

      const result = await entity.getOrganizations({
        indexMin: pageParam as number,
        indexStep,
        ...(searchQuery ? { name: searchQuery } : {}),
      });

      const resultWithCount = result as typeof result & { totalCount?: number };
      if (resultWithCount.totalCount !== undefined) {
        setTotalCount(resultWithCount.totalCount);
      }

      return result.results || [];
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < indexStep) {
        return undefined;
      }

      const currentIndex = allPages.reduce((acc, page) => acc + page.length, 0);
      return currentIndex;
    },
    options: {
      enabled: enabled && canFetchOrganizations && !!entity?.id,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      initialPageParam: 0,
    },
  });

  const organizations = data ? data.pages.flatMap((page) => page) : [];

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
