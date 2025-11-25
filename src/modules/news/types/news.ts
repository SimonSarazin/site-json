
/**
 * Types spécifiques au module News
 */

// Context du module News
export interface NewsContextType {
  entity?: any; // EntityTypes depuis cocolight-api-client
  entityId?: string;
  entityType?: string;
  config?: NewsModuleConfig;
  permissions?: NewsPermissions;
}

// Configuration du module News
export interface NewsModuleConfig {
  maxFileSize: number;
  allowedFileTypes: string[];
  maxImages: number;
  maxTextLength: number;
  enableReactions: boolean;
  enableComments: boolean;
  enableSharing: boolean;
  moderationEnabled: boolean;
}

// Permissions pour les actions news
export interface NewsPermissions {
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canModerate: boolean;
  canComment: boolean;
  canReact: boolean;
  canShare: boolean;
  canReport: boolean;
}
