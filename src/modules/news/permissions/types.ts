/**
 * Types de permissions pour le module news
 */

/**
 * Permissions calculées pour le module news
 */
export interface NewsPermissions {
  // Permissions de news
  canAddNews: boolean;
  canEditNews: boolean;
  canDeleteNews: boolean;
  canModerateNews: boolean;

  // Permissions de commentaires
  canEditComment: boolean;
  canDeleteComment: boolean;
}
