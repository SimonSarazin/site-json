/**
 * Types de permissions pour le module coform.
 *
 * Le module coform travaille sur des formulaires (`forms`) et leurs réponses
 * (`answers`). Les permissions dérivent principalement de :
 *  - `me` connecté ou non
 *  - `access.canAnswer` / `access.reason` calculés côté backend (cf. CoFormAccessInfo)
 *  - droits d'édition d'une réponse spécifique (`answer.canEdit` côté API)
 *  - membre de l'entité costum (pour les formulaires `isOnlyMember`)
 */

import type { CoFormAccessInfo, CoFormAccessReason, CoFormAnswer } from "../types";

export interface CoFormPermissions {
  // Soumission de réponse
  /** L'utilisateur peut soumettre une nouvelle réponse au formulaire. */
  canSubmitAnswer: boolean;
  /** Raison du refus si `canSubmitAnswer` est false (already_answered, not_logged_in, ...). */
  cannotSubmitReason?: CoFormAccessReason;

  // Édition d'une réponse existante
  /** L'utilisateur peut éditer la réponse spécifique passée en data. */
  canEditAnswer: (answer: CoFormAnswerLike | null | undefined) => boolean;

  // Suppression d'une réponse
  /** L'utilisateur peut supprimer la réponse spécifique passée en data. */
  canDeleteAnswer: (answer: CoFormAnswerLike | null | undefined) => boolean;

  // Affichage
  /** L'utilisateur peut voir le formulaire (peut être restreint isOnlyMember). */
  canViewForm: boolean;

  // Méta-info utile aux call-sites
  isConnected: boolean;
  /** Membre de l'entité costum (si le formulaire impose `isOnlyMember`). */
  isMember: boolean;
  currentUserId: string;
}

/**
 * Sous-ensemble d'une réponse utilisé pour calculer les permissions.
 * Évite de coupler le type permissions au shape complet de `CoFormAnswer`.
 */
export interface CoFormAnswerLike {
  /** Auteur de la réponse (userId). Permet de savoir si `me` est l'auteur. */
  user?: string;
  /** Calculé côté serveur : autorisation d'édition pour `me`. */
  canEdit?: boolean;
  /** État brouillon vs finalisé — un brouillon est toujours éditable par l'auteur. */
  draft?: boolean;
}

/**
 * Donnée additionnelle passée via `usePermissions(['coform'], entity, data)`.
 */
export interface CoFormPermissionData {
  /** Informations d'accès retournées par `useCoFormQuery` (calcul backend). */
  access?: CoFormAccessInfo | null;
  /** Réponse spécifique pour calcul `canEditAnswer` / `canDeleteAnswer`. */
  answer?: CoFormAnswer | null;
}
