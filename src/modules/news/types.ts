import type { EntityTypes } from "@communecter/cocolight-api-client";

/**
 * Types spécifiques au module News
 */

// Context du module News
export interface NewsContextType {
  entity?: EntityTypes;
  entityId?: string;
  entityType?: string;
  config?: NewsModuleConfig;
  permissions?: NewsPermissions;
  detailUrlGenerator?: (newsId: string) => string | null; // Fonction pour générer l'URL de détail
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

// Media item types for news images and documents
export interface NewsImageItem {
  id?: string;
  _id?: { _str: string };
  imagePath?: string;
  imageThumbPath?: string;
  name?: string;
}

export interface NewsDocumentItem {
  id?: string;
  name?: string;
  docPath: string;
  size?: number;
}
