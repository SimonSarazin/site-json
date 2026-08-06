import type { ArticleData } from "../hooks/useArticle";

/**
 * Normalise un résultat de recherche (search/POI) en `ArticleData`.
 * `serverData.id` n'est PAS toujours peuplé sur un résultat de recherche → repli sur l'id racine
 * (getter d'instance SDK), comme SearchListView/CardFunding/AdminResourceTable. Sinon href → /blog/id/undefined.
 */
export function normalizeArticleResult(r: unknown): ArticleData {
  const sd = (r as { serverData?: Record<string, unknown> })?.serverData;
  const base = (sd && typeof sd === "object" ? sd : (r as Record<string, unknown>)) as ArticleData;
  if (base.id != null) return base;
  const rootId = (r as { id?: unknown })?.id;
  return rootId != null ? { ...base, id: String(rootId) } : base;
}

/** Reader canonique : `/blog/:slug` sinon `/blog/id/:id` ; ni slug ni id (article mal formé) → la liste, jamais `/blog/id/undefined`. */
export function articleHref(a: ArticleData, base: string): string {
  if (a.slug) return `${base}/${a.slug}`;
  if (a.id) return `${base}/id/${a.id}`;
  return base;
}
