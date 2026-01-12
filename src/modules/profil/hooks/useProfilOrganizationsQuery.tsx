import { useInfiniteQueryScroll } from "@/hooks/useInfiniteQueryScroll";
import type { EntityTypes, Organization } from "@communecter/cocolight-api-client";
import { useState } from "react";

interface UseProfilOrganizationsQueryProps {
  entity: EntityTypes;
  entityType: string;
  enabled: boolean;
  indexStep?: number;
  searchQuery?: string;
}

const ORGANIZATIONS_SUPPORTED_TYPES = new Set(["citoyens"]);

export function useProfilOrganizationsQuery({
  entity,
  entityType,
  enabled,
  indexStep = 12,
  searchQuery = "",
}: UseProfilOrganizationsQueryProps) {
  const canFetchOrganizations = ORGANIZATIONS_SUPPORTED_TYPES.has(entityType);
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
    queryKey: ["profile-organizations", entity?.id, searchQuery],
    queryFn: async ({ pageParam = 0 }) => {
      if (!canFetchOrganizations || !entity?.id) {
        return [];
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
