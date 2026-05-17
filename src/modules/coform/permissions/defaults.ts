/**
 * Permissions coform par défaut (tout désactivé).
 * Utilisé quand `entity` ou `me` est absent.
 */
import type { CoFormPermissions } from "./types";

const NEVER = () => false;

export const DEFAULT_COFORM_PERMISSIONS: CoFormPermissions = {
  canSubmitAnswer: false,
  cannotSubmitReason: "not_logged_in",

  canEditAnswer: NEVER,
  canDeleteAnswer: NEVER,

  canViewForm: true, // visualisation publique par défaut (sauf si isOnlyMember)

  isConnected: false,
  isMember: false,
  currentUserId: "",
};
