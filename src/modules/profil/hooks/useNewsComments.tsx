import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";

interface CommentAuthor {
  id: string;
  name: string;
  username?: string;
  profilThumbImageUrl?: string;
}

interface CommentReply {
  _id: { $id: string };
  text: string;
  created: number;
  author: CommentAuthor;
  vote?: Record<string, { status: string; date: { sec: number; usec: number } }>;
  voteCount?: Record<string, number>;
}

interface Comment {
  _id: { $id: string };
  text: string;
  created: number;
  author: CommentAuthor;
  vote?: Record<string, { status: string; date: { sec: number; usec: number } }>;
  voteCount?: Record<string, number>;
  replies?: Record<string, CommentReply>;
}

interface CommentsResponse {
  [key: string]: Comment;
}

export function useNewsComments(newsId: string | null) {
  const { api } = useCocolight();

  return useQuery({
    queryKey: ["news-comments", newsId],
    queryFn: async () => {
      if (!newsId || !api) {
        throw new Error("Missing newsId or api");
      }

      const response = await api.endpointApi.getComments({
        pathParams: {
          type: "news",
          id: newsId,
        },
      });

      return response as CommentsResponse;
    },
    enabled: !!newsId && !!api,
    staleTime: 30000,
  });
}
