import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useT } from "@/hooks/useT";
import { useCocolight } from "@/hooks/useCocolight";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { isUser } from "@/lib/getTypedEntity";

/**
 * Hook pour envoyer une demande d'amitié
 */
export function useSendFriendRequest(currentUser: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");
  const { api } = useCocolight();

  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      if (!currentUser || !isUser(currentUser) || !api) {
        throw new Error("Current user and API are required");
      }

      // Créer une instance de l'utilisateur cible et envoyer la demande
      const targetUser = await api.user({ id: userId });
      return await targetUser.sendFriendRequest();
    },

    onSuccess: () => {
      // Invalider les caches des amis
      if (currentUser) {
        queryClient.invalidateQueries({ queryKey: ["user-friends", currentUser.slug] });
        queryClient.invalidateQueries({ queryKey: ["user-sent-friend-requests", currentUser.slug] });
      }
      toast.success(t("toast.friends.requestSent"));
    },

    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
      toast.error(t("toast.friends.sendRequestError"), {
        description: errorMessage,
      });
    },
  });
}

/**
 * Hook pour accepter une demande d'amitié
 */
export function useAcceptFriendRequest(currentUser: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");
  const { api } = useCocolight();

  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      if (!currentUser || !isUser(currentUser) || !api) {
        throw new Error("Current user and API are required");
      }

      // Créer une instance de l'utilisateur qui a envoyé la demande et l'accepter
      const friendUser = await api.user({ id: userId });
      return await friendUser.acceptFriendRequest();
    },

    onSuccess: () => {
      if (currentUser) {
        queryClient.invalidateQueries({ queryKey: ["user-friends", currentUser.slug] });
        queryClient.invalidateQueries({ queryKey: ["user-pending-friends", currentUser.slug] });
      }
      toast.success(t("toast.friends.requestAccepted"));
    },

    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
      toast.error(t("toast.friends.acceptRequestError"), {
        description: errorMessage,
      });
    },
  });
}

/**
 * Hook pour rejeter une demande d'amitié
 */
export function useRejectFriendRequest(currentUser: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");
  const { api } = useCocolight();

  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      if (!currentUser || !isUser(currentUser) || !api) {
        throw new Error("Current user and API are required");
      }

      // Pour rejeter, on peut utiliser removeFriend si un lien existe déjà
      // ou utiliser l'API disconnect directement
      const friendUser = await api.user({ id: userId });
      return await friendUser.removeFriend();
    },

    onSuccess: () => {
      if (currentUser) {
        queryClient.invalidateQueries({ queryKey: ["user-pending-friends", currentUser.slug] });
      }
      toast.success(t("toast.friends.requestRejected"));
    },

    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
      toast.error(t("toast.friends.rejectRequestError"), {
        description: errorMessage,
      });
    },
  });
}

/**
 * Hook pour retirer un ami (unfriend)
 */
export function useRemoveFriend(currentUser: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");
  const { api } = useCocolight();

  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      if (!currentUser || !isUser(currentUser) || !api) {
        throw new Error("Current user and API are required");
      }

      // Supprimer l'ami
      const friendUser = await api.user({ id: userId });
      return await friendUser.removeFriend();
    },

    onSuccess: () => {
      if (currentUser) {
        queryClient.invalidateQueries({ queryKey: ["user-friends", currentUser.slug] });
      }
      toast.success(t("toast.friends.friendRemoved"));
    },

    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
      toast.error(t("toast.friends.removeError"), {
        description: errorMessage,
      });
    },
  });
}

/**
 * Hook pour annuler une demande d'amitié envoyée
 */
export function useCancelFriendRequest(currentUser: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");
  const { api } = useCocolight();

  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      if (!currentUser || !isUser(currentUser) || !api) {
        throw new Error("Current user and API are required");
      }

      // Pour annuler, on peut utiliser removeFriend
      const targetUser = await api.user({ id: userId });
      return await targetUser.removeFriend();
    },

    onSuccess: () => {
      if (currentUser) {
        queryClient.invalidateQueries({ queryKey: ["user-sent-friend-requests", currentUser.slug] });
      }
      toast.success(t("toast.friends.requestCancelled"));
    },

    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
      toast.error(t("toast.friends.cancelError"), {
        description: errorMessage,
      });
    },
  });
}