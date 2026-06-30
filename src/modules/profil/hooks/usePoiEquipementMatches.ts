import type { Poi } from "@communecter/cocolight-api-client";
import { useSearchQuery } from "@/modules/search/hooks/useSearchQuery";
import { useDebounce } from "@/hooks/useDebounce";
import type { PoiEquipementScope } from "../forms/costum/equipements-sportifs/fns";

/**
 * Projection de la recherche de DOUBLONS : champs ramenés pour CHAQUE équipement existant trouvé
 * (panneau doublons + aperçu détail PoiDetailSSBE/CardPoiSSBE, sans re-fetch). C'est une projection de
 * RECHERCHE — distincte des champs du FORMULAIRE (qui vivent dans le descripteur). Inclut donc des champs
 * non-form (enqueteStatut, parent, profil*ImageUrl, geo) nécessaires à l'affichage des résultats.
 */
const POI_DETAIL_FIELDS = [
  "name", "equip_type_name", "equip_type_famille", "categorie", "enqueteStatut",
  "equip_nature", "equip_sol", "equip_surf", "equip_larg", "equip_long", "aps_name",
  "inst_nom", "equip_prop_nom", "equip_prop_type", "equip_gest_type",
  "inst_acc_handi_bool", "inst_acc_handi_type", "equip_pmr_acc", "equip_pmr_chem",
  "equip_pmr_douche", "equip_pmr_sanit", "equip_pmr_trib", "equip_pmr_vest",
  "equip_pshs_aire", "equip_pshs_chem", "equip_pshs_sanit", "equip_pshs_trib",
  "equip_pshs_vest", "equip_pshs_sign", "equip_acc_libre", "inst_trans_bool",
  "inst_trans_type", "equip_eclair", "equip_douche", "inst_part_bool", "inst_part_type",
  "equip_loc_type", "equip_utilisateur", "inst_date_creation", "inst_enqu_date",
  "equip_maj_date", "address", "geo", "geoPosition", "parent",
  "profilImageUrl", "profileImageUrl", "profilMediumImageUrl", "profilThumbImageUrl", "image",
] as const;

/** Vrai si la valeur est une chaîne non vide (trim) ou tout autre truthy. */
function isFilled(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 : !!value;
}

/** Filtres de la recherche d'équipements existants à une adresse (code postal + type, scopés au costum). */
function buildPoiMatchFilters(
  scope: PoiEquipementScope,
  params: { postalCode: string; equipTypeName: string; streetAddress?: string }
): Record<string, unknown> {
  const filters: Record<string, unknown> = {
    "address.postalCode": params.postalCode,
    equip_type_name: params.equipTypeName,
    $or: {
      "source.key": scope.sourceKey,
      "source.keys": scope.sourceKey,
      [`parent.${scope.parentId}`]: { $exists: true },
    },
    type: scope.poiType,
  };
  if (params.streetAddress && params.streetAddress.trim().length > 0) {
    filters["address.streetAddress"] = params.streetAddress;
  }
  return filters;
}

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
