import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { News, Comment } from "@communecter/cocolight-api-client";
import cocolightApiClient from "@communecter/cocolight-api-client";
import { transformToEntityInstance } from "@/lib/entityTransform";
import { useCocolight } from "@/hooks/useCocolight";
import { NEWS_QUERY_KEYS } from "../constants/queryKeys";

const { isReactive } = cocolightApiClient;

/**
 * Hook pour récupérer les commentaires d'une actualité
 * Migré depuis modules/news/hooks/useNewsCommentsQuery.tsx
 *
 * Gère la transformation des entités après hydratation SSR
 * et assure que les commentaires sont des instances Proxy réactives
 */
export function useNewsCommentsQuery(news: News | null) {
  const queryClient = useQueryClient();
  const { helper } = useCocolight();

  const query = useQuery({
    queryKey: NEWS_QUERY_KEYS.NEWS_COMMENTS(news?.id ?? null),
    queryFn: async () => {
      if (!news?.id) {
        throw new Error("Missing newsId or api");
      }

      const response = await news.getComments();

      return response;
    },
    enabled: !!news?.id,
    staleTime: 30000,
  });

  // Transformer le cache une seule fois après l'hydratation SSR
  useEffect(() => {
    if (!news?.id) return;

    const currentData = queryClient.getQueryData<Comment[]>(NEWS_QUERY_KEYS.NEWS_COMMENTS(news.id));

    if (currentData && currentData.length > 0) {
      // Vérifier si c'est des plain objects (après SSR)
      const firstItem = currentData[0];
      if (firstItem && firstItem.serverData && !isReactive(firstItem.serverData)) {
        if (import.meta.env.DEV) {
          console.log("🔄 Transformation du cache des commentaires après hydratation SSR");
        }
        // Transformer tout le cache en instances Proxy
        queryClient.setQueryData(NEWS_QUERY_KEYS.NEWS_COMMENTS(news.id),
          currentData.map(item => transformToEntityInstance<Comment>(item, helper, news))
        );
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Transformer les commentaires avant de les retourner
  const transformedData = useMemo(() => {
    if (!query.data || !Array.isArray(query.data) || !news) {
      return query.data;
    }

    return query.data.map(item => {
      // Si déjà transformé (Proxy), le retourner tel quel
      if (item.serverData && isReactive(item.serverData)) {
        return item;
      }
      // Sinon transformer en instance Proxy
      return transformToEntityInstance<Comment>(item, helper, news);
    });
  }, [query.data, helper, news]);

  return {
    ...query,
    data: transformedData,
  };
}