import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useT } from "@/hooks/useT";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { isOrganization, isProject, isEvent } from "@/lib/getTypedEntity";

export interface MemberAction {
  memberId: string;
  action: "accept" | "reject" | "promote" | "demote" | "remove" | "invite";
  role?: string;
  email?: string; // For invitations
}

/**
 * Hook pour accepter une demande de membre/contributeur/participant
 */
export function useAcceptMemberRequest(entity: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async ({ memberId: _memberId }: { memberId: string }) => {
      if (!entity) {
        throw new Error("Entity is required");
      }

      // TODO: Implementer selon l'API disponible
      // Ces méthodes devront être ajoutées à l'API client
      if (isOrganization(entity)) {
        // return await entity.acceptMemberRequest(memberId);
        throw new Error("acceptMemberRequest not implemented yet");
      } else if (isProject(entity)) {
        // return await entity.acceptContributorRequest(memberId);
        throw new Error("acceptContributorRequest not implemented yet");
      } else if (isEvent(entity)) {
        // return await entity.acceptParticipantRequest(memberId);
        throw new Error("acceptParticipantRequest not implemented yet");
      }

      throw new Error("Unsupported entity type");
    },

    onSuccess: () => {
      // Invalider les caches des membres
      if (entity) {
        if (isOrganization(entity)) {
          queryClient.invalidateQueries({ queryKey: ["organization-members", entity.slug] });
        } else if (isProject(entity)) {
          queryClient.invalidateQueries({ queryKey: ["project-contributors", entity.slug] });
        } else if (isEvent(entity)) {
          queryClient.invalidateQueries({ queryKey: ["event-attendees", entity.slug] });
        }
      }
      toast.success(t("toast.members.requestAccepted"));
    },

    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
      toast.error(t("toast.members.acceptRequestError"), {
        description: errorMessage,
      });
    },
  });
}

/**
 * Hook pour rejeter une demande de membre/contributeur/participant
 */
export function useRejectMemberRequest(entity: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async ({ memberId: _memberId }: { memberId: string }) => {
      if (!entity) {
        throw new Error("Entity is required");
      }

      // TODO: Implementer selon l'API disponible
      if (isOrganization(entity)) {
        // return await entity.rejectMemberRequest(memberId);
        throw new Error("rejectMemberRequest not implemented yet");
      } else if (isProject(entity)) {
        // return await entity.rejectContributorRequest(memberId);
        throw new Error("rejectContributorRequest not implemented yet");
      } else if (isEvent(entity)) {
        // return await entity.rejectParticipantRequest(memberId);
        throw new Error("rejectParticipantRequest not implemented yet");
      }

      throw new Error("Unsupported entity type");
    },

    onSuccess: () => {
      if (entity) {
        if (isOrganization(entity)) {
          queryClient.invalidateQueries({ queryKey: ["organization-members", entity.slug] });
        } else if (isProject(entity)) {
          queryClient.invalidateQueries({ queryKey: ["project-contributors", entity.slug] });
        } else if (isEvent(entity)) {
          queryClient.invalidateQueries({ queryKey: ["event-attendees", entity.slug] });
        }
      }
      toast.success(t("toast.members.requestRejected"));
    },

    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
      toast.error(t("toast.members.rejectRequestError"), {
        description: errorMessage,
      });
    },
  });
}

/**
 * Hook pour promouvoir un membre (ex: membre -> admin)
 */
export function usePromoteMember(entity: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async ({ memberId: _memberId, role: _role = "admin" }: { memberId: string; role?: string }) => {
      if (!entity) {
        throw new Error("Entity is required");
      }

      // TODO: Implementer selon l'API disponible
      if (isOrganization(entity)) {
        // return await entity.promoteMember(memberId, role);
        throw new Error("promoteMember not implemented yet");
      } else if (isProject(entity)) {
        // return await entity.promoteContributor(memberId, role);
        throw new Error("promoteContributor not implemented yet");
      }

      throw new Error("Unsupported entity type or action");
    },

    onSuccess: () => {
      if (entity) {
        if (isOrganization(entity)) {
          queryClient.invalidateQueries({ queryKey: ["organization-members", entity.slug] });
        } else if (isProject(entity)) {
          queryClient.invalidateQueries({ queryKey: ["project-contributors", entity.slug] });
        }
      }
      toast.success(t("toast.members.memberPromoted"));
    },

    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
      toast.error(t("toast.members.promoteError"), {
        description: errorMessage,
      });
    },
  });
}

