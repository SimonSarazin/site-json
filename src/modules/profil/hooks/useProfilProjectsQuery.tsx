import { useInfiniteQueryScroll } from "@/hooks/useInfiniteQueryScroll";
import type { EntityTypes, Project } from "@communecter/cocolight-api-client";
import { useState } from "react";

interface UseProfilProjectsQueryProps {
  entity: EntityTypes;
  entityType: string;
  enabled: boolean;
  indexStep?: number;
  searchQuery?: string;
}

const PROJECTS_SUPPORTED_TYPES = new Set(["organizations", "citoyens"]);

export function useProfilProjectsQuery({
  entity,
  entityType,
  enabled,
  indexStep = 12,
  searchQuery = "",
}: UseProfilProjectsQueryProps) {
  const canFetchProjects = PROJECTS_SUPPORTED_TYPES.has(entityType);
  const [totalCount, setTotalCount] = useState<number>(0);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  } = useInfiniteQueryScroll<Project[]>({
    queryKey: ["profile-projects", entity?.id, searchQuery],
    queryFn: async ({ pageParam = 0 }) => {
      if (!canFetchProjects || !entity?.id) {
        return [];
      }

      const result = await entity.getProjects({
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
      enabled: enabled && canFetchProjects && !!entity?.id,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      initialPageParam: 0,
    },
  });

  const projects = data ? data.pages.flatMap((page) => page) : [];

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
