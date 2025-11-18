import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";

interface DeleteNewsParams {
  newsId: string;
}

export function useDeleteNews() {
  const { api } = useCocolight();
  const queryClient = useQueryClient();

  const deleteNews = useMutation({
    mutationFn: async ({ newsId }: DeleteNewsParams) => {
      if (!api) {
        throw new Error("API client not initialized");
      }

      const response = await api.endpointApi.deleteNews({
        pathParams: {
          id: newsId
        },
        isLive: true
      });
      return response.data;
    },
    onMutate: async ({ newsId }) => {
      await queryClient.cancelQueries({ queryKey: ["profile-news"] });

      const previousData = queryClient.getQueryData(["profile-news"]);

      queryClient.setQueriesData(
        { queryKey: ["profile-news"] },
        (old: any) => {
          if (!old?.pages) return old;

          return {
            ...old,
            pages: old.pages.map((page: any) => {
              if (!page?.items) return page;

              return {
                ...page,
                items: page.items.filter((item: any) => item && item.id !== newsId),
              };
            }),
          };
        }
      );

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["profile-news"], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-news"] });
    },
  });

  return {
    deleteNews: deleteNews.mutate,
    deleteNewsAsync: deleteNews.mutateAsync,
    isDeletingNews: deleteNews.isPending,
    error: deleteNews.error,
  };
}
