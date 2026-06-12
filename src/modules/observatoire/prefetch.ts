import type { SearchPrefetchParams } from "@/modules/search/prefetch";
import { OBSERVATORY_QUERY_KEYS } from "./constants/queryKeys";
import {
  buildObservatoryBaseParams,
} from "./hooks/useObservatoryEquipmentsQuery";
import type { EquipmentObservatorySectionProps } from "./schema";

/**
 * Params de prefetch SSR de la PREMIÈRE page d'équipements — consommé par le
 * loader de `buildRoutes` (même mécanique que les sections search). La
 * queryKey doit être STRICTEMENT identique à celle du client
 * (`useObservatoryEquipmentsQuery` → `useSearchAllResults` → `useSearchQuery`) :
 * mêmes baseParams (via `buildObservatoryBaseParams`, fonction partagée),
 * même searchType, mêmes valeurs par défaut.
 *
 * Retourne `null` sans périmètre configuré (même prérequis que le hook :
 * pas de `defaultFilters` → pas de requête).
 */
export function observatoryPrefetchParams(
  props: Record<string, unknown> | undefined,
): SearchPrefetchParams | null {
  const baseParamsProp = props?.baseParams as
    | EquipmentObservatorySectionProps["baseParams"]
    | undefined;
  if (!baseParamsProp?.defaultFilters) return null;

  const baseParams = buildObservatoryBaseParams(baseParamsProp);
  return {
    queryKeyPrefix: OBSERVATORY_QUERY_KEYS.EQUIPMENTS_PREFIX,
    searchText: "",
    searchTags: {},
    searchType: { type: baseParams.defaultTypes as unknown as string[] },
    mapUsed: false,
    baseParams,
  };
}
