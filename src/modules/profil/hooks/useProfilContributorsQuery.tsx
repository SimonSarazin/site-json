import { useInfiniteQueryScroll } from "@/hooks/useInfiniteQueryScroll";
import type { EntityTypes, User, Organization } from "@communecter/cocolight-api-client";

interface UseProfilContributorsQueryProps {
  entity: EntityTypes;
  entityType: string;
  enabled: boolean;
  indexStep?: number;
  searchQuery?: string;
}

const CONTRIBUTORS_SUPPORTED_TYPES = new Set(["projects"]);

export function useProfilContributorsQuery({
  entity,
  entityType,
  enabled,
  indexStep = 12,
  searchQuery = "",
}: UseProfilContributorsQueryProps) {
  const canFetchContributors = CONTRIBUTORS_SUPPORTED_TYPES.has(entityType);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  } = useInfiniteQueryScroll<(User | Organization)[]>({
    queryKey: ["profile-contributors", entity.id, searchQuery],
    queryFn: async ({ pageParam = 0 }) => {
      if (!canFetchContributors) {
        return [];
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (entity as any).getContributors({
        indexMin: pageParam as number,
        indexStep,
        ...(searchQuery ? { name: searchQuery } : {}),
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
      enabled: enabled && canFetchContributors,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      initialPageParam: 0,
    },
  });

  const contributors = data ? data.pages.flatMap((page) => page) : [];

  return {
    contributors,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  };
}
