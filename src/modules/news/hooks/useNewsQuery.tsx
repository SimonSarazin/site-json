import { useEffect, useMemo } from "react";
import { useInfiniteQueryScroll } from "@/hooks/useInfiniteQueryScroll";
import { useCocolight } from "@/hooks/useCocolight";
import { useHydratedUserContextId } from "@/hooks/useHydratedUserContextId";
import { transformToEntityInstance } from "@/lib/entityTransform";
import type { EntityTypes, News } from "@communecter/cocolight-api-client";
import { useQueryClient } from "@tanstack/react-query";
import cocolightApiClient from "@communecter/cocolight-api-client";
import { NEWS_QUERY_KEYS } from "../constants/queryKeys";

const { isReactive } = cocolightApiClient;

interface UseNewsQueryProps {
  entity: EntityTypes | null;
  entityType: string | null;
  enabled?: boolean;
  indexStep?: number;
}

const NEWS_SUPPORTED_TYPES = new Set(["organizations", "projects", "citoyens"]);

/**
 * Hook pour charger les actualités d'un profil avec infinite scroll - restauré à l'original
 *
 * Utilise la pagination timestamp-based de l'API Communecter.
 * Les dates sont converties en secondes (Unix timestamp) comme attendu par l'API.
 */
export function useNewsQuery({
  entity,
  entityType,
  enabled = true,
  indexStep = 12,
}: UseNewsQueryProps) {
  const { helper } = useCocolight();
  const queryClient = useQueryClient();
  const canFetchNews = entityType ? NEWS_SUPPORTED_TYPES.has(entityType) : true;

  // userContextId compatible SSR : null au premier render, puis la vraie valeur après hydratation
  const userContextId = useHydratedUserContextId();
  const queryKey = useMemo(() => {
    return NEWS_QUERY_KEYS.NEWS(entity?.id ?? null, userContextId);
  }, [entity?.id, userContextId]);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  } = useInfiniteQueryScroll<News[]>({
    queryKey,
    queryFn: async ({ pageParam }) => {
      if (!canFetchNews || !entity) {
        return [];
      }

      const params: { indexStep: number; dateLimit?: number } = { indexStep };
      if (pageParam) {
        params.dateLimit = pageParam as number;
      }

      return entity.getNews(params);
    },
    getNextPageParam: (lastPage: News[]) => {
      // Si la page est complète (indexStep items), il y a probablement d'autres pages
      if (lastPage.length < indexStep) {
        return undefined; // Pas de page suivante
      }

      // Utiliser la date du dernier item comme cursor pour la prochaine page
      // Convertir en secondes (Unix timestamp) au lieu de millisecondes
      const lastItem = lastPage[lastPage.length - 1];

      // Vérifier que entity existe avant de transformer
      if (!entity) {
        return undefined;
      }

      const lastItemInstance = transformToEntityInstance<News>(lastItem, helper, entity);

      // Vérifier que la date existe et est valide
      if (!lastItemInstance?.serverData?.date) {
        return undefined; // Pas de date, on ne peut pas continuer la pagination
      }

      const timestampInSeconds = Math.floor(lastItemInstance.serverData.date.getTime() / 1000);
      return timestampInSeconds;
    },
    options: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10,   // 10 minutes
      enabled: enabled && canFetchNews && !!entity,
      initialPageParam: undefined,
    }
  });

  // Transformer le cache une seule fois après l'hydratation SSR
  useEffect(() => {
    if (!entity) return;

    const currentData = queryClient.getQueryData<{ pages: News[][];  pageParams: unknown[] }>(queryKey);

    if (currentData?.pages && currentData.pages.length > 0) {
      // Vérifier si c'est des plain objects (après SSR)
      const firstItem = currentData.pages[0]?.[0];
      if (firstItem && firstItem.serverData && !isReactive(firstItem.serverData)) {
        if (import.meta.env.DEV) {
          console.log("🔄 Transformation du cache après hydratation SSR");
        }
        // Transformer tout le cache en instances Proxy
        queryClient.setQueryData(queryKey, {
          ...currentData,
          pages: currentData.pages.map(page =>
            page.map(item => transformToEntityInstance<News>(item, helper, entity))
          )
        });
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const news = useMemo(() => {
    if (!data || !entity) return [];

    return data.pages.flatMap((page) =>
      page.map(item => {
        // Si déjà transformé (Proxy), le retourner tel quel
        if (item.serverData && isReactive(item.serverData)) {
          return item;
        }
        // Sinon transformer en instance Proxy
        return transformToEntityInstance<News>(item, helper, entity);
      })
    );
  }, [data, helper, entity]);

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