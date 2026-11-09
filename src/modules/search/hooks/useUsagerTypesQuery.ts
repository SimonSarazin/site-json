import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { SEARCH_QUERY_KEYS } from "../constants/queryKeys";
import { searchCostumEach, type PoiSearchHost } from "./useResourcesInPerimeterQuery";

/**
 * Type de la FICHE : celui du document (`serverData.type`), jamais le champ `type` de l'objet du SDK, qui
 * n'est pas celui de la base. Une fiche sans type en base reste sans type : sa réservation est « non
 * précisée » (`audienceOf`), au lieu d'être comptée club.
 */
function typeOf(result: unknown): string | undefined {
  const type = (result as { serverData?: { type?: unknown } }).serverData?.type;
  return typeof type === "string" && type ? type : undefined;
}

/**
 * Type de la FICHE de chaque organisation usagère (`GovernmentOrganization`, `NGO`…), pour classer une
 * réservation scolaire ou club quand elle ne porte pas de type d'usager (`reservations.usage.schoolOrgTypes`).
 * Recherche HORS costum (`notSourceKey`), comme l'annuaire des usagers : la reprise des plannings crée des
 * fiches qui ne sont pas forcément rattachées au costum du site. `ids` vide → AUCUN appel : le backend ignore
 * un `$in` vide et renverrait toutes les organisations.
 */
export async function fetchUsagerTypes(entity: PoiSearchHost, ids: readonly string[]): Promise<Map<string, string>> {
  const sorted = [...new Set(ids)].sort();
  const types = new Map<string, string>();
  if (sorted.length === 0) return types;

  await searchCostumEach(
    entity,
    {
      notSourceKey: true,
      searchType: ["organizations"],
      filters: { _id: { $in: sorted } },
      // "collection" OBLIGATOIRE, comme pour `searchCostumIds` : sans lui, le SDK élimine les résultats.
      fields: ["collection", "type"],
    },
    (r) => {
      const id = (r as { id?: unknown }).id;
      const type = typeOf(r);
      if (typeof id === "string" && type) types.set(id, type);
    },
  );
  return types;
}

const NO_TYPES: ReadonlyMap<string, string> = new Map();

/**
 * Types des fiches des organisations usagères `ids` — une requête en cache, partagée par l'observatoire et
 * la fiche équipement. `types` est TOUJOURS une table : vide sans identifiant (aucun appel) ou pendant le
 * chargement. Les consommateurs attendent la fin du chargement avant de classer, et ne classent pas sur
 * un échec (`failed`) : sans les types, une réservation sans type d'usager serait comptée « non précisée ».
 */
export function useUsagerTypesQuery(ids: readonly string[], enabled = true) {
  const { entity } = useCocolight();
  const sortedIds = useMemo(() => [...new Set(ids)].sort(), [ids]);
  const query = useQuery<Map<string, string>>({
    queryKey: SEARCH_QUERY_KEYS.USAGER_TYPES(sortedIds),
    enabled: Boolean(entity && enabled && sortedIds.length > 0),
    staleTime: 5 * 60 * 1000,
    queryFn: () => (entity ? fetchUsagerTypes(entity, sortedIds) : new Map()),
  });
  return {
    types: (query.data as ReadonlyMap<string, string> | undefined) ?? NO_TYPES,
    isLoading: query.isLoading,
    /** Échec SANS types lus. Un rafraîchissement qui échoue garde les types déjà lus : ce n'en est pas un. */
    failed: query.isError && query.data === undefined,
    refetch: query.refetch,
  };
}
