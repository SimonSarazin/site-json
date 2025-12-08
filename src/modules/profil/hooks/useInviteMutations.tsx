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

  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug ?? null) });

  if (isOrganization(entity)) {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ORGANIZATION_MEMBERS_PREFIX(entity.slug ?? null) });
  } else if (isProject(entity)) {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECT_CONTRIBUTORS_PREFIX(entity.slug ?? null) });
  } else if (isEvent(entity)) {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.EVENT_ATTENDEES_PREFIX(entity.slug ?? null) });
  }
}

/**
 * Hook pour inviter un membre
 */
export function useInviteMember(entity: EntityTypes | null) {
  const queryClient = useQueryClient();

  return useMutationWithToast<void, User>({
    mutationFn: async (user) => {
      if (user.sendRequestToJoinParent) {
        await user.sendRequestToJoinParent();
      }
    },
    successKey: "toast.members.inviteSuccess",
    errorKey: "toast.members.inviteError",
    getSuccessParams: (_, user) => ({ name: user.serverData?.name || "" }),
    getErrorParams: (_, user) => ({ name: user.serverData?.name || "" }),
    onSuccessCallback: () => {
      invalidateMemberQueriesForEntity(queryClient, entity);
    },
    invalidateQueries: [],
  });
}

/**
 * Hook pour inviter un admin
 */
export function useInviteAdmin(entity: EntityTypes | null) {
  const queryClient = useQueryClient();

  return useMutationWithToast<void, User>({
    mutationFn: async (user) => {
      if (user.sendRequestToJoinParent) {
        await user.sendRequestToJoinParent({ admin: true });
      }
    },
    successKey: "toast.members.inviteAdminSuccess",
    errorKey: "toast.members.inviteAdminError",
    getSuccessParams: (_, user) => ({ name: user.serverData?.name || "" }),
    getErrorParams: (_, user) => ({ name: user.serverData?.name || "" }),
    onSuccessCallback: () => {
      invalidateMemberQueriesForEntity(queryClient, entity);
    },
    invalidateQueries: [],
  });
}
