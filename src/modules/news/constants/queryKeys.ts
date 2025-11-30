/**
 * Constantes centralisées pour les query keys React Query
 * Évite les magic strings et assure la cohérence des invalidations
 */

export const NEWS_QUERY_KEYS = {
  // News list for an entity
  NEWS: (entityId: string | null) => ["news", entityId] as const,

  // Single news by id
  NEWS_BY_ID: (entityId: string | null, newsId: string | null) =>
    ["news", entityId, newsId] as const,

  // Comments for a news
  NEWS_COMMENTS: (newsId: string | null) => ["news-comments", newsId] as const,

  // Votes for a news
  NEWS_VOTES: (newsId: string | null) => ["news-votes", newsId] as const,
} as const;

export type NewsQueryKeyType = ReturnType<(typeof NEWS_QUERY_KEYS)[keyof typeof NEWS_QUERY_KEYS]>;
