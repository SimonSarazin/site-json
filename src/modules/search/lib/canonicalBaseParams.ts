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
import { mergeMongoFilters } from "./mongoFilters";

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
    // Fusion et non spread : `$or` est une clé unique revendiquée à la fois par le
    // périmètre déclaré en config et par les facettes sur answers — un spread ferait
    // gagner le dernier et détruirait l'autre en silence (cf. mongoFilters.ts).
    defaultFilters: mergeMongoFilters(raw.defaultFilters ?? {}, filters),
    locality,
  };
}
