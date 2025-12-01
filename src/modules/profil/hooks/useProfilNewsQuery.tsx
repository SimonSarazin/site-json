import { useEffect } from "react";
import { useInfiniteQueryScroll } from "@/hooks/useInfiniteQueryScroll";
import { useCocolight } from "@/hooks/useCocolight";
import { transformToEntityInstance } from "@/lib/entityTransform";
import type { EntityTypes, News } from "@communecter/cocolight-api-client";
import { useQueryClient } from "@tanstack/react-query";
import cocolightApiClient from "@communecter/cocolight-api-client";

const { isReactive } = cocolightApiClient;

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
  const queryClient = useQueryClient();
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
      gcTime: 30 * 60 * 1000,
      initialPageParam: Math.floor(Date.now() / 1000),
    },
  });

  // Transformer le cache une seule fois après l'hydratation SSR
  useEffect(() => {
    const currentData = queryClient.getQueryData<{ pages: News[][];  pageParams: unknown[] }>(["profile-news", entity.id]);

    if (currentData?.pages && currentData.pages.length > 0) {
      // Vérifier si c'est des plain objects (après SSR)
      const firstItem = currentData.pages[0]?.[0];
      if (firstItem && firstItem.serverData && !isReactive(firstItem.serverData)) {
        if (import.meta.env.DEV) {
          console.log("🔄 Transformation du cache après hydratation SSR");
        }
        // Transformer tout le cache en instances Proxy
        queryClient.setQueryData(["profile-news", entity.id], {
          ...currentData,
          pages: currentData.pages.map(page =>
            page.map(item => transformToEntityInstance<News>(item, helper, entity))
          )
        });
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Les données du cache sont déjà des instances Proxy (transformées dans useEffect ou queryFn)
  const news = data ? data.pages.flatMap((page) => page) : [];

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
