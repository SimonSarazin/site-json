import { useEffect, useMemo } from "react";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { useSearchQuery } from "@/modules/search/hooks/useSearchQuery";
import type { SearchType } from "@/modules/search/schema";
import type { Equipment, EquipmentObservatorySectionProps } from "../schema";
import { EquipmentSchema } from "../schema";
import { OBSERVATORY_QUERY_KEYS } from "../constants/queryKeys";

/*───────────────────────────────────────────────────────────────────────────*/
/* Params API par défaut (alignés sur /equipements-sportifs)                 */
/*───────────────────────────────────────────────────────────────────────────*/
const DEFAULT_FIELDS = [
  // Champs requis par _linkEntities (Cocolight) pour lier les entités
  "collection",
  "_id",
  "id",
  "slug",
  // Champs métier équipements sportifs
  "equip_numero",
  "equip_nom",
  "inst_nom",
  "equip_type_name",
  "equip_type_famille",
  "categorie",
  "type",
  "nature",
  "equip_nature",
  "equip_sol",
  "equip_surf",
  "equip_larg",
  "equip_long",
  "equip_eclair",
  "equip_acc_libre",
  "equip_douche",
  "aps_name",
  "inst_acc_handi_bool",
  "inst_acc_handi_type",
  "inst_trans_bool",
  "inst_trans_type",
  "equip_pmr_acc",
  "equip_pmr_chem",
  "equip_pmr_douche",
  "equip_pmr_sanit",
  "equip_pmr_vest",
  "equip_pmr_trib",
  "equip_pshs_aire",
  "equip_pshs_chem",
  "equip_pshs_sanit",
  "equip_pshs_vest",
  "equip_pshs_trib",
  "equip_pshs_sign",
  "inst_part_bool",
  "inst_part_type",
  "equip_prop_nom",
  "equip_prop_type",
  "equip_gest_type",
  "equip_loc_type",
  "equip_utilisateur",
  "inst_date_creation",
  "inst_enqu_date",
  "equip_maj_date",
  "equip_x",
  "equip_y",
  "address",
  "geo",
];

// PAS de DEFAULT_FILTERS : le périmètre des données (source.key, type…) est
// un prérequis backend qui DOIT venir de la config (baseParams.defaultFilters).
// Un fallback silencieux sur le sourceKey d'un site donné était un piège :
// une section posée sans baseParams aurait interrogé les données d'un autre
// site sans que rien ne le signale. Sans périmètre → on ne requête rien.

/*───────────────────────────────────────────────────────────────────────────*/
/* Extraction d'un Equipment à partir d'un item retourné par useSearchQuery  */
/*───────────────────────────────────────────────────────────────────────────*/
/**
 * Les résultats de `searchCostum` sont des entités SDK typées (`Poi`…) : le
 * document — champs RES inclus — vit dans `serverData` (règle maison, comme
 * toutes les cartes search). Pas de merge défensif
 * `{...entity, ...serverData, ...entity.data}` : il injectait la machinerie
 * interne du SDK (apiClient, endpointApi, _draftData…) dans chaque Equipment
 * (conservée par le `.passthrough()`), et `entity.data` est le proxy de
 * BROUILLON — spreadé en dernier, il aurait écrasé la vérité serveur.
 */
function parseEquipments(items: readonly SearchEntity[]): Equipment[] {
  const out: Equipment[] = [];
  for (const item of items) {
    const result = EquipmentSchema.safeParse(item?.serverData ?? {});
    if (result.success) {
      out.push(result.data);
    } else if (import.meta.env.DEV) {
      console.warn(
        "[observatoire] entrée ignorée (parse Zod)",
        result.error,
      );
    }
  }
  return out;
}

/*───────────────────────────────────────────────────────────────────────────*/
/* Hook                                                                       */
/*───────────────────────────────────────────────────────────────────────────*/
type BaseParamsProp = EquipmentObservatorySectionProps["baseParams"];

export function useObservatoryEquipmentsQuery(
  baseParamsProp?: BaseParamsProp,
) {
  // Prérequis : le périmètre des données vient de la config. Sans lui, la
  // query est désactivée (searchType null → useSearchQuery ne fetch pas).
  const hasPerimeter = !!baseParamsProp?.defaultFilters;
  if (import.meta.env.DEV && !hasPerimeter) {
    console.warn(
      "[observatoire] baseParams.defaultFilters absent de la config — aucune donnée ne sera chargée (périmètre source.key/type requis)",
    );
  }

  const baseParams = useMemo(
    () => ({
      notSourceKey: baseParamsProp?.notSourceKey ?? true,
      defaultTypes: (baseParamsProp?.defaultTypes as SearchType[] | undefined) ?? [
        "poi" as SearchType,
      ],
      defaultFields: baseParamsProp?.defaultFields ?? DEFAULT_FIELDS,
      defaultFilters: baseParamsProp?.defaultFilters,
      defaultSortBy: baseParamsProp?.defaultSortBy,
      indexStepList: baseParamsProp?.indexStepList ?? 500,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(baseParamsProp)],
  );

  const searchType = useMemo<Record<string, string[]> | null>(
    () => (hasPerimeter ? { type: baseParams.defaultTypes as unknown as string[] } : null),
    [hasPerimeter, baseParams.defaultTypes],
  );

  const {
    transformedResults,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useSearchQuery({
    queryKeyPrefix: OBSERVATORY_QUERY_KEYS.EQUIPMENTS_PREFIX,
    searchText: "",
    searchTags: {},
    searchType,
    mapUsed: false,
    baseParams,
  });

  // Chargement total : tant qu'il reste une page, on l'enchaîne.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isLoading) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, isLoading, fetchNextPage]);

  const equipments = useMemo(
    () => parseEquipments(transformedResults ?? []),
    [transformedResults],
  );

  const stillLoading = isLoading || hasNextPage || isFetchingNextPage;

  return { equipments, isLoading, error, stillLoading };
}
