import { useMemo } from "react";
import { useInfiniteQueryScroll } from "@/hooks/useInfiniteQueryScroll";
import { useCocolight } from "@/hooks/useCocolight";
import { transformToEntityInstance } from "@/lib/entityTransform";
import type { EntityTypes, News } from "@communecter/cocolight-api-client";

interface UseProfilNewsQueryProps {
  entity: EntityTypes;
  entityType: string;
  enabled: boolean;
  indexStep?: number;
}

const NEWS_SUPPORTED_TYPES = new Set(["organizations", "projects", "citoyens"]);

/**
 * Hook pour charger les actualités d'un profil avec infinite scroll
 *
 * Utilise la pagination timestamp-based de l'API Communecter.
 * Les dates sont converties en secondes (Unix timestamp) comme attendu par l'API.
 */
export function useProfilNewsQuery({
  entity,
  entityType,
  enabled,
  indexStep = 12,
}: UseProfilNewsQueryProps) {
  const { helper } = useCocolight();
  const canFetchNews = NEWS_SUPPORTED_TYPES.has(entityType);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  } = useInfiniteQueryScroll<News[]>({
    queryKey: ["profile-news", entity.id],
    queryFn: async ({ pageParam = Math.floor(Date.now() / 1000) }) => {
      if (!canFetchNews) {
        return [];
      }

      return entity.getNews({
        indexStep,
        dateLimit: pageParam as number,
      });
    },
    getNextPageParam: (lastPage) => {
      // Si la page est complète (indexStep items), il y a probablement d'autres pages
      if (lastPage.length < indexStep) {
        return undefined; // Pas de page suivante
      }

      // Utiliser la date du dernier item comme cursor pour la prochaine page
      // Convertir en secondes (Unix timestamp) au lieu de millisecondes
      const lastItem = lastPage[lastPage.length - 1];

      const lastItemInstance = transformToEntityInstance<News>(lastItem, helper, entity);

      // Vérifier que la date existe et est valide
      if (!lastItemInstance?.serverData?.date) {
        return undefined; // Pas de date, on ne peut pas continuer la pagination
      }

      const timestampInSeconds = Math.floor(lastItemInstance.serverData.date.getTime() / 1000);
      return timestampInSeconds;
    },
    options: {
      enabled: enabled && canFetchNews,
      staleTime: 5 * 60 * 1000, // Cache 5 minutes
      initialPageParam: Math.floor(Date.now() / 1000),
    },
  });

  // Transformation des résultats pour s'assurer qu'on a des instances News complètes
  const news = useMemo(() => {
    const flatNews = data ? data.pages.flatMap((page) => page) : [];
    if (!flatNews.length) return [];

    return flatNews.map((item: News | Record<string, unknown>) =>
      transformToEntityInstance<News>(item, helper, entity)
    );
  }, [data, entity, helper]);

  return {
    news,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  };
}
