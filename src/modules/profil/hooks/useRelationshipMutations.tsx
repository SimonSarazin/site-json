import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useT } from "@/hooks/useT";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { isUser } from "@/lib/getTypedEntity";

/**
 * Hook pour suivre un utilisateur
 *
 * @param entity - L'utilisateur à suivre
 * @returns Mutation React Query
 *
 * @example
 * const followMutation = useFollowUser(entity);
 * followMutation.mutate();
 */
export function useFollowUser(entity: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async () => {
      if (!entity || !isUser(entity)) {
        throw new Error("Invalid entity: must be a user");
      }

      return await entity.follow();
    },

    onSuccess: () => {
      if (entity) {
        // Invalider le cache pour rafraîchir le statut
        queryClient.invalidateQueries({ queryKey: ["element-about", entity.slug] });
      }
      toast.success(t("toast.relationship.followSuccess"));
    },

    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
      toast.error(t("toast.relationship.followError"), {
        description: errorMessage,
      });
    },
  });
}

/**
 * Hook pour ne plus suivre un utilisateur
 *
 * @param entity - L'utilisateur à ne plus suivre
 * @returns Mutation React Query
 *
 * @example
 * const unfollowMutation = useUnfollowUser(entity);
 * unfollowMutation.mutate();
 */
export function useUnfollowUser(entity: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async () => {
      if (!entity || !isUser(entity)) {
        throw new Error("Invalid entity: must be a user");
      }

      return await entity.unfollow();
    },

    onSuccess: () => {
      if (entity) {
        queryClient.invalidateQueries({ queryKey: ["element-about", entity.slug] });
      }
      toast.success(t("toast.relationship.unfollowSuccess"));
    },

    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
      toast.error(t("toast.relationship.unfollowError"), {
        description: errorMessage,
      });
    },
  });
}

/**
 * Hook pour envoyer une demande d'ami
 *
 * @param entity - L'utilisateur à qui envoyer la demande
 * @returns Mutation React Query
 *
 * @example
 * const sendRequestMutation = useSendFriendRequest(entity);
 * sendRequestMutation.mutate();
 */
export function useSendFriendRequest(entity: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async () => {
      if (!entity || !isUser(entity)) {
        throw new Error("Invalid entity: must be a user");
      }

      return await entity.sendFriendRequest();
    },

    onSuccess: () => {
      if (entity) {
        queryClient.invalidateQueries({ queryKey: ["element-about", entity.slug] });
      }
      toast.success(t("toast.relationship.friendRequestSent"));
    },

    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
      toast.error(t("toast.relationship.friendRequestError"), {
        description: errorMessage,
      });
    },
  });
}

/**
 * Hook pour accepter une demande d'ami
 *
 * @param entity - L'utilisateur dont on accepte la demande
 * @returns Mutation React Query
 *
 * @example
 * const acceptRequestMutation = useAcceptFriendRequest(entity);
 * acceptRequestMutation.mutate();
 */
export function useAcceptFriendRequest(entity: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async () => {
      if (!entity || !isUser(entity)) {
        throw new Error("Invalid entity: must be a user");
      }

      return await entity.acceptFriendRequest();
    },

    onSuccess: () => {
      if (entity) {
        queryClient.invalidateQueries({ queryKey: ["element-about", entity.slug] });
      }
      toast.success(t("toast.relationship.friendRequestAccepted"));
    },

    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
      toast.error(t("toast.relationship.friendRequestError"), {
        description: errorMessage,
      });
    },
  });
}

/**
 * Hook pour retirer un ami / rejeter une demande
 *
 * @param entity - L'utilisateur à retirer de ses amis
 * @returns Mutation React Query
 *
 * @example
 * const removeFriendMutation = useRemoveFriend(entity);
 * removeFriendMutation.mutate();
 */
export function useRemoveFriend(entity: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async () => {
      if (!entity || !isUser(entity)) {
        throw new Error("Invalid entity: must be a user");
      }

      return await entity.removeFriend();
    },

    onSuccess: () => {
      if (entity) {
        queryClient.invalidateQueries({ queryKey: ["element-about", entity.slug] });
      }
      toast.success(t("toast.relationship.friendRemoved"));
    },

    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
      toast.error(t("toast.relationship.friendRemoveError"), {
        description: errorMessage,
      });
    },
  });
}
