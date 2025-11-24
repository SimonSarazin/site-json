import { useInfiniteQueryScroll } from "@/hooks/useInfiniteQueryScroll";
import type { EntityTypes, Project } from "@communecter/cocolight-api-client";

interface UseProfilProjectsQueryProps {
  entity: EntityTypes;
  entityType: string;
  enabled: boolean;
  indexStep?: number;
}

const PROJECTS_SUPPORTED_TYPES = new Set(["organizations", "citoyens"]);

export function useProfilProjectsQuery({
  entity,
  entityType,
  enabled,
  indexStep = 12,
}: UseProfilProjectsQueryProps) {
  const canFetchProjects = PROJECTS_SUPPORTED_TYPES.has(entityType);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  } = useInfiniteQueryScroll<Project[]>({
    queryKey: ["profile-projects", entity.id],
    queryFn: async ({ pageParam = 0 }) => {
      if (!canFetchProjects) {
        return [];
      }

      const result = await entity.getProjects({
        indexMin: pageParam as number,
        indexStep,
      });

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
      enabled: enabled && canFetchProjects,
      staleTime: 5 * 60 * 1000,
      initialPageParam: 0,
    },
  });

  const projects = data ? data.pages.flatMap((page) => page) : [];

  return {
    projects,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  };
}
