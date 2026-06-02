import type { SearchByFieldValue } from "../contexts/pageFilters";

/**
 * Traduit le `searchByFields` du `PageFilters` (filtres dynamiques : answers
 * form-based, scopeList, sourceKey) en les 3 morceaux de requête consommés par
 * `searchCostum` :
 *  - `filters`   : filtres MongoDB `{ field: { $in: [...] } }` (services form-based, etc.)
 *  - `locality`  : zones (`scopeList`)
 *  - `sourceKeys`: clés natives SDK (`entityList` → réseaux régionaux)
 *
 * Source unique réutilisée par `SearchProStatic` (liste) **et** `useAutocomplete`
 * (suggestions du hero) → mêmes filtres dynamiques des deux côtés.
 */
export function searchByFieldsToQuery(
  searchByFields: Record<string, SearchByFieldValue> = {},
): {
  filters: Record<string, Record<string, string[]>>;
  locality: Record<string, unknown>;
  sourceKeys: string[];
} {
  const filters: Record<string, Record<string, string[]>> = {};
  const locality: Record<string, unknown> = {};
  const sourceKeys: string[] = [];

  for (const { field, type, value } of Object.values(searchByFields)) {
    if (type === "scopeList") {
      if (!locality[field]) locality[field] = value;
      continue;
    }
    if (type === "sourceKey") {
      if (Array.isArray(value)) sourceKeys.push(...value);
      continue;
    }
    if (Array.isArray(value) && value.length > 0) {
      if (!filters[field]) {
        filters[field] = { $in: value };
      } else {
        filters[field].$in = Array.from(new Set([...filters[field].$in, ...value]));
      }
    }
  }

  return { filters, locality, sourceKeys };
}
