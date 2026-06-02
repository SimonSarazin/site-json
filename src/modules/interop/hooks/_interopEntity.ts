/**
 * Augmentation locale des entités SDK avec les méthodes interop.
 *
 * Le SDK `@communecter/cocolight-api-client` ne types pas encore ces méthodes
 * runtime ajoutées par le backend Cocolight (link/unlink Discourse/MediaWiki,
 * getDiscourseProfile, getMediaWikiContributions, etc.).
 *
 * Ce module concentre **tous les casts SDK interop** en un seul endroit, à la place
 * des 8+ casts disséminés dans les 4 hooks interop. Quand le SDK exposera ces
 * méthodes nativement, supprimer ce fichier et utiliser directement `EntityTypes`.
 *
 * @todo Demander au mainteneur SDK d'exposer ces méthodes (cf. AUDIT-cocolight-api-client.md).
 */
import type { EntityTypes } from "@communecter/cocolight-api-client";

// ============================================================================
// Types de retour des méthodes interop
// ============================================================================

export type DiscourseLinkResult = {
  result: boolean;
  error?: string;
  username?: string;
  profileUrl?: string;
};

export type DiscourseCheckEmailResult = {
  found: boolean;
  user?: Record<string, unknown>;
};

export type DiscourseSimpleResult = {
  result: boolean;
  error?: string;
};

/**
 * Forme du retour `getDiscourseProfile` côté backend Cocolight.
 *
 * Champs minimaux observés (cf. consommateurs `DiscoursePod.tsx`) — gardés
 * permissifs `Record<string, unknown>` pour les sous-arbres non encore stabilisés.
 */
export type DiscourseProfilResult = {
  summary?: Record<string, unknown>;
  profileUrl?: string;
  error?: string;
  [k: string]: unknown;
};

export type MediawikiResult = {
  result: boolean;
  error?: string;
  username?: string;
  msg?: string;
};

export interface WikiContrib {
  title?: string;
  timestamp?: string;
  comment?: string;
  revid?: number;
  [k: string]: unknown;
}

export type MediawikiContribsResult = {
  result: boolean;
  contribs?: WikiContrib[] | Record<string, unknown> | null;
  [k: string]: unknown;
};

// ============================================================================
// Augmentation locale — Entity avec méthodes interop runtime
// ============================================================================

/**
 * Type intersection — `EntityTypes` SDK + les méthodes interop ajoutées côté backend.
 *
 * @internal Usage interne au module `interop`. Ne pas exporter en dehors.
 */
export type EntityWithInterop = EntityTypes & {
  // Mutations Discourse
  linkDiscourseAccount(username: string): Promise<DiscourseLinkResult>;
  unlinkDiscourseAccount(): Promise<DiscourseSimpleResult>;
  checkDiscourseEmailMatch(): Promise<DiscourseCheckEmailResult>;
  dismissDiscourseLink(): Promise<DiscourseSimpleResult>;
  // Query Discourse
  getDiscourseProfile(username: string): Promise<DiscourseProfilResult>;
  // Mutations MediaWiki
  linkMediaWikiAccount(username: string): Promise<MediawikiResult>;
  unlinkMediaWikiAccount(): Promise<MediawikiResult>;
  // Query MediaWiki
  getMediaWikiContributions(
    username: string,
    limit?: number,
  ): Promise<MediawikiContribsResult>;
};

/**
 * Narrow une entité SDK générique vers le type interop augmenté.
 * Helper unique pour les 4 hooks du module.
 */
export function asInteropEntity(entity: EntityTypes): EntityWithInterop {
  return entity as EntityWithInterop;
}
