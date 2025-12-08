/**
 * Constantes centralisées pour les query keys React Query
 * Évite les magic strings et assure la cohérence des invalidations
 */

export const NEWS_QUERY_KEYS = {
  // News list for an entity (userContextId pour refetch auto quand le contexte change)
  NEWS: (entityId: string | null, userContextId: string | null = null) => ["news", entityId, userContextId] as const,
  // Préfixe pour invalidations (matche toutes les queries peu importe userContextId)
  NEWS_PREFIX: (entityId: string | null) => ["news", entityId] as const,

  // Single news by id (userContextId pour refetch auto quand le contexte change)
  NEWS_BY_ID: (entityId: string | null, newsId: string | null, userContextId: string | null = null) =>
    ["news-by-id", entityId, newsId, userContextId] as const,
  NEWS_BY_ID_PREFIX: (entityId: string | null, newsId: string | null) =>
    ["news-by-id", entityId, newsId] as const,

  // Comments for a news (userContextId pour refetch auto quand le contexte change)
  NEWS_COMMENTS: (newsId: string | null, userContextId: string | null = null) =>
    ["news-comments", newsId, userContextId] as const,
  NEWS_COMMENTS_PREFIX: (newsId: string | null) => ["news-comments", newsId] as const,

  // Votes for a news (userContextId pour refetch auto quand le contexte change)
  NEWS_VOTES: (newsId: string | null, userContextId: string | null = null) =>
    ["news-votes", newsId, userContextId] as const,
  NEWS_VOTES_PREFIX: (newsId: string | null) => ["news-votes", newsId] as const,
} as const;

export type NewsQueryKeyType = ReturnType<(typeof NEWS_QUERY_KEYS)[keyof typeof NEWS_QUERY_KEYS]>;
