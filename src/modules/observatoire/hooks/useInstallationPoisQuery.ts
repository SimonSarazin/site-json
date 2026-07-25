import { useMemo } from "react";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { useSearchAllResults } from "@/modules/search/hooks/useSearchAllResults";
import type { InstallationDashboardConf, SearchType } from "@/modules/search/schema";
import { OBSERVATORY_QUERY_KEYS } from "../constants/queryKeys";

/** Champs POI toujours projetés (affichage liste + jauges de la modal). */
const POI_BASE_FIELDS = ["name", "equip_type_name", "equip_numero", "address"];

/**
 * Équipements (POI) d'une installation : périmètre `conf.poiFilters` +
 * regroupement `{[conf.groupKey]: instValue}`. Scopé par défaut au `source.key`
 * du costum courant ; `conf.sourceKey` permet de viser un AUTRE costum quand les
 * équipements y vivent (ex. site saintpaulSport1 → données equipementsSportifs974).
 * Volume minuscule (une installation = quelques équipements) mais on passe
 * par `useSearchAllResults` pour la mécanique de pagination/cache standard.
 */
export function useInstallationPoisQuery(
  conf: InstallationDashboardConf | undefined,
  instValue: string | undefined,
) {
  const enabled = Boolean(conf && instValue);

  const baseParams = useMemo(
    () =>
      conf && instValue
        ? {
            defaultTypes: ["poi" as SearchType],
            defaultFields: [
              ...POI_BASE_FIELDS,
              conf.groupKey,
              conf.labelKey,
              ...(conf.extraPoiFields ?? []),
            ],
            // Périmètre config + regroupement — aucun défaut métier en dur.
            defaultFilters: { ...conf.poiFilters, [conf.groupKey]: instValue },
            // Scope source (cross-costum) quand la config le fournit.
            ...(conf.sourceKey ? { sourceKey: conf.sourceKey } : {}),
            indexStepList: 100,
          }
        : {},
    [conf, instValue],
  );

  const searchType = useMemo<Record<string, string[]> | null>(
    () => (enabled ? { type: ["poi"] } : null),
    [enabled],
  );

  const { results, isComplete, isLoading, error } = useSearchAllResults({
    queryKeyPrefix: OBSERVATORY_QUERY_KEYS.INSTALLATION_POIS_PREFIX,
    searchType,
    baseParams,
    maxResults: 500,
  });

  const pois = results as SearchEntity[];
  const poiIds = useMemo(
    () =>
      pois
        .map((p) => (p as { id?: string }).id)
        .filter((id): id is string => Boolean(id)),
    [pois],
  );

  return {
    /** Entités SDK (document dans `serverData`). */
    pois,
    poiIds,
    isLoading: enabled && (isLoading || !isComplete),
    error,
  };
}
