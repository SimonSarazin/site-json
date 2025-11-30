import { useQuery } from "@tanstack/react-query";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { NEWS_QUERY_KEYS } from "../constants/queryKeys";

interface useNewsByIdQueryProps {
  newsId: string;
  entity: EntityTypes;
  enabled?: boolean;
}

/**
 * Hook pour récupérer une news spécifique par son ID
 */
export const useNewsByIdQuery = ({ newsId, entity, enabled = true }: useNewsByIdQueryProps) => {
  return useQuery({
    queryKey: NEWS_QUERY_KEYS.NEWS_BY_ID(entity.id ?? null, newsId),
    queryFn: async () => {
      // Utiliser la méthode getNewsById de l'API
      const news = await entity.news({ id: newsId});
      if (!news) {
        throw new Error(`News with ID ${newsId} not found`);
      }
      return news;
    },
    enabled: enabled && !!newsId && !!entity,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};