/**
 * Hook pour rétrograder un membre (ex: admin -> membre)
 */
export function useDemoteMember(entity: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async ({ memberId: _memberId }: { memberId: string }) => {
      if (!entity) {
        throw new Error("Entity is required");
      }

      // TODO: Implementer selon l'API disponible
      if (isOrganization(entity)) {
        // return await entity.demoteMember(memberId);
        throw new Error("demoteMember not implemented yet");
      } else if (isProject(entity)) {
        // return await entity.demoteContributor(memberId);
        throw new Error("demoteContributor not implemented yet");
      }

      throw new Error("Unsupported entity type or action");
    },

    onSuccess: () => {
      if (entity) {
        if (isOrganization(entity)) {
          queryClient.invalidateQueries({ queryKey: ["organization-members", entity.slug] });
        } else if (isProject(entity)) {
          queryClient.invalidateQueries({ queryKey: ["project-contributors", entity.slug] });
        }
      }
      toast.success(t("toast.members.memberDemoted"));
    },

    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
      toast.error(t("toast.members.demoteError"), {
        description: errorMessage,
      });
    },
  });
}

/**
 * Hook pour exclure un membre
 */
export function useRemoveMember(entity: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async ({ memberId: _memberId }: { memberId: string }) => {
      if (!entity) {
        throw new Error("Entity is required");
      }

      // TODO: Implementer selon l'API disponible
      if (isOrganization(entity)) {
        // return await entity.removeMember(memberId);
        throw new Error("removeMember not implemented yet");
      } else if (isProject(entity)) {
        // return await entity.removeContributor(memberId);
        throw new Error("removeContributor not implemented yet");
      } else if (isEvent(entity)) {
        // return await entity.removeParticipant(memberId);
        throw new Error("removeParticipant not implemented yet");
      }

      throw new Error("Unsupported entity type");
    },

    onSuccess: () => {
      if (entity) {
        if (isOrganization(entity)) {
          queryClient.invalidateQueries({ queryKey: ["organization-members", entity.slug] });
        } else if (isProject(entity)) {
          queryClient.invalidateQueries({ queryKey: ["project-contributors", entity.slug] });
        } else if (isEvent(entity)) {
          queryClient.invalidateQueries({ queryKey: ["event-attendees", entity.slug] });
        }
      }
      toast.success(t("toast.members.memberRemoved"));
    },

    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
      toast.error(t("toast.members.removeError"), {
        description: errorMessage,
      });
    },
  });
}

/**
 * Hook pour inviter un membre par email
 */
export function useInviteMember(entity: EntityTypes | null) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async ({ email: _email, role: _role = "member" }: { email: string; role?: string }) => {
      if (!entity) {
        throw new Error("Entity is required");
      }

      // TODO: Implementer selon l'API disponible
      if (isOrganization(entity)) {
        // return await entity.inviteMember(email, role);
        throw new Error("inviteMember not implemented yet");
      } else if (isProject(entity)) {
        // return await entity.inviteContributor(email, role);
        throw new Error("inviteContributor not implemented yet");
      } else if (isEvent(entity)) {
        // return await entity.inviteParticipant(email);
        throw new Error("inviteParticipant not implemented yet");
      }

      throw new Error("Unsupported entity type");
    },

    onSuccess: () => {
      if (entity) {
        if (isOrganization(entity)) {
          queryClient.invalidateQueries({ queryKey: ["organization-members", entity.slug] });
        } else if (isProject(entity)) {
          queryClient.invalidateQueries({ queryKey: ["project-contributors", entity.slug] });
        } else if (isEvent(entity)) {
          queryClient.invalidateQueries({ queryKey: ["event-attendees", entity.slug] });
        }
      }
      toast.success(t("toast.members.invitationSent"));
    },

    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
      toast.error(t("toast.members.inviteError"), {
        description: errorMessage,
      });
    },
  });
}