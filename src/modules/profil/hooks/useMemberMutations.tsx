import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useT } from "@/hooks/useT";
import type { User, EntityTypes } from "@communecter/cocolight-api-client";
import { isOrganization, isProject, isEvent } from "@/lib/getTypedEntity";

// Fonction utilitaire pour invalider toutes les queries liées aux membres
const invalidateMemberQueries = (queryClient: ReturnType<typeof useQueryClient>, entity: EntityTypes | null) => {
  if (!entity) return;

  // Invalider le cache principal de l'entité
  queryClient.invalidateQueries({ queryKey: ["element-about", entity.slug] });

  // Invalider les queries de recherche d'utilisateurs pour cette entité
  queryClient.invalidateQueries({ queryKey: ["search-users"] });

  // Invalider les queries de membres selon le type d'entité
  if (isOrganization(entity)) {
    queryClient.invalidateQueries({ queryKey: ["organization-members", entity.slug] });
  } else if (isProject(entity)) {
    queryClient.invalidateQueries({ queryKey: ["project-contributors", entity.slug] });
  } else if (isEvent(entity)) {
    queryClient.invalidateQueries({ queryKey: ["event-attendees", entity.slug] });
  }
};

export function useDemoteMember(entity: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async (user: User) => {
      if (user.demoteFromAdmin) {
        await user.demoteFromAdmin();
      }
    },
    onSuccess: (_, user) => {
      const userName = user.serverData?.name || t("common.unknownUser");
      invalidateMemberQueries(queryClient, entity);
      toast.success(t("toast.members.demoteSuccess", undefined, { name: userName }));
    },
    onError: (error: Error, user) => {
      const userName = user.serverData?.name || t("common.unknownUser");
      const errorMessage = error.message || t("toast.error.generic");
      toast.error(t("toast.members.demoteError", undefined, { name: userName }), {
        description: errorMessage,
      });
    },
  });
}

export function usePromoteMember(entity: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async (user: User) => {
      if (user.promoteToAdmin) {
        await user.promoteToAdmin();
      }
    },
    onSuccess: (_, user) => {
      const userName = user.serverData?.name || t("common.unknownUser");
      invalidateMemberQueries(queryClient, entity);
      toast.success(t("toast.members.promoteSuccess", undefined, { name: userName }));
    },
    onError: (error: Error, user) => {
      const userName = user.serverData?.name || t("common.unknownUser");
      const errorMessage = error.message || t("toast.error.generic");
      toast.error(t("toast.members.promoteError", undefined, { name: userName }), {
        description: errorMessage,
      });
    },
  });
}

export function useRemoveMember(entity: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async (user: User) => {
      if (user.removeFromParent) {
        await user.removeFromParent();
      }
    },
    onSuccess: (_, user) => {
      const userName = user.serverData?.name || t("common.unknownUser");
      invalidateMemberQueries(queryClient, entity);
      toast.success(t("toast.members.removeSuccess", undefined, { name: userName }));
    },
    onError: (error: Error, user) => {
      const userName = user.serverData?.name || t("common.unknownUser");
      const errorMessage = error.message || t("toast.error.generic");
      toast.error(t("toast.members.removeError", undefined, { name: userName }), {
        description: errorMessage,
      });
    },
  });
}

export function useValidateMember(entity: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async (user: User) => {
      if (user.validateMemberRequest) {
        await user.validateMemberRequest();
      }
    },
    onSuccess: (_, user) => {
      const userName = user.serverData?.name || t("common.unknownUser");
      invalidateMemberQueries(queryClient, entity);
      toast.success(t("toast.members.validateSuccess", undefined, { name: userName }));
    },
    onError: (error: Error, user) => {
      const userName = user.serverData?.name || t("common.unknownUser");
      const errorMessage = error.message || t("toast.error.generic");
      toast.error(t("toast.members.validateError", undefined, { name: userName }), {
        description: errorMessage,
      });
    },
  });
}

export function useValidateAdmin(entity: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async (user: User) => {
      if (user.validateAdminRequest) {
        await user.validateAdminRequest();
      }
    },
    onSuccess: (_, user) => {
      const userName = user.serverData?.name || t("common.unknownUser");
      invalidateMemberQueries(queryClient, entity);
      toast.success(t("toast.members.validateAdminSuccess", undefined, { name: userName }));
    },
    onError: (error: Error, user) => {
      const userName = user.serverData?.name || t("common.unknownUser");
      const errorMessage = error.message || t("toast.error.generic");
      toast.error(t("toast.members.validateAdminError", undefined, { name: userName }), {
        description: errorMessage,
      });
    },
  });
}

export function useRejectMember(entity: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async (user: User) => {
      if (user.removeFromParent) {
        await user.removeFromParent();
      }
    },
    onSuccess: (_, user) => {
      const userName = user.serverData?.name || t("common.unknownUser");
      invalidateMemberQueries(queryClient, entity);
      toast.success(t("toast.members.removeSuccess", undefined, { name: userName }));
    },
    onError: (error: Error, user) => {
      const userName = user.serverData?.name || t("common.unknownUser");
      const errorMessage = error.message || t("toast.error.generic");
      toast.error(t("toast.members.removeError", undefined, { name: userName }), {
        description: errorMessage,
      });
    },
  });
}