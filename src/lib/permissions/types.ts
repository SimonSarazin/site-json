/**
 * Types de base pour le système de permissions extensible
 */
import type { EntityTypes, User } from "@communecter/cocolight-api-client";

/**
 * Contexte passé aux calculateurs de permissions
 */
export interface PermissionContext {
  /** Entité concernée (User, Organization, Project, Event, Poi) */
  entity: EntityTypes | null;
  /** Utilisateur connecté */
  me: User | null;
  /** Données additionnelles (news, etc.) */
  data?: Record<string, unknown>;
}

/**
 * Interface pour un calculateur de permissions
 * Chaque module enregistre son propre calculateur
 */
export interface PermissionCalculator<T = Record<string, unknown>> {
  /** Namespace unique du module (ex: "profil", "news") */
  namespace: string;
  /** Fonction de calcul des permissions */
  calculate: (context: PermissionContext) => T;
}

/**
 * Type helper pour typer les résultats de usePermissions
 */
export type PermissionsResult<T extends Record<string, unknown>> = T;
