/**
 * Types centralisés pour le module profil
 *
 * Ce fichier contient les types réutilisables du module profil.
 * Les Props de composants spécifiques restent dans leurs fichiers respectifs.
 */

import type React from "react";
import type { Organization, Project, Event, Poi } from "@communecter/cocolight-api-client";

// ============================================
// Types d'actions (EntityActions)
// ============================================

/**
 * Action disponible sur une entité (follow, unfollow, join, etc.)
 */
export interface EntityAction {
  id: string;
  type: "follow" | "unfollow" | "friend" | "unfriend" | "join" | "leave" | "pending" | "accept" | "reject";
  label: string;
  icon: React.ReactNode;
  variant: "default" | "outline" | "destructive";
  onClick: () => void;
  requiresConfirmation: boolean;
  confirmationTitle?: string;
  confirmationDescription?: string;
  confirmationConfirm?: string;
  confirmationCancel?: string;
  isDestructive?: boolean;
  isPending?: boolean;
  disabled?: boolean;
  show: boolean;
}

/**
 * Résultat du hook useEntityActions
 */
export interface EntityActionsResult {
  actions: EntityAction[];
  layout: "separate-buttons" | "status-dropdown";
  statusLabel?: string;
  statusIcon?: React.ReactNode;
  statusVariant?: "default" | "outline";
}

// ============================================
// Types d'actions utilisateur (UserActions)
// ============================================

/**
 * Action disponible sur un utilisateur (membre, admin, etc.)
 */
export interface UserAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  variant: "default" | "outline" | "destructive" | "secondary";
  onClick: () => void;
  disabled?: boolean;
  requiresConfirmation?: boolean;
}

// ============================================
// Types de relations (RelatedEntities)
// ============================================

/**
 * Types de relations supportés pour ProfileRelated
 */
export type RelationType = "organizations" | "projects" | "events" | "poi";

/**
 * Paramètres pour la requête d'entités liées
 */
export interface RelatedEntitiesParams {
  indexStep?: number;
  search?: string;
}

/**
 * Résultat du hook useRelatedEntities
 */
export interface UseRelatedEntitiesResult {
  entities: (Organization | Project | Event | Poi)[];
  totalCount: number;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  lastItemRef: (node: HTMLElement | null) => void;
  error: Error | null;
  refetch: () => void;
}

// ============================================
// Types de query (Members, Friends)
// ============================================

/**
 * Options de filtrage pour les requêtes de membres
 */
export interface MemberQueryOptions {
  toBeValidated?: boolean;
  isAdmin?: boolean;
  isAdminPending?: boolean;
  isInviting?: boolean;
  roles?: unknown[];
}

/**
 * Paramètres de pagination pour les requêtes de membres
 */
export interface MemberQueryParams {
  indexStep?: number;
  search?: string;
}

/**
 * Paramètres pour la requête d'amis
 */
export interface FriendsQueryParams {
  indexStep?: number;
  search?: string;
  status?: "all" | "pending" | "friends" | "sent";
}

// ============================================
// Types d'état (Confirmation Dialog)
// ============================================

/**
 * État d'un dialogue de confirmation
 */
export interface ConfirmationState {
  open: boolean;
  title: string;
  description: string;
  action: () => void;
  isDestructive?: boolean;
}
