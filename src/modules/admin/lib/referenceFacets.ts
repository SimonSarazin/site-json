import { mergeMongoFilters } from "@/modules/search/lib/mongoFilters";
import { searchByFieldsToQuery } from "@/modules/search/lib/searchByFieldsToQuery";
import type { SearchByFieldValue } from "@/modules/search/contexts/pageFilters";
import type { useSearchQuery } from "@/modules/search/hooks/useSearchQuery";

/** Forme des zones attendue par la recherche (celle que produit `searchByFieldsToQuery`). */
type Locality = NonNullable<NonNullable<Parameters<typeof useSearchQuery>[0]["baseParams"]>["locality"]>;

/** Sélection du panneau de filtres (état `PageFilters`), telle que lue par la section `reference`. */
export interface ReferenceFacetSelection {
  filterNames: string[];
  searchByFields: Record<string, SearchByFieldValue>;
}

/**
 * Ajoute la sélection du panneau aux `baseParams` d'une des recherches de la section `reference`
 * — même traduction que `SearchProStatic` (`searchByFieldsToQuery`) :
 *  - tags cochés → `searchTags` ;
 *  - facettes → `defaultFilters`, composées SOUS ceux de la section (`mergeMongoFilters`) : sur une clé
 *    commune, la section gagne, sauf un `$nin` de garde (`reference.costum`, `source.keys`) qui se
 *    compose avec le `$in` de la facette — l'exclusion du déjà-rattaché tient toujours ;
 *  - zones → `locality` ;
 *  - réseaux (`sourceKeys`) → `sourceKey`, qui remplace `notSourceKey` — SAUF `ignoreSourceKeys`
 *    (recherche de candidates : son vivier exclut la source du site, un filtre par source le contredirait).
 *
 * Sans sélection, renvoie les `baseParams` par la MÊME référence et des tags vides : la queryKey ne bouge pas.
 */
export function applyReferenceFacets<P extends { defaultFilters?: Record<string, unknown>; notSourceKey?: boolean }>(
  baseParams: P,
  selection: ReferenceFacetSelection | null,
  opts: { ignoreSourceKeys?: boolean } = {},
): { baseParams: P & { sourceKey?: string[]; locality?: Locality }; searchTags: Record<string, string[]> } {
  if (!selection) return { baseParams, searchTags: {} };
  const { filters, locality, sourceKeys } = searchByFieldsToQuery(selection.searchByFields);
  const keys = opts.ignoreSourceKeys ? [] : sourceKeys;
  const searchTags: Record<string, string[]> = selection.filterNames.length > 0 ? { tags: selection.filterNames } : {};
  if (Object.keys(filters).length === 0 && Object.keys(locality).length === 0 && keys.length === 0) {
    return { baseParams, searchTags };
  }
  const out: P & { sourceKey?: string[]; locality?: Locality } = {
    ...baseParams,
    defaultFilters: mergeMongoFilters(filters, baseParams.defaultFilters ?? {}),
  };
  if (Object.keys(locality).length > 0) out.locality = locality as Locality;
  if (keys.length > 0) {
    out.sourceKey = keys;
    delete out.notSourceKey;
  }
  return { baseParams: out, searchTags };
}

/**
 * Groupes du panneau affichés sur un sous-onglet : les réseaux (`filterType: "sourceKey"`) sont retirés
 * de « Rechercher & référencer » — `applyReferenceFacets` y ignore les sources (`ignoreSourceKeys`), un
 * filtre visible sans effet tromperait. Présents sur « Référencés » et « Sourcés ».
 * Renvoie le MÊME tableau hors recherche (référence stable pour l'effet de `FiltersSection`).
 */
export function referenceFilterGroups<G>(groups: G[], tab: "search" | "referenced" | "sourced"): G[] {
  if (tab !== "search") return groups;
  return groups.filter((g) => (g as { filterType?: string }).filterType !== "sourceKey");
}
