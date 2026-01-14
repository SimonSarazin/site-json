/**
 * Module actions - Point d'entrée unique
 * Exporte tous les hooks, builders, et configurations
 */

// ============ HOOKS PRINCIPAUX ============
export { useEntityActions } from "./hooks/useEntityActions";
export type { EntityAction, EntityActionsResult } from "../types";

// Sub-hooks (pour usage avancé)
export { useUserEntityActions } from "./hooks/useUserEntityActions";
export { useOrgEntityActions } from "./hooks/useOrgEntityActions";
export { useProjectEntityActions } from "./hooks/useProjectEntityActions";
export { useEventEntityActions } from "./hooks/useEventEntityActions";

// Admin actions (pour listes de membres)
export { useAdminActions } from "./hooks/useAdminActions";

// ============ MUTATIONS ============
// Relationship mutations
export {
  useFollowEntity,
  useUnfollowEntity,
  useRequestToJoin,
  useRequestToJoinAdmin,
  useLeaveEntity,
  useAcceptInvitation,
  useRejectInvitation,
  useRequestPromoteToAdmin,
} from "./mutations/relationship";

// Friend mutations
export {
  useSendFriendRequest,
  useAcceptFriendRequest,
  useRejectFriendRequest,
  useRemoveFriend,
  useCancelFriendRequest,
} from "./mutations/friend";

// Member mutations (admin actions)
export {
  usePromoteMember,
  useDemoteMember,
  useRemoveMember,
  useValidateMember,
  useValidateAdmin,
  useRejectMember,
  useInviteMember,
  useInviteAdmin,
} from "./mutations/member";

// ============ BUILDERS ============
export {
  buildEntityAction,
  buildPendingAction,
  buildEntityActionWithParams,
} from "./builders/buildEntityAction";

export {
  buildUserAction,
  buildDisabledUserAction,
  buildInviteAction,
} from "./builders/buildUserAction";

// ============ CONFIGURATION ============
export { ACTION_ICONS, getActionIcon } from "./config/icons";
export type { ActionIconKey } from "./config/icons";

export { ENTITY_ACTION_CONFIG } from "./config/entity-actions";
export type { EntityActionConfig, EntityActionConfigKey } from "./config/entity-actions";

export { MEMBER_ACTION_CONFIG } from "./config/member-actions";
export type { MemberActionConfig, MemberActionConfigKey } from "./config/member-actions";

// ============ UTILITIES ============
export {
  createEntityMutation,
  createUserMutation,
  getEntityType,
  invalidateMemberQueries,
} from "./mutations/core";
export type { EntityMutationConfig, UserMutationConfig, EntityType } from "./mutations/core";
