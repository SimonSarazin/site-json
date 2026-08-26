/**
 * État UI (recherche + filtres) → params de `Form.toolsCatalog`. Source unique
 * pour construire le payload serveur (nom, filters, indexStep).
 */
export interface ToolsCatalogQuery {
  /** Terme de recherche (le backend fait le match accent/casse-insensible). */
  search?: string;
  category?: string;
  usage?: string;
  isOpenSource?: boolean;
}

export interface ToolsCatalogPayload {
  name?: string;
  filters?: Record<string, unknown>;
  indexStep: number;
}

export function buildToolsPayload(query: ToolsCatalogQuery, indexStep: number): ToolsCatalogPayload {
  const filters: Record<string, unknown> = {};
  if (query.category) filters.category = query.category;
  if (query.usage) filters.usage = query.usage;
  if (typeof query.isOpenSource === "boolean") filters.isOpenSource = query.isOpenSource;

  const name = query.search?.trim();
  return {
    ...(name ? { name } : {}),
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    indexStep,
  };
}
