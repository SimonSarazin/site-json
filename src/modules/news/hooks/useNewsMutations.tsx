import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useT } from "@/hooks/useT";
import { useCocolight } from "@/hooks/useCocolight";
import type { News, EntityTypes } from "@communecter/cocolight-api-client";
import { NEWS_QUERY_KEYS } from "../constants/queryKeys";
import { useHydratedUserContextId } from "@/hooks/useHydratedUserContextId";

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
export function useDeleteNews(entity: EntityTypes | null, options?: MutationOptions) {
  const queryClient = useQueryClient();
  const t = useT("modules/news");
  const entityId = entity?.id || "";
  const userContextId = useHydratedUserContextId();
  const newsQueryKey = NEWS_QUERY_KEYS.NEWS(entityId, userContextId);

  return useMutation({
    mutationFn: async ({ news }: { news: News }) => {
      await news.delete();
      return { newsId: news.id };
    },

    onMutate: options?.optimistic
      ? async (variables) => {
          await queryClient.cancelQueries({ queryKey: newsQueryKey });

          const previousData = queryClient.getQueryData<{ pages: News[][] }>(
            newsQueryKey
          );

          // Optimistic update: remove from cache
          queryClient.setQueryData<{ pages: News[][] }>(
            newsQueryKey,
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
        queryClient.setQueryData(newsQueryKey, context.previousData);
      }

      toast.error(t("toast.deleteError"), {
        description: error instanceof Error ? error.message : t("toast.error.generic"),
      });
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NEWS_QUERY_KEYS.NEWS_PREFIX(entityId) });
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
  const userContextId = useHydratedUserContextId();
  const newsQueryKey = NEWS_QUERY_KEYS.NEWS(entityId, userContextId);

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
          await queryClient.cancelQueries({ queryKey: newsQueryKey });

          const previousData = queryClient.getQueryData<{ pages: News[][] }>(
            newsQueryKey
          );

          // Optimistic update: mutate the proxy directly
          queryClient.setQueryData<{ pages: News[][] }>(
            newsQueryKey,
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
        queryClient.setQueryData(newsQueryKey, context.previousData);
      }

      toast.error(t("toast.editError"), {
        description: error instanceof Error ? error.message : t("toast.error.generic"),
      });
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NEWS_QUERY_KEYS.NEWS_PREFIX(entityId) });
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
  // `deploymentEntity` = entité du SITE (costum ambiant du déploiement) — cf. useEntityMutation.
  const { me, entity: deploymentEntity } = useCocolight();
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

      // Créer la News SOUS le costum AMBIANT du déploiement → `source.key` = site (comme poi/org via
      // useEntityMutation), sur le mur de `entity` (le target). Sans déploiement costum (site nu / me
      // indispo) → fallback `entity.news()` historique (pas de source.key). Cf. CostumScope.news().
      const costumOf = me as unknown as {
        costum?: (arg: EntityTypes) => Promise<{ news: (target: EntityTypes, data: NewsData) => Promise<News> }>;
      } | null;
      const news = deploymentEntity && costumOf?.costum
        ? await (await costumOf.costum(deploymentEntity as unknown as EntityTypes)).news(entity, newsData)
        : await entity.news(newsData);

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
      queryClient.invalidateQueries({ queryKey: NEWS_QUERY_KEYS.NEWS_PREFIX(entityId) });
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
      queryClient.invalidateQueries({ queryKey: NEWS_QUERY_KEYS.NEWS_PREFIX(entityId) });
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
      queryClient.invalidateQueries({ queryKey: NEWS_QUERY_KEYS.NEWS_PREFIX(entityId) });
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
      queryClient.invalidateQueries({ queryKey: NEWS_QUERY_KEYS.NEWS_PREFIX(entityId) });
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
  const userContextId = useHydratedUserContextId();
  const newsQueryKey = NEWS_QUERY_KEYS.NEWS(entityId, userContextId);

  return useMutation({
    mutationFn: async ({
      news,
      voteType,
    }: {
      news: News;
      voteType: string;
    }) => {
      if (!me) throw new Error("User not connected");

      await news.addVote(voteType);

      return { news, voteType };
    },

    onMutate: options?.optimistic
      ? async (variables) => {
          await queryClient.cancelQueries({ queryKey: newsQueryKey });

          const previousData = queryClient.getQueryData<{ pages: News[][] }>(
            newsQueryKey
          );

          queryClient.setQueryData<{ pages: News[][] }>(
            newsQueryKey,
            (old) => {
              if (!old) return old;

              const userId = me?.serverData?.id;
              if (!userId) return old;

              old.pages.forEach(page =>
                page.forEach(n => {
                  if (n.id === variables.news.id) {
                    const vote = n.serverData.vote as Record<string, Record<string, unknown>> | undefined;
                    let oldVoteType: string | null = null;

                    if (vote && typeof vote === "object" && userId in vote) {
                      const userVote = vote[userId];
                      if (userVote && typeof userVote === "object" && "status" in userVote) {
                        oldVoteType = userVote.status as string;
                      }
                    }

                    const currentVoteCount = n.serverData.voteCount as Record<string, number> | undefined;
                    const newVoteCount = { ...(currentVoteCount || {}) };

                    if (oldVoteType && oldVoteType !== variables.voteType) {
                      newVoteCount[oldVoteType] = Math.max((newVoteCount[oldVoteType] || 0) - 1, 0);
                    }

                    if (!oldVoteType || oldVoteType !== variables.voteType) {
                      newVoteCount[variables.voteType] = (newVoteCount[variables.voteType] || 0) + 1;
                    }

                    n.serverData.voteCount = newVoteCount;

                    const newVote = { ...(vote || {}) };

                    newVote[userId] = {
                      status: variables.voteType,
                      date: {
                        sec: Math.floor(Date.now() / 1000),
                        usec: 0
                      }
                    };

                    n.serverData.vote = newVote;
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
        queryClient.setQueryData(newsQueryKey, context.previousData);
      }

      toast.error(t("toast.voteError"), {
        description: error instanceof Error ? error.message : t("toast.error.generic"),
      });
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NEWS_QUERY_KEYS.NEWS_PREFIX(entityId) });
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