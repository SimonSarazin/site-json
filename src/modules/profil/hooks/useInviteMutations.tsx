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

export function useInviteMember(entity: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async (user: User) => {
      if (user.sendRequestToJoinParent) {
        await user.sendRequestToJoinParent();
      }
    },
    onSuccess: (_, user) => {
      const userName = user.serverData?.name || t("common.unknownUser");
      invalidateMemberQueries(queryClient, entity);
      toast.success(t("toast.members.inviteSuccess", undefined, { name: userName }));
    },
    onError: (error: Error, user) => {
      const userName = user.serverData?.name || t("common.unknownUser");
      const errorMessage = error.message || t("toast.error.generic");
      toast.error(t("toast.members.inviteError", undefined, { name: userName }), {
        description: errorMessage,
      });
    },
  });
}

export function useInviteAdmin(entity: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async (user: User) => {
      if (user.sendRequestToJoinParent) {
        await user.sendRequestToJoinParent({ admin: true });
      }
    },
    onSuccess: (_, user) => {
      const userName = user.serverData?.name || t("common.unknownUser");
      invalidateMemberQueries(queryClient, entity);
      toast.success(t("toast.members.inviteAdminSuccess", undefined, { name: userName }));
    },
    onError: (error: Error, user) => {
      const userName = user.serverData?.name || t("common.unknownUser");
      const errorMessage = error.message || t("toast.error.generic");
      toast.error(t("toast.members.inviteAdminError", undefined, { name: userName }), {
        description: errorMessage,
      });
    },
  });
}