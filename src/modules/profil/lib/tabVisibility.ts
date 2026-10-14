import type { ProfileTabCondition, ProfileType } from "../schema";

export interface TabVisibilityContext {
  /** Type de l'entité du profil (`getEntityType()`) ; absent = inconnu, la condition ne filtre pas. */
  entityType?: string | null;
  /** Faux pendant le SSR ET le 1er rendu client — rien de ce qui dépend de `me` n'est alors décidé. */
  hydrated: boolean;
  /** Compte connecté — lu seulement une fois `hydrated`. */
  me?: { id?: string | null; slug?: string | null } | null;
  /** Slug de l'entité du profil. */
  entitySlug?: string | null;
}

/**
 * Un onglet de profil est-il proposé ?
 *
 * Les conditions qui dépendent de `me` ne sont tranchées qu'APRÈS hydratation : `me` vaut toujours
 * `null` au SSR mais est déjà résolu au 1er rendu client, et décider avant donnait deux listes
 * d'onglets différentes — un écart d'hydratation sur chaque onglet réservé au propriétaire.
 *  - `userContext` : avant hydratation, le profil n'est JAMAIS « le sien » (c'est ce que voyait déjà
 *    le SSR) ; un onglet `own` n'apparaît qu'ensuite, aucun contenu privé n'est rendu côté serveur.
 *  - `auth` : avant hydratation, la condition est ignorée (comportement historique).
 */
export function isTabVisible(condition: ProfileTabCondition | undefined, ctx: TabVisibilityContext): boolean {
  if (!condition) return true;

  if (condition.entityTypes && ctx.entityType && !condition.entityTypes.includes(ctx.entityType as ProfileType)) {
    return false;
  }

  if (condition.userContext) {
    const isOwnProfile = ctx.hydrated && !!ctx.me?.slug && ctx.me.slug === ctx.entitySlug;
    if (condition.userContext === "own" && !isOwnProfile) return false;
    if (condition.userContext === "other" && isOwnProfile) return false;
  }

  if (condition.auth && ctx.hydrated) {
    const isAuth = !!ctx.me?.id;
    if (condition.auth === "required" && !isAuth) return false;
    if (condition.auth === "anonymous" && isAuth) return false;
  }

  return true;
}
