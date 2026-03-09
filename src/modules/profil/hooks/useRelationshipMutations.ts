import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { toast } from "sonner";
import { useT } from "@/hooks/useT";
import { useProfileEntity } from "./useProfileEntity";

function useEntityMutation<TResult = void>(options: {
  mutationFn: (entity: EntityTypes) => Promise<TResult>;
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: () => void;
}) {
  const queryClient = useQueryClient();
  const { entity } = useProfileEntity();

  return useMutation({
    mutationFn: () => {
      if (!entity) {
        throw new Error("No entity");
      }
      return options.mutationFn(entity);
    },
    onSuccess: () => {
      if (entity?.slug) {
        queryClient.invalidateQueries({
          queryKey: ["element-about", entity.slug],
        });
      }
      if (options.successMessage) {
        toast.success(options.successMessage);
      }
      options.onSuccess?.();
    },
    onError: (error: Error) => {
      console.error("Mutation error:", error);
      if (options.errorMessage) {
        toast.error(options.errorMessage);
      }
    },
  });
}

export function useFollowEntity() {
  const t = useT("modules/profil");

  return useEntityMutation({
    mutationFn: async (entity) => {
      if ((entity as any).follow) {
        await (entity as any).follow();
      }
    },
    successMessage: String(t("toast.relationship.followSuccess") || "Suivi avec succès"),
    errorMessage: String(t("toast.relationship.followError") || "Erreur lors du suivi"),
  });
}

export function useUnfollowEntity() {
  const t = useT("modules/profil");

  return useEntityMutation({
    mutationFn: async (entity) => {
      if ((entity as any).unfollow) {
        await (entity as any).unfollow();
      }
    },
    successMessage: String(t("toast.relationship.unfollowSuccess") || "Vous ne suivez plus"),
    errorMessage: String(t("toast.relationship.unfollowError") || "Erreur"),
  });
}

export function useRequestToJoin() {
  const t = useT("modules/profil");

  return useEntityMutation({
    mutationFn: async (entity) => {
      if ((entity as any).requestToJoin) {
        await (entity as any).requestToJoin();
      }
    },
    successMessage: String(t("toast.relationship.memberRequestSent") || "Demande envoyée"),
    errorMessage: String(t("toast.relationship.memberRequestError") || "Erreur lors de la demande"),
  });
}

export function useRequestToJoinAdmin() {
  const t = useT("modules/profil");

  return useEntityMutation({
    mutationFn: async (entity) => {
      if ((entity as any).requestToJoinAdmin) {
        await (entity as any).requestToJoinAdmin();
      }
    },
    successMessage: String(t("toast.relationship.adminRequestSent") || "Demande admin envoyée"),
    errorMessage: String(t("toast.relationship.adminRequestError") || "Erreur lors de la demande"),
  });
}

export function useLeaveEntity() {
  const t = useT("modules/profil");

  return useEntityMutation({
    mutationFn: async (entity) => {
      if ((entity as any).leave) {
        await (entity as any).leave();
      }
    },
    successMessage: String(t("toast.relationship.leaveSuccess") || "Vous avez quitté"),
    errorMessage: String(t("toast.relationship.leaveError") || "Erreur"),
  });
}

export function useAcceptInvitation() {
  const t = useT("modules/profil");

  return useEntityMutation({
    mutationFn: async (entity) => {
      if ((entity as any).acceptInvitation) {
        await (entity as any).acceptInvitation();
      }
    },
    successMessage: String(t("toast.invitation.acceptSuccess") || "Invitation acceptée"),
    errorMessage: String(t("toast.invitation.acceptError") || "Erreur"),
  });
}

export function useRejectInvitation() {
  const t = useT("modules/profil");

  return useEntityMutation({
    mutationFn: async (entity) => {
      if ((entity as any).leave) {
        await (entity as any).leave();
      }
    },
    successMessage: String(t("toast.invitation.rejectSuccess") || "Invitation refusée"),
    errorMessage: String(t("toast.invitation.rejectError") || "Erreur"),
  });
}

export function useRequestPromotion() {
  const t = useT("modules/profil");

  return useEntityMutation({
    mutationFn: async (entity) => {
      if ((entity as any).requestPromoteToAdmin) {
        await (entity as any).requestPromoteToAdmin();
      }
    },
    successMessage: String(t("toast.members.requestPromoteSuccess") || "Demande de promotion envoyée"),
    errorMessage: String(t("toast.members.requestPromoteError") || "Erreur"),
  });
}

export function useSendFriendRequest() {
  const t = useT("modules/profil");

  return useEntityMutation({
    mutationFn: async (entity) => {
      if ((entity as any).addFriend) {
        await (entity as any).addFriend();
      }
    },
    successMessage: String(t("toast.friend.requestSent") || "Demande d'ami envoyée"),
    errorMessage: String(t("toast.friend.requestError") || "Erreur"),
  });
}

export function useRemoveFriend() {
  const t = useT("modules/profil");

  return useEntityMutation({
    mutationFn: async (entity) => {
      if ((entity as any).removeFriend) {
        await (entity as any).removeFriend();
      }
    },
    successMessage: String(t("toast.friend.removeSuccess") || "Ami retiré"),
    errorMessage: String(t("toast.friend.removeError") || "Erreur"),
  });
}

export function useAcceptFriendRequest() {
  const t = useT("modules/profil");

  return useEntityMutation({
    mutationFn: async (entity) => {
      if ((entity as any).acceptFriendRequest) {
        await (entity as any).acceptFriendRequest();
      }
    },
    successMessage: String(t("toast.friend.acceptSuccess") || "Demande acceptée"),
    errorMessage: String(t("toast.friend.acceptError") || "Erreur"),
  });
}

export function useCancelFriendRequest() {
  const t = useT("modules/profil");

  return useEntityMutation({
    mutationFn: async (entity) => {
      if ((entity as any).cancelFriendRequest) {
        await (entity as any).cancelFriendRequest();
      }
    },
    successMessage: String(t("toast.friend.requestCancelled") || "Demande annulée"),
    errorMessage: String(t("toast.friend.cancelError") || "Erreur"),
  });
}
