import { useQueryClient } from "@tanstack/react-query";
import type { User, EntityTypes } from "@communecter/cocolight-api-client";
import { isOrganization, isProject, isEvent } from "@/lib/getTypedEntity";
import { useMutationWithToast } from "./core";
import { QUERY_KEYS } from "../constants/queryKeys";

/**
 * Invalide toutes les queries liées aux membres d'une entité
 */
function invalidateMemberQueriesForEntity(
  queryClient: ReturnType<typeof useQueryClient>,
  entity: EntityTypes | null
): void {
  if (!entity) return;

  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ELEMENT_ABOUT(entity.slug ?? null) });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SEARCH_USERS() });

  if (isOrganization(entity)) {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ORGANIZATION_MEMBERS(entity.slug ?? null) });
  } else if (isProject(entity)) {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECT_CONTRIBUTORS(entity.slug ?? null) });
  } else if (isEvent(entity)) {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.EVENT_ATTENDEES(entity.slug ?? null) });
  }
}

/**
 * Hook pour rétrograder un membre (retirer admin)
 */
export function useDemoteMember(entity: EntityTypes | null) {
  const queryClient = useQueryClient();

  return useMutationWithToast<void, User>({
    mutationFn: async (user) => {
      if (user.demoteFromAdmin) {
        await user.demoteFromAdmin();
      }
    },
    successKey: "toast.members.demoteSuccess",
    errorKey: "toast.members.demoteError",
    getSuccessParams: (_, user) => ({ name: user.serverData?.name || "" }),
    getErrorParams: (_, user) => ({ name: user.serverData?.name || "" }),
    onSuccessCallback: () => {
      invalidateMemberQueriesForEntity(queryClient, entity);
    },
    invalidateQueries: [],
  });
}

/**
 * Hook pour promouvoir un membre en admin
 */
export function usePromoteMember(entity: EntityTypes | null) {
  const queryClient = useQueryClient();

  return useMutationWithToast<void, User>({
    mutationFn: async (user) => {
      if (user.promoteToAdmin) {
        await user.promoteToAdmin();
      }
    },
    successKey: "toast.members.promoteSuccess",
    errorKey: "toast.members.promoteError",
    getSuccessParams: (_, user) => ({ name: user.serverData?.name || "" }),
    getErrorParams: (_, user) => ({ name: user.serverData?.name || "" }),
    onSuccessCallback: () => {
      invalidateMemberQueriesForEntity(queryClient, entity);
    },
    invalidateQueries: [],
  });
}

/**
 * Hook pour retirer un membre
 */
export function useRemoveMember(entity: EntityTypes | null) {
  const queryClient = useQueryClient();

  return useMutationWithToast<void, User>({
    mutationFn: async (user) => {
      if (user.removeFromParent) {
        await user.removeFromParent();
      }
    },
    successKey: "toast.members.removeSuccess",
    errorKey: "toast.members.removeError",
    getSuccessParams: (_, user) => ({ name: user.serverData?.name || "" }),
    getErrorParams: (_, user) => ({ name: user.serverData?.name || "" }),
    onSuccessCallback: () => {
      invalidateMemberQueriesForEntity(queryClient, entity);
    },
    invalidateQueries: [],
  });
}

/**
 * Hook pour valider une demande de membre
 */
export function useValidateMember(entity: EntityTypes | null) {
  const queryClient = useQueryClient();

  return useMutationWithToast<void, User>({
    mutationFn: async (user) => {
      if (user.validateMemberRequest) {
        await user.validateMemberRequest();
      }
    },
    successKey: "toast.members.validateSuccess",
    errorKey: "toast.members.validateError",
    getSuccessParams: (_, user) => ({ name: user.serverData?.name || "" }),
    getErrorParams: (_, user) => ({ name: user.serverData?.name || "" }),
    onSuccessCallback: () => {
      invalidateMemberQueriesForEntity(queryClient, entity);
    },
    invalidateQueries: [],
  });
}

/**
 * Hook pour valider une demande d'admin
 */
export function useValidateAdmin(entity: EntityTypes | null) {
  const queryClient = useQueryClient();

  return useMutationWithToast<void, User>({
    mutationFn: async (user) => {
      if (user.validateAdminRequest) {
        await user.validateAdminRequest();
      }
    },
    successKey: "toast.members.validateAdminSuccess",
    errorKey: "toast.members.validateAdminError",
    getSuccessParams: (_, user) => ({ name: user.serverData?.name || "" }),
    getErrorParams: (_, user) => ({ name: user.serverData?.name || "" }),
    onSuccessCallback: () => {
      invalidateMemberQueriesForEntity(queryClient, entity);
    },
    invalidateQueries: [],
  });
}

/**
 * Hook pour rejeter une demande de membre
 */
export function useRejectMember(entity: EntityTypes | null) {
  const queryClient = useQueryClient();

  return useMutationWithToast<void, User>({
    mutationFn: async (user) => {
      if (user.removeFromParent) {
        await user.removeFromParent();
      }
    },
    successKey: "toast.members.removeSuccess",
    errorKey: "toast.members.removeError",
    getSuccessParams: (_, user) => ({ name: user.serverData?.name || "" }),
    getErrorParams: (_, user) => ({ name: user.serverData?.name || "" }),
    onSuccessCallback: () => {
      invalidateMemberQueriesForEntity(queryClient, entity);
    },
    invalidateQueries: [],
  });
}
