import type { Poi } from "@communecter/cocolight-api-client";
import { useSearchQuery } from "@/modules/search/hooks/useSearchQuery";
import { useDebounce } from "@/hooks/useDebounce";
import {
  POI_DETAIL_FIELDS,
  buildPoiMatchFilters,
  isFilled,
  type PoiEquipementScope,
} from "../forms/costum/poiEquipement/fns";

interface PoiMatchesParams {
  postalCode: string;
  equipTypeName: string;
  streetAddress: string;
  scope: PoiEquipementScope;
}

/**
 * Recherche les équipements existants à la même adresse (code postal + type)
 * via le hook canonique `useSearchQuery` (React Query + parité SSR + cache).
 * Les résultats (`transformedResults`) sont **déjà** des entités `Poi` typées et
 * revifiées par le hook — aucun `fromEntityJSON` ni accès brut. La recherche
 * n'est déclenchée que lorsque code postal + type sont renseignés
 * (`searchType: null` sinon → `useSearchQuery` court-circuite sans appel réseau).
 */
export function usePoiEquipementMatches({
  postalCode,
  equipTypeName,
  streetAddress,
  scope,
}: PoiMatchesParams) {
  const dPostal = useDebounce(postalCode, 400);
  const dEquip = useDebounce(equipTypeName, 400);
  const dStreet = useDebounce(streetAddress, 400);
  const filled = isFilled(dPostal) && isFilled(dEquip);

  const { transformedResults, isLoading, isPending, error } = useSearchQuery({
    queryKeyPrefix: "poi-equipement-matches",
    searchText: "",
    searchTags: {},
    searchType: filled ? { type: ["poi"] } : null,
    mapUsed: false,
    baseParams: {
      defaultFields: [...POI_DETAIL_FIELDS],
      defaultFilters: buildPoiMatchFilters(scope, {
        postalCode: dPostal,
        equipTypeName: dEquip,
        streetAddress: dStreet,
      }),
      notSourceKey: true,
      indexStepList: 50,
    },
  });

  return {
    // On a cherché `searchType: ["poi"]` → les résultats sont des `Poi`.
    matches: (filled ? transformedResults : []) as Poi[],
    isLoading: filled && (isLoading || isPending),
    isError: Boolean(error),
    isSearched: filled,
  };
}
