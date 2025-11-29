import type { User } from "@communecter/cocolight-api-client";
import { isUser } from "@/lib/getTypedEntity";
import { useMutationWithToast } from "./core";
import { QUERY_KEYS } from "../constants";

/**
 * Hook pour envoyer une demande d'amitié
 */
export function useSendFriendRequest(currentUser: User | null) {
  return useMutationWithToast<void, { user: User }>({
    mutationFn: async ({ user }) => {
      if (!currentUser || !isUser(currentUser)) {
        throw new Error("Current user is required");
      }
      await user.sendFriendRequest();
    },
    successKey: "toast.friends.requestSent",
    errorKey: "toast.friends.sendRequestError",
    invalidateQueries: currentUser
      ? [
          QUERY_KEYS.USER_FRIENDS(currentUser.slug),
          QUERY_KEYS.USER_SENT_FRIEND_REQUESTS(currentUser.slug),
        ]
      : [],
  });
}

/**
 * Hook pour accepter une demande d'amitié
 */
export function useAcceptFriendRequest(currentUser: User | null) {
  return useMutationWithToast<void, { user: User }>({
    mutationFn: async ({ user }) => {
      if (!currentUser || !isUser(currentUser)) {
        throw new Error("Current user is required");
      }
      await user.acceptFriendRequest();
    },
    successKey: "toast.friends.requestAccepted",
    errorKey: "toast.friends.acceptRequestError",
    invalidateQueries: currentUser
      ? [QUERY_KEYS.USER_FRIENDS(currentUser.slug), QUERY_KEYS.USER_PENDING_FRIENDS(currentUser.slug)]
      : [],
  });
}

/**
 * Hook pour rejeter une demande d'amitié
 */
export function useRejectFriendRequest(currentUser: User | null) {
  return useMutationWithToast<void, { user: User }>({
    mutationFn: async ({ user }) => {
      if (!currentUser || !isUser(currentUser)) {
        throw new Error("Current user is required");
      }
      await user.removeFriend();
    },
    successKey: "toast.friends.requestRejected",
    errorKey: "toast.friends.rejectRequestError",
    invalidateQueries: currentUser ? [QUERY_KEYS.USER_PENDING_FRIENDS(currentUser.slug)] : [],
  });
}

/**
 * Hook pour retirer un ami
 */
export function useRemoveFriend(currentUser: User | null) {
  return useMutationWithToast<void, { user: User }>({
    mutationFn: async ({ user }) => {
      if (!currentUser || !isUser(currentUser)) {
        throw new Error("Current user is required");
      }
      await user.removeFriend();
    },
    successKey: "toast.friends.friendRemoved",
    errorKey: "toast.friends.removeError",
    invalidateQueries: currentUser ? [QUERY_KEYS.USER_FRIENDS(currentUser.slug)] : [],
  });
}

/**
 * Hook pour annuler une demande d'amitié envoyée
 */
export function useCancelFriendRequest(currentUser: User | null) {
  return useMutationWithToast<void, { user: User }>({
    mutationFn: async ({ user }) => {
      if (!currentUser || !isUser(currentUser)) {
        throw new Error("Current user is required");
      }
      await user.removeFriend();
    },
    successKey: "toast.friends.requestCancelled",
    errorKey: "toast.friends.cancelError",
    invalidateQueries: currentUser ? [QUERY_KEYS.USER_SENT_FRIEND_REQUESTS(currentUser.slug)] : [],
  });
}
