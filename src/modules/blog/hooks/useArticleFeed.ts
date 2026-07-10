import { useMemo } from "react";
import { useSearchQuery } from "@/modules/search/hooks/useSearchQuery";
import { usePageFiltersOptional } from "@/modules/search/contexts/pageFilters";
import { searchByFieldsToQuery } from "@/modules/search/lib/searchByFieldsToQuery";
import { BLOG_QUERY_KEYS } from "../constants/queryKeys";

/**
 * Fil d'articles d'un costum (POI type=article, scope source.key) — paginé, trié par date décroissante.
 * Réutilise `useSearchQuery` (searchCostum) : searchType poi + defaultFilters type=article + scope costum.
 *
 * **Piloté par le `PageFilters` partagé de la page** (exactement comme `SearchProStatic`) : un `heroSearch`
 * ou un `searchHeader` de la MÊME page écrit le texte + les filtres → le fil re-requête automatiquement
 * (la queryKey de useSearchQuery inclut searchText/searchTags/baseParams). Le filtrage est donc
 * CONFIG-DRIVEN et agnostique au champ :
 *  - filtres SANS `field` (types/tags) → `searchTags` ($all) ;
 *  - filtres AVEC `field` (ex. un champ `list` ajouté au costum form article) → `{ <field>: { $in } }`
 *    fusionné dans `defaultFilters` (via `searchByFieldsToQuery`, comme la liste search).
 * Hors provider PageFilters, tout est vide → fil de base (comportement P0).
 */
export interface UseArticleFeedParams {
  costumSlug: string;
  pageSize?: number;
  filters?: Record<string, unknown>;
}

export function useArticleFeed({ costumSlug, pageSize = 12, filters }: UseArticleFeedParams) {
  const cf = usePageFiltersOptional();
  const searchText = cf?.searchQuery ?? "";
  const filterNames = cf?.filterNames;
  const searchByFields = cf?.searchByFields;

  // Filtres sans `field` (types/tags cochés) → searchTags ($all). Clé canonique `tags` (comme
  // SearchProStatic) — buildSearchPayload aplatit de toute façon les valeurs, mais on garde la convention.
  const searchTags = useMemo(
    () => (filterNames && filterNames.length ? { tags: [...filterNames] } : {}),
    [filterNames],
  );
  // Filtres avec `field` (ex. champ `list` du costum) → filtres Mongo `{ field: { $in } }`
  // (locality/sourceKeys ignorés : le fil est scopé au costum, pas de scopeList — cf. doc §14).
  const fieldFilters = useMemo(
    () => searchByFieldsToQuery(searchByFields ?? {}).filters,
    [searchByFields],
  );

  return useSearchQuery({
    queryKeyPrefix: BLOG_QUERY_KEYS.FEED_PREFIX(costumSlug),
    searchText,
    searchTags,
    // ⚠ searchType explicite obligatoire (buildSearchPayload n'applique defaultTypes que si type===undefined).
    searchType: { type: ["poi"] },
    mapUsed: false,
    baseParams: {
      indexStepList: pageSize,
      // fieldFilters fusionnés comme `canonicalSearchProStaticBaseParams` (dans defaultFilters).
      // NB : le masquage des articles EN ATTENTE de validation (double flag toBeValidated) est posé
      // AUTOMATIQUEMENT par buildSearchPayload (applyValidationGate) dès qu'un costumSlug est présent.
      // Cf docs/module-articles-blog.md §16.
      // `type: "article"` en DERNIER = garantie d'immuabilité (un filtre field:"type" ne peut pas l'écraser).
      defaultFilters: { ...(filters ?? {}), ...fieldFilters, type: "article" },
      defaultSortBy: { created: -1 },
      // scope costum : lus par buildSearchPayload via cast (présents en config, hors type strict).
      costumSlug,
      sourceKey: [costumSlug],
    } as never,
  });
}
