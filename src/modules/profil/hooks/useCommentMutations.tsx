import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";
import type { Comment, News, EntityTypes } from "@communecter/cocolight-api-client";

/**
 * Options pour les hooks de mutation
 */
interface MutationOptions {
  optimistic?: boolean;
}

/**
 * Hook pour ajouter un commentaire
 * @param newsId - ID de la news
 * @param entity - L'entité propriétaire (pour mettre à jour le cache)
 * @param options - Options incluant optimistic updates
 */
export function useAddComment(newsId: string, entity: EntityTypes, options?: MutationOptions) {
  const queryClient = useQueryClient();
  const { me } = useCocolight();
  const t = useT("modules/profil");
  const entityId = entity.id || "";

  return useMutation({
    mutationFn: async ({ news, text }: { news: News; text: string }) => {
      const comment = await news.comment({ text });
      const result = await comment.save();
      return { comment, result };
    },

    onMutate: options?.optimistic
      ? async (variables) => {
          // Annuler les requêtes en cours pour éviter les conflits
          await queryClient.cancelQueries({ queryKey: ["news-comments", newsId] });

          // Sauvegarder l'état précédent
          const previousComments = queryClient.getQueryData<Comment[]>(["news-comments", newsId]);

          // Créer un commentaire optimiste
          const optimisticComment = {
            id: `temp-${Date.now()}`,
            serverData: {
              id: `temp-${Date.now()}`,
              text: variables.text,
              created: new Date(),
              author: me?.serverData || { name: "Anonyme" },
              voteCount: {},
              replies: [],
              commentCount: 0,
            },
            data: {
              text: variables.text,
            },
          } as unknown as Comment;

          // Mettre à jour le cache de manière optimiste
          queryClient.setQueryData<Comment[]>(["news-comments", newsId], (old) => {
            return [optimisticComment, ...(old || [])];
          });

          return { previousComments };
        }
      : undefined,

    onError: (error, _variables, context) => {
      // Rollback en cas d'erreur
      if (context?.previousComments) {
        queryClient.setQueryData(["news-comments", newsId], context.previousComments);
      }

      toast.error(t("toast.comment.addError"), {
        description: error instanceof Error ? error.message : t("toast.error.generic"),
      });
    },

    onSuccess: () => {
      // Incrémenter le commentCount dans le cache des news
      // Les données sont déjà des instances Proxy grâce au useEffect de useProfilNewsQuery
      queryClient.setQueriesData<{ pages: News[][] }>(
        { queryKey: ["profile-news", entityId] },
        (old) => {
          if (!old) return old;

          // Pas besoin de créer une nouvelle structure, on mute directement les Proxys
          old.pages.forEach((page) =>
            page.forEach((news) => {
              if (news.serverData?.id === newsId) {
                const currentCount = typeof news.serverData?.commentCount === 'number'
                  ? news.serverData.commentCount
                  : 0;

                // Mutation directe du Proxy
                news.serverData.commentCount = currentCount + 1;
              }
            })
          );

          return old;
        }
      );

      // Invalider pour récupérer les commentaires à jour du serveur
      queryClient.invalidateQueries({ queryKey: ["news-comments", newsId] });
      toast.success(t("toast.comment.addSuccess"));
    },
  });
}

/**
 * Hook pour éditer un commentaire
 * @param newsId - ID de la news
 * @param entity - L'entité propriétaire (non utilisé car pas de changement de count)
 * @param options - Options incluant optimistic updates
 */
export function useEditComment(newsId: string, _entity: EntityTypes, options?: MutationOptions) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async ({ comment, newText }: { comment: Comment; newText: string }) => {
      comment.data.text = newText;
      const result = await comment.save();
      return { comment, result };
    },

    onMutate: options?.optimistic
      ? async (variables) => {
          await queryClient.cancelQueries({ queryKey: ["news-comments", newsId] });

          const previousComments = queryClient.getQueryData<Comment[]>(["news-comments", newsId]);

          // Mettre à jour le commentaire dans le cache
          queryClient.setQueryData<Comment[]>(["news-comments", newsId], (old) => {
            if (!old) return old;
            return old.map((comment) => {
              if (comment.id === variables.comment.id) {
                return {
                  ...comment,
                  serverData: {
                    ...comment.serverData,
                    text: variables.newText,
                  },
                  data: {
                    ...comment.data,
                    text: variables.newText,
                  },
                } as Comment;
              }
              return comment;
            });
          });

          return { previousComments };
        }
      : undefined,

    onError: (error, _variables, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(["news-comments", newsId], context.previousComments);
      }

      toast.error(t("toast.comment.editError"), {
        description: error instanceof Error ? error.message : t("toast.error.generic"),
      });
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news-comments", newsId] });
      toast.success(t("toast.comment.editSuccess"));
    },
  });
}

