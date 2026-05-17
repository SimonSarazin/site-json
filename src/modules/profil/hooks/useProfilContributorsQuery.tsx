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

/**
 * @deprecated **Code mort — aucun consommateur dans le repo (vérifié 2026-05-15).**
 *
 * Statut : créé pour alimenter un tab "Contributeurs" sur les profils projets
 * (`Project.getContributors`). Jamais branché à un composant ; le tab profil
 * correspondant n'existe pas dans la config actuelle.
 *
 * Raison du @deprecated :
 *   - Aucun import dans `src/` / `tests/` / `e2e/` (grep exhaustif).
 *   - Cast `(entity as unknown as { getContributors(...) })` au lieu d'un narrow `isProject`
 *     — anti-pattern (cf. AUDIT-cocolight-api-client.md §H2).
 *
 * Alternative active :
 *   - Si le tab "Contributeurs" est ré-introduit, utiliser le pattern de `useFriendsQuery`
 *     (narrow `isProject` + `useInfiniteQueryScrollNextWithTransform` + appel direct
 *     `project.getContributors({...})` typé natif).
 *
 * À reviewer : supprimer dès la prochaine itération de cleanup hooks orphelins
 * (même profil que C1 / C2 dans AUDIT-cocolight-api-client.md, et que
 * [[useOrganizationAllProjects]] / [[useProfilSubscriptionsQuery]]).
 */
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

      const result = await (entity as unknown as { getContributors(params: Record<string, unknown>): Promise<{ results?: (User | Organization)[] }> }).getContributors({
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
