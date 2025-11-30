import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useT } from "@/hooks/useT";
import { useCocolight } from "@/hooks/useCocolight";
import type { News, EntityTypes } from "@communecter/cocolight-api-client";

interface MutationOptions {
  optimistic?: boolean;
}

interface NewsData {
  text?: string;
  scope?: "public" | "private" | "restricted";
  tags?: string[];
}

/**
 * Hook pour supprimer une actualité
 * Migré depuis modules/news/hooks/useNewsMutations.tsx
 *
 * @param entity - L'entité propriétaire (pour mettre à jour le cache)
 * @param options - Options incluant optimistic updates
 */
export function useDeleteNews(entity: EntityTypes, options?: MutationOptions) {
  const queryClient = useQueryClient();
  const t = useT("modules/news");
  const entityId = entity.id || "";

  return useMutation({
    mutationFn: async ({ news }: { news: News }) => {
      await news.delete();
      return { newsId: news.id };
    },

    onMutate: options?.optimistic
      ? async (variables) => {
          await queryClient.cancelQueries({ queryKey: ["news", entityId] });

          const previousData = queryClient.getQueryData<{ pages: News[][] }>(
            ["news", entityId]
          );

          // Optimistic update: remove from cache
          queryClient.setQueryData<{ pages: News[][] }>(
            ["news", entityId],
            (old) => {
              if (!old) return old;

              return {
                ...old,
                pages: old.pages.map(page =>
                  page.filter(n => n.id !== variables.news.id)
                ),
              };
            }
          );

          return { previousData };
        }
      : undefined,

    onError: (error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["news", entityId], context.previousData);
      }

      toast.error(t("toast.deleteError"), {
        description: error instanceof Error ? error.message : t("toast.error.generic"),
      });
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news", entityId] });
      toast.success(t("toast.deleteSuccess"));
    },
  });
}

/**
 * Hook pour modifier une actualité
 * @param entity - L'entité propriétaire (pour mettre à jour le cache)
 * @param options - Options incluant optimistic updates
 */
export function useEditNews(entity: EntityTypes, options?: MutationOptions) {
  const queryClient = useQueryClient();
  const t = useT("modules/news");
  const entityId = entity.id || "";

  return useMutation({
    mutationFn: async ({
      news,
      newsData,
      images,
      documents,
      newText,
      newScope,
      newTags,
    }: {
      news: News;
      newsData?: NewsData;
      images?: File[];
      documents?: File[];
      // Keep old interface for backward compatibility
      newText?: string;
      newScope?: "public" | "private" | "restricted";
      newTags?: string[];
    }) => {
      // Use new interface if provided, otherwise fall back to old interface
      if (newsData) {
        news.data.text = newsData.text;
        news.data.scope = newsData.scope;
        news.data.tags = newsData.tags;
      } else {
        // Backward compatibility
        if (newText !== undefined) news.data.text = newText;
        if (newScope !== undefined) news.data.scope = newScope;
        if (newTags !== undefined) news.data.tags = newTags;
      }

      // Handle images upload if provided
      if (images && images.length > 0) {
        for (const image of images) {
          await news.addImage(image);
        }
      }

      // Handle documents upload if provided
      if (documents && documents.length > 0) {
        for (const document of documents) {
          await news.addFile(document);
        }
      }

      // Save changes
      const result = await news.save();
      return { news, result };
    },

    onMutate: options?.optimistic
      ? async (variables) => {
          await queryClient.cancelQueries({ queryKey: ["news", entityId] });

          const previousData = queryClient.getQueryData<{ pages: News[][] }>(
            ["news", entityId]
          );

          // Optimistic update: mutate the proxy directly
          queryClient.setQueryData<{ pages: News[][] }>(
            ["news", entityId],
            (old) => {
              if (!old) return old;

              old.pages.forEach(page =>
                page.forEach(n => {
                  if (n.id === variables.news.id) {
                    if (variables.newText !== undefined) n.data.text = variables.newText;
                    if (variables.newScope !== undefined) n.data.scope = variables.newScope;
                    if (variables.newTags !== undefined) n.data.tags = variables.newTags;
                  }
                })
              );

              return old;
            }
          );

          return { previousData };
        }
      : undefined,

    onError: (error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["news", entityId], context.previousData);
      }

      toast.error(t("toast.editError"), {
        description: error instanceof Error ? error.message : t("toast.error.generic"),
      });
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news", entityId] });
      toast.success(t("toast.editSuccess"));
    },
  });
}

/**
 * Hook pour créer une nouvelle actualité
 * @param entity - L'entité propriétaire (pour mettre à jour le cache)
 */
export function useAddNews(entity: EntityTypes) {
  const queryClient = useQueryClient();
  const t = useT("modules/news");
  const entityId = entity.id || "";

  return useMutation({
    mutationFn: async ({
      newsData,
      images,
      documents
    }: {
      newsData: NewsData;
      images?: File[];
      documents?: File[];
    }) => {
      if (!entity) throw new Error("User not connected");

      // Créer l'objet News
      const news = await entity.news(newsData);

      // Ajouter les images si présentes
      if (images && images.length > 0) {
        for (const image of images) {
          await news.addImage(image);
        }
      }

      if(documents && documents.length > 0){
        for (const document of documents) {
          await news.addFile(document);
        }
      }

      // Sauvegarder la news
      await news.save();

      return { news };
    },

    onSuccess: () => {
      toast.success(t("toast.addSuccess"));
      queryClient.invalidateQueries({ queryKey: ["news", entityId] });
    },

    onError: (error) => {
      toast.error(t("toast.addError"), {
        description: error instanceof Error ? error.message : t("toast.error.generic"),
      });
    },
  });
}

