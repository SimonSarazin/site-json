/**
 * Permissions cagnotte par défaut (tout désactivé)
 * Utilisé quand `entity` ou `me` est absent.
 */
import type { CagnottePermissions } from "./types";

const NEVER = () => false;

export const DEFAULT_CAGNOTTE_PERMISSIONS: CagnottePermissions = {
  canContribute: false,
  canContributeReason: "No entity or user provided",

  canCreateMilestone: false,
  canEditMilestone: NEVER,
  canCloseMilestone: NEVER,
  canRestoreMilestone: NEVER,
  canDeleteMilestone: NEVER,

  canCreateAction: NEVER,
  canEditAction: NEVER,
  canMarkActionDone: NEVER,
  canDeleteAction: NEVER,
  canCandidateAction: NEVER,

  isConnected: false,
  isAdmin: false,
  isContributor: false,
  currentUserId: "",
};
