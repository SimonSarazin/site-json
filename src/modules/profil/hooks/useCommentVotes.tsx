import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { PROFIL_QUERY_KEYS } from "../constants/queryKeys";

interface VoteUser {
  _id: { $id: string };
  profilThumbImageUrl?: string;
  name: string;
  slug?: string;
  status: string;
  date: { sec: number; usec: number };
}

interface CommentVoteResponse {
  _id: { $id: string };
  vote: Record<string, VoteUser>;
  voteCount: Record<string, number>;
}

export function useCommentVotes(commentId: string | null) {
  const { api } = useCocolight();

  return useQuery({
    queryKey: PROFIL_QUERY_KEYS.COMMENT_VOTES(commentId),
    queryFn: async () => {
      if (!commentId || !api) {
        throw new Error("Missing commentId or api");
      }

      const response = await api.endpointApi.showVote({
        pathParams: {
          type: "comments", // erreurs
          id: commentId,
        },
      });

      return response as CommentVoteResponse;
    },
    enabled: !!commentId && !!api,
    staleTime: 5 * 60 * 1000,
  });
}