/**
 * Hook pour ajouter des images à une actualité existante
 * @param entity - L'entité propriétaire (pour mettre à jour le cache)
 */
export function useAddNewsImage(entity: EntityTypes) {
  const queryClient = useQueryClient();
  const t = useT("modules/news");
  const entityId = entity.id || "";

  return useMutation({
    mutationFn: async ({
      news,
      images,
    }: {
      news: News;
      images: File[];
    }) => {
      // Ajouter les images
      for (const image of images) {
        await news.addImage(image);
      }

      // Sauvegarder les modifications
      await news.save();

      return { news };
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news", entityId] });
      toast.success(t("toast.editSuccess"));
    },

    onError: (error) => {
      toast.error(t("toast.editError"), {
        description: error instanceof Error ? error.message : t("toast.error.generic"),
      });
    },
  });
}

/**
 * Hook pour ajouter une mention à une actualité
 * @param entity - L'entité propriétaire (pour mettre à jour le cache)
 */
export function useAddNewsMention(entity: EntityTypes) {
  const queryClient = useQueryClient();
  const t = useT("modules/news");
  const entityId = entity.id || "";

  return useMutation({
    mutationFn: async ({
      news,
      slug,
    }: {
      news: News;
      slug: string;
    }) => {
      // Ajouter la mention
      const mentions = await news.addMention({ slug });
      // Sauvegarder les modifications
      await news.save();

      return { news, mentions };
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news", entityId] });
      toast.success(t("toast.editSuccess"));
    },

    onError: (error) => {
      toast.error(t("toast.editError"), {
        description: error instanceof Error ? error.message : t("toast.error.generic"),
      });
    },
  });
}

/**
 * Hook pour partager une actualité
 * @param entity - L'entité qui partage (pour mettre à jour le cache)
 */
export function useShareNews(entity: EntityTypes) {
  const queryClient = useQueryClient();
  const t = useT("modules/news");
  const { me } = useCocolight();
  const entityId = entity.id || "";

  return useMutation({
    mutationFn: async ({
      originalNews,
      text,
    }: {
      originalNews: News;
      text?: string;
    }) => {
      if (!me) throw new Error("User not connected");

      const shareData = {
        comment: text || "",
      };

      const sharedNews = await originalNews.shareNews(shareData);

      return { sharedNews, originalNews };
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news", entityId] });
      toast.success(t("toast.addSuccess"));
    },

    onError: (error) => {
      toast.error(t("toast.addError"), {
        description: error instanceof Error ? error.message : t("toast.error.generic"),
      });
    },
  });
}

/**
 * Hook pour ajouter une réaction (vote) à une actualité
 * @param entity - L'entité propriétaire (pour mettre à jour le cache)
 * @param options - Options incluant optimistic updates
 */
export function useAddVoteNews(entity: EntityTypes | null | undefined, options?: MutationOptions) {
  const queryClient = useQueryClient();
  const t = useT("modules/news");
  const { me } = useCocolight();
  const entityId = entity?.id || "";

  return useMutation({
    mutationFn: async ({
      news,
      voteType,
    }: {
      news: News;
      voteType: string;
    }) => {
      if (!me) throw new Error("User not connected");

      // Ajouter le vote via l'API
      await news.addVote(voteType);

      return { news, voteType };
    },

    onMutate: options?.optimistic
      ? async (variables) => {
          await queryClient.cancelQueries({ queryKey: ["news", entityId] });

          const previousData = queryClient.getQueryData<{ pages: News[][] }>(
            ["news", entityId]
          );

          // Optimistic update: increment vote count
          queryClient.setQueryData<{ pages: News[][] }>(
            ["news", entityId],
            (old) => {
              if (!old) return old;

              old.pages.forEach(page =>
                page.forEach(n => {
                  if (n.id === variables.news.id) {
                    // Mise à jour optimiste du voteCount
                    const voteCount = n.serverData.voteCount as Record<string, number> | undefined;
                    if (!voteCount) {
                      n.serverData.voteCount = { [variables.voteType]: 1 };
                    } else {
                      const currentCount = voteCount[variables.voteType] || 0;
                      voteCount[variables.voteType] = currentCount + 1;
                    }
                  }
                })
              );

              return old;
            }
          );

          return { previousData };
        }
      : undefined,

    onError: (error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["news", entityId], context.previousData);
      }

      toast.error(t("toast.voteError"), {
        description: error instanceof Error ? error.message : t("toast.error.generic"),
      });
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news", entityId] });
      toast.success(t("toast.voteSuccess"));
    },
  });
}

/**
 * Hook pour signaler une actualité
 */
export function useReportNews() {
  const t = useT("modules/news");

  return useMutation({
    mutationFn: async ({
      news,
      reason,
      comment,
    }: {
      news: News;
      reason: string;
      comment?: string;
    }) => {
      console.log("[useReportNews] Reporting news:", { newsId: news.id, reason, comment });
      await news.addReportAbuse({ reason, comment });
      return { newsId: news.id };
    },

    onSuccess: () => {
      toast.success(t("toast.report.success"));
    },

    onError: (error) => {
      console.error("[useReportNews] Error:", error);
      toast.error(t("toast.report.error"), {
        description: error instanceof Error ? error.message : t("toast.error.generic"),
      });
    },
  });
}