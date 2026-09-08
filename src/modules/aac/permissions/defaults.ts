/**
 * Permissions AAC par défaut (tout désactivé). Utilisé quand `entity` est absent.
 */
import type { AacPermissions } from "./types";

const NEVER = () => false;

export const DEFAULT_AAC_PERMISSIONS: AacPermissions = {
  canCreateCommun: false,
  canCreateCommunReason: "No entity or user provided",
  canReadCommuns: false,
  canEditCommun: NEVER,
  canParticipateActions: false,
  canViewFunding: false,
  canContributeFunding: false,
  canContributeFundingReason: "No entity or user provided",
  canSelectCommun: false,
  isConnected: false,
  isAdmin: false,
  currentUserId: "",
};
