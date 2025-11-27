import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useT } from "@/hooks/useT";
import { useCocolight } from "@/hooks/useCocolight";
import type { User } from "@communecter/cocolight-api-client";
import { isUser } from "@/lib/getTypedEntity";

/**
 * Hook pour envoyer une demande d'amitié
 */
export function useSendFriendRequest(currentUser: User | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");
  const { me } = useCocolight();

  return useMutation({
    mutationFn: async ({ user }: { user: User }) => {
      if (!currentUser || !isUser(currentUser) || !me) {
        throw new Error("Current user and API are required");
      }
      return await user.sendFriendRequest();
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
export function useAcceptFriendRequest(currentUser: User | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");
  const { me } = useCocolight();

  return useMutation({
    mutationFn: async ({ user }: { user: User }) => {
      if (!currentUser || !isUser(currentUser) || !me) {
        throw new Error("Current user and API are required");
      }
      return await user.acceptFriendRequest();
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
export function useRejectFriendRequest(currentUser: User | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");
  const { me } = useCocolight();

  return useMutation({
    mutationFn: async ({ user }: { user: User }) => {
      if (!currentUser || !isUser(currentUser) || !me) {
        throw new Error("Current user and API are required");
      }
      return await user.removeFriend();
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
export function useRemoveFriend(currentUser: User | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");
  const { me } = useCocolight();

  return useMutation({
    mutationFn: async ({ user }: { user: User }) => {
      if (!currentUser || !isUser(currentUser) || !me) {
        throw new Error("Current user and API are required");
      }

      // Supprimer l'ami
      return await user.removeFriend();
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
export function useCancelFriendRequest(currentUser: User | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");
  const { me } = useCocolight();

  return useMutation({
    mutationFn: async ({ user }: { user: User }) => {
      if (!currentUser || !isUser(currentUser) || !me) {
        throw new Error("Current user and API are required");
      }

      // Pour annuler, on peut utiliser removeFriend
      return await user.removeFriend();
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