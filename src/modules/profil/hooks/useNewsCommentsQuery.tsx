import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { News, Comment } from "@communecter/cocolight-api-client";
import cocolightApiClient from "@communecter/cocolight-api-client";
import { transformToEntityInstance } from "@/lib/entityTransform";
import { useCocolight } from "@/hooks/useCocolight";

const { isReactive } = cocolightApiClient;

export function useNewsCommentsQuery(news: News | null) {
  const queryClient = useQueryClient();
  const { helper } = useCocolight();

  const query = useQuery({
    queryKey: ["news-comments", news?.id],
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

    const currentData = queryClient.getQueryData<Comment[]>(["news-comments", news.id]);

    if (currentData && currentData.length > 0) {
      // Vérifier si c'est des plain objects (après SSR)
      const firstItem = currentData[0];
      if (firstItem && firstItem.serverData && !isReactive(firstItem.serverData)) {
        if (import.meta.env.DEV) {
          console.log("🔄 Transformation du cache des commentaires après hydratation SSR");
        }
        // Transformer tout le cache en instances Proxy
        queryClient.setQueryData(["news-comments", news.id],
          currentData.map(item => transformToEntityInstance<Comment>(item, helper, news))
        );
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return query;
}
