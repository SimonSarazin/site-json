import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useT } from "@/hooks/useT";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { isUser, isOrganization, isProject, isEvent } from "@/lib/getTypedEntity";

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
 * Hook pour envoyer une demande d'ami (pour useEntityActions)
 *
 * @param entity - L'utilisateur à qui envoyer la demande
 * @returns Mutation React Query
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
        queryClient.invalidateQueries({ queryKey: ["user-friends", entity.slug] });
        queryClient.invalidateQueries({ queryKey: ["user-sent-friend-requests", entity.slug] });
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
 * Hook pour retirer un ami (pour useEntityActions)
 *
 * @param entity - L'utilisateur à retirer de ses amis
 * @returns Mutation React Query
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
        queryClient.invalidateQueries({ queryKey: ["user-friends", entity.slug] });
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

/**
 * Hook pour suivre une organisation
 *
 * @param entity - L'organisation à suivre
 * @returns Mutation React Query
 *
 * @example
 * const followMutation = useFollowOrganization(entity);
 * followMutation.mutate();
 */
export function useFollowOrganization(entity: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async () => {
      if (!entity || !isOrganization(entity)) {
        throw new Error("Invalid entity: must be an organization");
      }

      return await entity.follow();
    },

    onSuccess: () => {
      if (entity) {
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
 * Hook pour ne plus suivre une organisation
 *
 * @param entity - L'organisation à ne plus suivre
 * @returns Mutation React Query
 *
 * @example
 * const unfollowMutation = useUnfollowOrganization(entity);
 * unfollowMutation.mutate();
 */
export function useUnfollowOrganization(entity: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async () => {
      if (!entity || !isOrganization(entity)) {
        throw new Error("Invalid entity: must be an organization");
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
 * Hook pour demander à devenir membre d'une organisation
 *
 * @param entity - L'organisation
 * @returns Mutation React Query
 *
 * @example
 * const requestMemberMutation = useRequestMembership(entity);
 * requestMemberMutation.mutate();
 */
export function useRequestMembership(entity: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async () => {
      if (!entity || !isOrganization(entity)) {
        throw new Error("Invalid entity: must be an organization");
      }

      return await entity.requestToJoin();
    },

    onSuccess: () => {
      if (entity) {
        queryClient.invalidateQueries({ queryKey: ["element-about", entity.slug] });
      }
      toast.success(t("toast.relationship.memberRequestSent"));
    },

    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
      toast.error(t("toast.relationship.memberRequestError"), {
        description: errorMessage,
      });
    },
  });
}

/**
 * Hook pour quitter une organisation (ne plus être membre)
 *
 * @param entity - L'organisation
 * @returns Mutation React Query
 *
 * @example
 * const leaveMutation = useLeaveOrganization(entity);
 * leaveMutation.mutate();
 */
export function useLeaveOrganization(entity: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async () => {
      if (!entity || !isOrganization(entity)) {
        throw new Error("Invalid entity: must be an organization");
      }

      return await entity.leave();
    },

    onSuccess: () => {
      if (entity) {
        queryClient.invalidateQueries({ queryKey: ["element-about", entity.slug] });
      }
      toast.success(t("toast.relationship.memberLeftSuccess"));
    },

    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
      toast.error(t("toast.relationship.memberLeftError"), {
        description: errorMessage,
      });
    },
  });
}

// =====================================================
// PROJECT RELATIONSHIP MUTATIONS
// =====================================================

/**
 * Hook pour suivre un projet
 */
export function useFollowProject(entity: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async () => {
      if (!entity || !isProject(entity)) {
        throw new Error("Invalid entity: must be a project");
      }

      return await entity.follow();
    },

    onSuccess: () => {
      if (entity) {
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
 * Hook pour ne plus suivre un projet
 */
export function useUnfollowProject(entity: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async () => {
      if (!entity || !isProject(entity)) {
        throw new Error("Invalid entity: must be a project");
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
 * Hook pour demander à rejoindre un projet en tant que contributeur
 */
export function useRequestContributor(entity: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async () => {
      if (!entity || !isProject(entity)) {
        throw new Error("Invalid entity: must be a project");
      }

      return await entity.requestToJoin();
    },

    onSuccess: () => {
      if (entity) {
        queryClient.invalidateQueries({ queryKey: ["element-about", entity.slug] });
      }
      toast.success(t("toast.relationship.contributorRequestSent"));
    },

    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
      toast.error(t("toast.relationship.contributorRequestError"), {
        description: errorMessage,
      });
    },
  });
}

/**
 * Hook pour demander à devenir admin d'un projet
 */
export function useRequestProjectAdmin(entity: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async () => {
      if (!entity || !isProject(entity)) {
        throw new Error("Invalid entity: must be a project");
      }

      return await entity.requestToJoinAdmin();
    },

    onSuccess: () => {
      if (entity) {
        queryClient.invalidateQueries({ queryKey: ["element-about", entity.slug] });
      }
      toast.success(t("toast.relationship.projectAdminRequestSent"));
    },

    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
      toast.error(t("toast.relationship.projectAdminRequestError"), {
        description: errorMessage,
      });
    },
  });
}

/**
 * Hook pour quitter un projet
 */
export function useLeaveProject(entity: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async () => {
      if (!entity || !isProject(entity)) {
        throw new Error("Invalid entity: must be a project");
      }

      return await entity.leave();
    },

    onSuccess: () => {
      if (entity) {
        queryClient.invalidateQueries({ queryKey: ["element-about", entity.slug] });
      }
      toast.success(t("toast.relationship.projectLeftSuccess"));
    },

    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
      toast.error(t("toast.relationship.projectLeftError"), {
        description: errorMessage,
      });
    },
  });
}

// =====================================================
// EVENT RELATIONSHIP MUTATIONS
// =====================================================

/**
 * Hook pour suivre un événement
 */
export function useFollowEvent(entity: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async () => {
      if (!entity || !isEvent(entity)) {
        throw new Error("Invalid entity: must be an event");
      }

      return await entity.follow();
    },

    onSuccess: () => {
      if (entity) {
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
 * Hook pour ne plus suivre un événement
 */
export function useUnfollowEvent(entity: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async () => {
      if (!entity || !isEvent(entity)) {
        throw new Error("Invalid entity: must be an event");
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
 * Hook pour participer à un événement
 */
export function useParticipateEvent(entity: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async () => {
      if (!entity || !isEvent(entity)) {
        throw new Error("Invalid entity: must be an event");
      }

      return await entity.requestToJoin();
    },

    onSuccess: () => {
      if (entity) {
        queryClient.invalidateQueries({ queryKey: ["element-about", entity.slug] });
      }
      toast.success(t("toast.relationship.participationSuccess"));
    },

    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
      toast.error(t("toast.relationship.participationError"), {
        description: errorMessage,
      });
    },
  });
}

/**
 * Hook pour ne plus participer à un événement
 */
export function useLeaveEvent(entity: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async () => {
      if (!entity || !isEvent(entity)) {
        throw new Error("Invalid entity: must be an event");
      }

      return await entity.leave();
    },

    onSuccess: () => {
      if (entity) {
        queryClient.invalidateQueries({ queryKey: ["element-about", entity.slug] });
      }
      toast.success(t("toast.relationship.participationLeftSuccess"));
    },

    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
      toast.error(t("toast.relationship.participationLeftError"), {
        description: errorMessage,
      });
    },
  });
}

