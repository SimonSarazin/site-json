/**
 * Valeurs par défaut des permissions news
 */
import type { NewsPermissions } from "./types";

/**
 * Permissions par défaut (tout désactivé)
 */
export const DEFAULT_NEWS_PERMISSIONS: NewsPermissions = {
  canAddNews: false,
  canEditNews: false,
  canDeleteNews: false,
  canModerateNews: false,
  canEditComment: false,
  canDeleteComment: false,
};
