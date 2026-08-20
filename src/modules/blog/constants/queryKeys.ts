/**
 * Clés React Query du module blog (source unique — comme SEARCH_QUERY_KEYS / PROFIL_QUERY_KEYS).
 * Utilisées par `useArticleFeed` (fil), `useArticle`/`prefetchArticleById` (détail par id) ET l'invalidation
 * `invalidate:blog` (form article). Centraliser ici évite les clés magiques dispersées.
 */
export const BLOG_QUERY_KEYS = {
  /**
   * Préfixe de recherche du FIL (= `queryKeyPrefix` passé à `useSearchQuery` par `useArticleFeed`).
   * String → à passer à `SEARCH_QUERY_KEYS.RESULTS_PREFIX(...)` pour invalider toutes les variantes de filtres.
   * En config (searchKeys d'invalidation), utiliser le littéral équivalent `blog:<costumSlug>`.
   */
  FEED_PREFIX: (costumSlug: string): string => `blog:${costumSlug}`,
  /** Préfixe de la micro-requête ÉPINGLÉE (`featured:"flag"` — la fiche featured:true du scope).
   *  Invalidé par le même littéral d'invalidation que le fil (préfixe commun `blog:<slug>`). */
  PINNED_PREFIX: (costumSlug: string): string => `blog:${costumSlug}:pinned`,
  /** Détail d'un article chargé par id (branche `byId` de `useArticle` + `prefetchArticleById`). */
  ARTICLE_BY_ID: (id: string) => ["blog:article:id", id] as const,
  /** Préfixe de TOUTES les queries « article par id » (invalidation large). */
  ARTICLE_BY_ID_PREFIX: () => ["blog:article:id"] as const,
  /** Articles liés d'un article (par tags, scope costum, hors article courant). */
  RELATED: (costumSlug: string, id: string, tags: readonly string[]) =>
    ["blog:related", costumSlug, id, [...tags]] as const,
} as const;
