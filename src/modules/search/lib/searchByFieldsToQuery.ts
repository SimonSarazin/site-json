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
/** Cible du filtre « type d'info » (groupe `searchTargets`) — cf. schema.SearchTarget. */
export interface SearchTargetQuery {
  defaultTypes?: string[];
  defaultFilters?: Record<string, unknown>;
}

export function searchByFieldsToQuery(
  searchByFields: Record<string, SearchByFieldValue> = {},
): {
  /** `$in` (tags/valeurs) et opérateurs date (`$gt`/`$lte`) — envoyés tels quels au backend. */
  filters: Record<string, Record<string, unknown>>;
  locality: Record<string, unknown>;
  sourceKeys: string[];
  /** Sélection unique (radio) — appliquée par SearchProStatic : remplace
   *  `defaultTypes` et fusionne `defaultFilters` de la section. */
  searchTarget: SearchTargetQuery | null;
} {
  const filters: Record<string, Record<string, unknown>> = {};
  const locality: Record<string, unknown> = {};
  const sourceKeys: string[] = [];
  let searchTarget: SearchTargetQuery | null = null;

  for (const { field, type, value } of Object.values(searchByFields)) {
    if (type === "scopeList") {
      if (!locality[field]) locality[field] = value;
      continue;
    }
    if (type === "sourceKey") {
      if (Array.isArray(value)) sourceKeys.push(...value);
      continue;
    }
    if (type === "searchTarget") {
      // Pas un filtre Mongo : porté séparément (defaultTypes/defaultFilters).
      // Radio côté toggle → au plus une entrée de ce type dans searchByFields.
      if (value && !Array.isArray(value)) searchTarget = value as SearchTargetQuery;
      continue;
    }
    if (type === "dateRange") {
      // SEUL `$gt` est converti en date par le backend (SearchNew::getQueries) ;
      // `end` n'est émis que si présent (rendu conditionné à `withEnd`, cf.
      // schema.ts — $lte en attente du support backend, demande Aboire).
      const range = (value ?? {}) as { start?: string; end?: string };
      const dateOps: Record<string, string> = {};
      if (range.start) dateOps.$gt = range.start;
      if (range.end) dateOps.$lte = range.end;
      if (Object.keys(dateOps).length > 0) {
        filters[field] = { ...(filters[field] ?? {}), ...dateOps };
      }
      continue;
    }
    if (Array.isArray(value) && value.length > 0) {
      if (!filters[field]) {
        filters[field] = { $in: value };
      } else {
        const existing = (filters[field].$in as string[] | undefined) ?? [];
        filters[field].$in = Array.from(new Set([...existing, ...value]));
      }
    }
  }

  return { filters, locality, sourceKeys, searchTarget };
}
