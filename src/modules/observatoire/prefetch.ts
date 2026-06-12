import type { SearchPrefetchParams } from "@/modules/search/prefetch";
import { OBSERVATORY_QUERY_KEYS } from "./constants/queryKeys";
import { buildObservatoryBaseParams } from "./hooks/useObservatoryItemsQuery";
import type { DataObservatorySectionProps } from "./schema";

/**
 * Params de prefetch SSR de la PREMIÈRE page d'items — consommé par le
 * loader de `buildRoutes` (même mécanique que les sections search). La
 * queryKey doit être STRICTEMENT identique à celle du client
 * (`useObservatoryItemsQuery` → `useSearchAllResults` → `useSearchQuery`) :
 * mêmes baseParams (via `buildObservatoryBaseParams`, fonction partagée —
 * projection dérivée des dimensions DÉCLARÉES), même searchType.
 *
 * Retourne `null` sans périmètre configuré (même prérequis que le hook :
 * pas de `defaultFilters` → pas de requête).
 */
export function observatoryPrefetchParams(
  props: Record<string, unknown> | undefined,
): SearchPrefetchParams | null {
  const p = props as DataObservatorySectionProps | undefined;
  if (!p?.baseParams?.defaultFilters) return null;

  const baseParams = buildObservatoryBaseParams(p.baseParams, p.dimensions ?? {});
  return {
    queryKeyPrefix: OBSERVATORY_QUERY_KEYS.ITEMS_PREFIX,
    searchText: "",
    searchTags: {},
    searchType: { type: baseParams.defaultTypes as unknown as string[] },
    mapUsed: false,
    baseParams,
  };
}
