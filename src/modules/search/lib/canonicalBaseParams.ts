/**
 * Source unique de la forme canonique des `baseParams` envoyés à `useSearchQuery`
 * (et indirectement à la queryKey React Query). Utilisé par :
 *  - `SearchProStatic` côté client (avec les `filters`/`locality` dynamiques)
 *  - `buildRoutes` côté SSR (avec valeurs vides au prefetch initial)
 *
 * Sans ce helper, SSR et client construiraient `baseParams` différemment :
 * le client ajouterait toujours `defaultFilters: {}` et `locality: {}` (issus
 * du merge dynamique), tandis que le SSR enverrait `baseParams` brut. La
 * queryKey sérialisant `JSON.stringify(baseParams)`, la moindre différence
 * de clés casse le cache hit post-hydratation et provoque un refetch.
 */
export interface CanonicalBaseParamsInput {
  defaultFilters?: Record<string, unknown>;
  [key: string]: unknown;
}

export function canonicalSearchProStaticBaseParams(
  raw: CanonicalBaseParamsInput,
  filters: Record<string, unknown> = {},
  locality: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    ...raw,
    defaultFilters: {
      ...(raw.defaultFilters ?? {}),
      ...filters,
    },
    locality,
  };
}
