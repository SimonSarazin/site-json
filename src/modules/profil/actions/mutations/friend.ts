/**
 * Mutations pour les relations d'amitié (Users uniquement)
 * Remplace useFriendMutations.tsx
 */
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@communecter/cocolight-api-client";
import { isUser } from "@/lib/getTypedEntity";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { PROFIL_QUERY_KEYS } from "../../constants/queryKeys";

interface FriendMutationParams {
  user: User;
}

/**
 * Hook pour envoyer une demande d'amitié
 */
export function useSendFriendRequest(currentUser: User | null) {
  const queryClient = useQueryClient();

  return useMutationWithToast<void, FriendMutationParams>({
    mutationFn: async ({ user }) => {
      if (!currentUser || !isUser(currentUser)) {
        throw new Error("Current user is required");
      }
      await user.sendFriendRequest();
    },
    namespace: "modules/profil",
    successKey: "toast.friends.requestSent",
    errorKey: "toast.friends.sendRequestError",
    invalidateQueries: currentUser
      ? [PROFIL_QUERY_KEYS.USER_FRIENDS_PREFIX(currentUser.slug)]
      : [],
    onSuccessCallback: (_, { user }) => {
      queryClient.invalidateQueries({ queryKey: PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(user.slug) });
    },
  });
}

/**
 * Hook pour accepter une demande d'amitié
 */
export function useAcceptFriendRequest(currentUser: User | null) {
  const queryClient = useQueryClient();

  return useMutationWithToast<void, FriendMutationParams>({
    mutationFn: async ({ user }) => {
      if (!currentUser || !isUser(currentUser)) {
        throw new Error("Current user is required");
      }
      await user.acceptFriendRequest();
    },
    namespace: "modules/profil",
    successKey: "toast.friends.requestAccepted",
    errorKey: "toast.friends.acceptRequestError",
    invalidateQueries: currentUser
      ? [
          PROFIL_QUERY_KEYS.USER_FRIENDS_PREFIX(currentUser.slug),
          PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(currentUser.slug),
        ]
      : [],
    onSuccessCallback: (_, { user }) => {
      queryClient.invalidateQueries({ queryKey: PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(user.slug) });
    },
  });
}

/**
 * Hook pour rejeter une demande d'amitié
 */
export function useRejectFriendRequest(currentUser: User | null) {
  const queryClient = useQueryClient();

  return useMutationWithToast<void, FriendMutationParams>({
    mutationFn: async ({ user }) => {
      if (!currentUser || !isUser(currentUser)) {
        throw new Error("Current user is required");
      }
      await user.removeFriend();
    },
    namespace: "modules/profil",
    successKey: "toast.friends.requestRejected",
    errorKey: "toast.friends.rejectRequestError",
    invalidateQueries: currentUser
      ? [
          PROFIL_QUERY_KEYS.USER_FRIENDS_PREFIX(currentUser.slug),
          PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(currentUser.slug),
        ]
      : [],
    onSuccessCallback: (_, { user }) => {
      queryClient.invalidateQueries({ queryKey: PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(user.slug) });
    },
  });
}

/**
 * Hook pour retirer un ami
 */
export function useRemoveFriend(currentUser: User | null) {
  const queryClient = useQueryClient();

  return useMutationWithToast<void, FriendMutationParams>({
    mutationFn: async ({ user }) => {
      if (!currentUser || !isUser(currentUser)) {
        throw new Error("Current user is required");
      }
      await user.removeFriend();
    },
    namespace: "modules/profil",
    successKey: "toast.friends.friendRemoved",
    errorKey: "toast.friends.removeError",
    invalidateQueries: currentUser
      ? [
          PROFIL_QUERY_KEYS.USER_FRIENDS_PREFIX(currentUser.slug),
          PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(currentUser.slug),
        ]
      : [],
    onSuccessCallback: (_, { user }) => {
      queryClient.invalidateQueries({ queryKey: PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(user.slug) });
    },
  });
}

/**
 * Hook pour annuler une demande d'amitié envoyée
 */
export function useCancelFriendRequest(currentUser: User | null) {
  const queryClient = useQueryClient();

  return useMutationWithToast<void, FriendMutationParams>({
    mutationFn: async ({ user }) => {
      if (!currentUser || !isUser(currentUser)) {
        throw new Error("Current user is required");
      }
      await user.removeFriend();
    },
    namespace: "modules/profil",
    successKey: "toast.friends.requestCancelled",
    errorKey: "toast.friends.cancelError",
    invalidateQueries: currentUser
      ? [
          PROFIL_QUERY_KEYS.USER_FRIENDS_PREFIX(currentUser.slug),
          PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(currentUser.slug),
        ]
      : [],
    onSuccessCallback: (_, { user }) => {
      queryClient.invalidateQueries({ queryKey: PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(user.slug) });
    },
  });
}
