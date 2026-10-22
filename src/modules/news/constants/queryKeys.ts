/**
 * Query keys du module news — centralisés (single source of truth).
 *
 * Convention : chaque producteur a sa clé complète + une variante `_PREFIX`
 * minimaliste pour invalidation cross-contexte (matche toutes les variantes
 * peu importe `userContextId`).
 *
 * `userContextId` est inclus dans les clés complètes pour refetch auto quand
 * le contexte utilisateur change (logout/login) — sans cette dimension, deux
 * users distincts dans la même session pourraient se voir servir les données
 * du premier depuis le cache.
 */
export const NEWS_QUERY_KEYS = {
  /**
   * Liste des news d'une entité.
   *
   * Producteurs : `useNewsQuery`, `prefetchNews`
   * Consommateurs invalidants : `useNewsMutations` (create/update/delete),
   *   `useCommentMutations` (count comments change) — invalident via `NEWS_PREFIX`
   */
  NEWS: (entityId: string | null, userContextId: string | null = null) =>
    ["news", entityId, userContextId] as const,
  /** Préfixe pour invalidations (matche toutes les queries peu importe userContextId). */
  NEWS_PREFIX: (entityId: string | null) => ["news", entityId] as const,

  /**
   * Single news par id.
   *
   * Producteur : `useNewsByIdQuery`
   * Note : pas matché par `NEWS_PREFIX` (clé racine différente — `news-by-id`).
   *   Invalider explicitement via `NEWS_BY_ID_PREFIX` après update/delete.
   */
  NEWS_BY_ID: (
    entityId: string | null,
    newsId: string | null,
    userContextId: string | null = null,
  ) => ["news-by-id", entityId, newsId, userContextId] as const,
  NEWS_BY_ID_PREFIX: (entityId: string | null, newsId: string | null) =>
    ["news-by-id", entityId, newsId] as const,

  /*
   * `NEWS_COMMENTS` / `NEWS_COMMENTS_PREFIX` ont été retirées : le fil d'une actualité est
   * désormais servi par le module `comment`, sous ses propres clés (`COMMENT_QUERY_KEYS`).
   * Les laisser aurait créé deux caches concurrents pour la même donnée.
   */

  /**
   * Votes (likes/reactions) d'une news.
   *
   * Producteur : `useNewsVotes`
   * Consommateurs invalidants : la mutation de vote optimiste mute directement
   *   le cache local (`setQueryData`) ; pas d'invalidation explicite côté lib.
   */
  NEWS_VOTES: (newsId: string | null, userContextId: string | null = null) =>
    ["news-votes", newsId, userContextId] as const,
  NEWS_VOTES_PREFIX: (newsId: string | null) => ["news-votes", newsId] as const,

  /**
   * Entité PORTEUSE d'une news (son `target`), résolue par (type, id).
   *
   * Producteur : `PreviewNews` (module search) — résout l'entité pour monter le
   *   détail news fonctionnel et construire le permalien profil (cf. `resolveHostEntity`).
   */
  NEWS_HOST: (
    type: string | null,
    id: string | null,
    userContextId: string | null = null,
  ) => ["news-host", type, id, userContextId] as const,
  NEWS_HOST_PREFIX: (type: string | null, id: string | null) =>
    ["news-host", type, id] as const,
} as const;

export type NewsQueryKeyType = ReturnType<(typeof NEWS_QUERY_KEYS)[keyof typeof NEWS_QUERY_KEYS]>;