/**
 * Hook pour supprimer un commentaire
 * @param newsId - ID de la news
 * @param entity - L'entité propriétaire (pour mettre à jour le cache)
 * @param options - Options incluant optimistic updates
 */
export function useDeleteComment(newsId: string, entity: EntityTypes, options?: MutationOptions) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");
  const entityId = entity.id || "";

  return useMutation({
    mutationFn: async ({ comment, parentCommentId }: { comment: Comment; parentCommentId?: string }) => {
      await comment.delete();
      return { commentId: comment.id, parentCommentId };
    },

    onMutate: options?.optimistic
      ? async (variables) => {
          await queryClient.cancelQueries({ queryKey: ["news-comments", newsId] });

          const previousComments = queryClient.getQueryData<Comment[]>(["news-comments", newsId]);

          // Si c'est une reply, la retirer du commentaire parent
          if (variables.parentCommentId) {
            queryClient.setQueryData<Comment[]>(["news-comments", newsId], (old) => {
              if (!old) return old;
              return old.map((comment) => {
                if (comment.id === variables.parentCommentId && comment.serverData?.replies) {
                  // Filtrer les replies pour retirer celle supprimée
                  // Les replies sont maintenant des objets Comment
                  const replies = comment.serverData.replies as unknown as Comment[];
                  const updatedReplies = replies.filter(
                    (reply) => reply.id !== variables.comment.id
                  );
                  // Muter directement le serverData (Proxy)
                  comment.serverData.replies = updatedReplies as unknown as typeof comment.serverData.replies;
                }
                return comment;
              });
            });
          } else {
            // Si c'est un commentaire principal, le retirer de la liste
            queryClient.setQueryData<Comment[]>(["news-comments", newsId], (old) => {
              if (!old) return old;
              return old.filter((comment) => comment.id !== variables.comment.id);
            });
          }

          return { previousComments };
        }
      : undefined,

    onError: (error, _variables, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(["news-comments", newsId], context.previousComments);
      }

      toast.error(t("toast.comment.deleteError"), {
        description: error instanceof Error ? error.message : t("toast.error.generic"),
      });
    },

    onSuccess: () => {
      // Décrémenter le commentCount pour commentaires ET replies
      // car le count total inclut les deux
      queryClient.setQueriesData<{ pages: News[][] }>(
        { queryKey: ["profile-news", entityId] },
        (old) => {
          if (!old) return old;

          // Pas besoin de créer une nouvelle structure, on mute directement les Proxys
          old.pages.forEach((page) =>
            page.forEach((news) => {
              if (news.serverData?.id === newsId) {
                const currentCount = typeof news.serverData?.commentCount === 'number'
                  ? news.serverData.commentCount
                  : 0;

                // Mutation directe du Proxy
                news.serverData.commentCount = Math.max(currentCount - 1, 0);
              }
            })
          );

          return old;
        }
      );

      queryClient.invalidateQueries({ queryKey: ["news-comments", newsId] });
      toast.success(t("toast.comment.deleteSuccess"));
    },
  });
}

/**
 * Hook pour répondre à un commentaire
 * @param newsId - ID de la news
 * @param entity - L'entité propriétaire (pour mettre à jour le cache)
 * @param options - Options incluant optimistic updates
 */
