import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { useHydratedUserContextId } from "@/hooks/useHydratedUserContextId";
import { NEWS_QUERY_KEYS } from "../constants/queryKeys";

interface VoteUser {
  _id: { $id: string };
  profilThumbImageUrl?: string;
  name: string;
  slug?: string;
  status: string;
  date: { sec: number; usec: number };
}

interface VoteResponse {
  _id: { $id: string };
  vote: Record<string, VoteUser>;
  voteCount: Record<string, number>;
}

/**
 * Hook pour récupérer les votes d'une actualité
 * Migré depuis modules/news/hooks/useNewsVotes.tsx
 *
 * Récupère les détails des votes (qui a voté quoi) pour une actualité
 */
export function useNewsVotes(newsId: string | null) {
  const { api } = useCocolight();
  // userContextId compatible SSR : null au premier render, puis la vraie valeur après hydratation
  const userContextId = useHydratedUserContextId();

  return useQuery({
    queryKey: NEWS_QUERY_KEYS.NEWS_VOTES(newsId, userContextId),
    queryFn: async () => {
      if (!newsId || !api) {
        throw new Error("Missing newsId or api");
      }

      const response = await api.endpointApi.showVote({
        pathParams: {
          type: "news",
          id: newsId,
        },
      });

      return response as VoteResponse;
    },
    enabled: !!newsId && !!api,
    staleTime: 5 * 60 * 1000,
  });
}