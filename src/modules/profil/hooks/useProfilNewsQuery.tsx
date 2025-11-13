import { useMemo } from "react";
import { useInfiniteQueryScroll } from "@/hooks/useInfiniteQueryScroll";
import { useCocolight } from "@/hooks/useCocolight";
import type { News } from "@communecter/cocolight-api-client";

interface EntityWithNews {
  id: string | null;
  getNews: (data?: { indexStep?: number; dateLimit?: number }) => Promise<News[]>;
}

interface UseProfilNewsQueryProps {
  entity: EntityWithNews;
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
      const timestampInSeconds = Math.floor(lastItem.serverData.date.getTime() / 1000);
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

    return flatNews.map((item: News | Record<string, unknown>) => {
      // Si c'est déjà une instance d'entité avec la méthode getEntityType, on la garde
      if (item && typeof item === "object" && "getEntityType" in item) {
        return item as News;
      }
      // Sinon, on essaie de transformer via helper
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return helper.fromEntityJSON(item, entity as any) as News;
      } catch {
        // Si la transformation échoue, on retourne l'item tel quel (cast via unknown)
        return item as unknown as News;
      }
    });
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
