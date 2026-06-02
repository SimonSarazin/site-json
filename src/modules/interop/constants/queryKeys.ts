/**
 * Query keys du module interop — centralisées (single source of truth).
 *
 * Convention : préfixe figé par service (`"discourse-profil"`,
 * `"mediawiki-contribs"`), méthodes en SCREAMING_SNAKE_CASE, chaque
 * producteur a sa clé complète + une variante `_PREFIX` pour invalidation
 * cross-username.
 *
 * `entityId` joue le rôle de dimension user (le module interop opère sur
 * `me` via `useCocolight().entity`) — pas besoin d'ajouter `userId` séparé.
 * `username` (Discourse/Wiki) est inclus car un même `me` peut changer son
 * username lié (relink), invalidant le profil cached.
 *
 * Params tolèrent `null` pour permettre les hooks `enabled: false`.
 */
export const INTEROP_QUERY_KEYS = {
  /**
   * Profil Discourse d'un user (réputation, posts, badges).
   *
   * Producteur : `useDiscourseProfilQuery`
   * Consommateurs invalidants : `useDiscourseLink`, `useDiscourseUnlink`,
   *   `useDiscourseDismiss` — via `DISCOURSE_PROFIL_PREFIX()`
   */
  DISCOURSE_PROFIL: (entityId: string | null, discourseUsername: string | null) =>
    ["discourse-profil", entityId, discourseUsername] as const,
  /** Préfixe minimal — invalide tous les profils Discourse (toutes entités/usernames). */
  DISCOURSE_PROFIL_PREFIX: () => ["discourse-profil"] as const,

  /**
   * Contributions MediaWiki récentes d'un user.
   *
   * Producteur : `useMediawikiContribsQuery`
   * Consommateurs invalidants : `useMediawikiLink`, `useMediawikiUnlink` —
   *   via `MEDIAWIKI_CONTRIBS_PREFIX()`
   */
  MEDIAWIKI_CONTRIBS: (entityId: string | null, wikiUsername: string | null) =>
    ["mediawiki-contribs", entityId, wikiUsername] as const,
  /** Préfixe minimal — invalide toutes les contribs MediaWiki. */
  MEDIAWIKI_CONTRIBS_PREFIX: () => ["mediawiki-contribs"] as const,
} as const;

export type InteropQueryKeyType = ReturnType<
  (typeof INTEROP_QUERY_KEYS)[keyof typeof INTEROP_QUERY_KEYS]
>;