export function useReplyToComment(newsId: string, entity: EntityTypes, options?: MutationOptions) {
  const queryClient = useQueryClient();
  const { me } = useCocolight();
  const t = useT("modules/profil");
  const entityId = entity.id || "";

  return useMutation({
    mutationFn: async ({ comment, text }: { comment: Comment; text: string }) => {
      const reply = await comment.comment({ text });
      const result = await reply.save();
      return { reply, result, parentCommentId: comment.id };
    },

    onMutate: options?.optimistic
      ? async (variables) => {
          await queryClient.cancelQueries({ queryKey: ["news-comments", newsId] });

          const previousComments = queryClient.getQueryData<Comment[]>(["news-comments", newsId]);

          // Créer une réponse optimiste
          const optimisticReply = {
            id: `temp-reply-${Date.now()}`,
            text: variables.text,
            created: new Date(),
            author: me?.serverData || { name: "Anonyme" },
            voteCount: {},
            replies: [],
          };

          // Mettre à jour le commentaire parent avec la nouvelle réponse
          queryClient.setQueryData<Comment[]>(["news-comments", newsId], (old) => {
            if (!old) return old;
            return old.map((comment) => {
              if (comment.id === variables.comment.id) {
                const currentReplies = comment.serverData?.replies || [];
                return {
                  ...comment,
                  serverData: {
                    ...comment.serverData,
                    replies: [...currentReplies, optimisticReply],
                  },
                } as Comment;
              }
              return comment;
            });
          });

          return { previousComments };
        }
      : undefined,

    onError: (error, _variables, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(["news-comments", newsId], context.previousComments);
      }

      toast.error(t("toast.reply.addError"), {
        description: error instanceof Error ? error.message : t("toast.error.generic"),
      });
    },

    onSuccess: () => {
      // Incrémenter le commentCount dans le cache des news
      // Les données sont déjà des instances Proxy grâce au useEffect de useProfilNewsQuery
      queryClient.setQueriesData<{ pages: News[][] }>(
        { queryKey: ["profile-news", entityId] },
        (old) => {
          if (!old) return old;

          // Pas besoin de créer une nouvelle structure, on mute directement les Proxys
          old.pages.forEach((page) =>
            page.forEach((news) => {
              if (news.serverData?.id === newsId) {
                const currentCount = typeof news.serverData?.commentCount === 'number'
                  ? news.serverData.commentCount
                  : 0;

                // Mutation directe du Proxy
                news.serverData.commentCount = currentCount + 1;
              }
            })
          );

          return old;
        }
      );

      queryClient.invalidateQueries({ queryKey: ["news-comments", newsId] });
      toast.success(t("toast.reply.addSuccess"));
    },
  });
}

/**
 * Hook pour ajouter un vote (like) à un commentaire
 * @param newsId - ID de la news
 * @param options - Options incluant optimistic updates
 */
export function useAddCommentVote(newsId: string, options?: MutationOptions) {
  const queryClient = useQueryClient();
  const { me } = useCocolight();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async ({ comment, voteType = "like" }: { comment: Comment; voteType?: string }) => {
      if (!me) throw new Error("User not connected");
      console.log("[useAddCommentVote] Adding vote:", { commentId: comment.id, voteType });
      await comment.addVote(voteType);
      return { comment, voteType };
    },
    onMutate: async ({ comment, voteType = "like" }) => {
      if (!options?.optimistic) return;

      // Annuler les requêtes en cours pour éviter les conflits
      await queryClient.cancelQueries({ queryKey: ["news-comments", newsId] });

      // Sauvegarder l'état précédent pour rollback
      const previousData = queryClient.getQueryData<Comment[]>(["news-comments", newsId]);

      // Mise à jour optimiste en mutant directement les Proxys
      queryClient.setQueryData<Comment[]>(["news-comments", newsId], (old) => {
        if (!old) return old;

        // Mutation directe des objets Proxy (pas besoin de cloner)
        old.forEach((c) => {
          if (c.id === comment.id) {
            // Mise à jour du vote count
            const currentVoteCount = c.serverData.voteCount as Record<string, number> | undefined;
            const newVoteCount = { ...(currentVoteCount || {}) };
            newVoteCount[voteType] = (newVoteCount[voteType] || 0) + 1;

            // Mutation directe du Proxy
            c.serverData.voteCount = newVoteCount;
          }
        });

        return old;
      });

      return { previousData };
    },
    onError: (error, _variables, context) => {
      console.error("[useAddCommentVote] Error:", error);
      // Rollback en cas d'erreur
      if (context?.previousData) {
        queryClient.setQueryData(["news-comments", newsId], context.previousData);
      }
      toast.error(t("toast.comment.voteError"));
    },
    onSuccess: () => {
      // Invalider le cache pour récupérer les données à jour du serveur
      queryClient.invalidateQueries({ queryKey: ["news-comments", newsId] });
      toast.success(t("toast.comment.voteSuccess"));
    },
  });
}

/**
 * Hook pour signaler un commentaire
 */
export function useReportComment() {
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async ({
      comment,
      reason,
      commentText,
    }: {
      comment: Comment;
      reason: string;
      commentText?: string;
    }) => {
      console.log("[useReportComment] Reporting comment:", { commentId: comment.id, reason, commentText });
      await comment.addReportAbuse({ reason, comment: commentText });
      return { commentId: comment.id };
    },

    onSuccess: () => {
      toast.success(t("toast.report.success"));
    },

    onError: (error) => {
      console.error("[useReportComment] Error:", error);
      toast.error(t("toast.report.error"), {
        description: error instanceof Error ? error.message : t("toast.error.generic"),
      });
    },
  });
}
