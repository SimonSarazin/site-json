import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Organization, PaginatorPage, Project } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import { SEARCH_QUERY_KEYS } from "../constants/queryKeys";

const PAGE_SIZE = 500;

/** Porteur du `searchCostum` scopé costum : l'entité du site, ou celle d'`initApi` au SSR. */
export type PoiSearchHost = Pick<Organization | Project, "searchCostum">;

/** Périmètre d'équipements — même sémantique que `installationDashboard.poiFilters`/`sourceKey`. */
export interface PoiPerimeter {
  poiFilters: Record<string, unknown>;
  /** Costum des équipements s'ils vivent sous un AUTRE costum que le site. Absent → costum du site. */
  sourceKey?: string[];
}

/**
 * Parmi `ids`, les équipements du périmètre : `_id: {$in}` + `poiFilters`, scopé au costum du site
 * (sourceKey injecté par le SDK) sauf `sourceKey` explicite. Résultat trié. `ids` vide → AUCUN
 * appel : le backend ignore un `$in` vide et renverrait tout le périmètre.
 */
export async function fetchResourceIdsInPerimeter(
  entity: PoiSearchHost,
  ids: readonly string[],
  perimeter: PoiPerimeter,
): Promise<string[]> {
  const sorted = [...new Set(ids)].sort();
  if (sorted.length === 0) return [];

  let page: PaginatorPage<unknown> = await entity.searchCostum({
    name: "",
    indexMin: 0,
    indexStep: Math.min(sorted.length, PAGE_SIZE),
    searchType: ["poi"],
    filters: { ...perimeter.poiFilters, _id: { $in: sorted } },
    // ⚠️ "collection" OBLIGATOIRE : sans lui, _linkEntities élimine
    // silencieusement tous les résultats (piège SDK vérifié).
    fields: ["collection"],
    ...(perimeter.sourceKey ? { sourceKey: perimeter.sourceKey } : {}),
  });

  const found = new Set<string>();
  const collect = (p: PaginatorPage<unknown>) => {
    for (const r of p.results) {
      const id = (r as { id?: unknown }).id;
      if (typeof id === "string") found.add(id);
    }
  };
  collect(page);
  while (page.hasNext && typeof page.next === "function") {
    page = await page.next();
    collect(page);
  }
  return sorted.filter((id) => found.has(id));
}

/**
 * Parmi `ids`, les équipements du périmètre (`preview.bookedResources.poiFilters`). Sans périmètre
 * → `null` (rien à restreindre) et aucun appel.
 *
 * Le composant consommateur n'est monté qu'à l'ouverture de la fiche → la query ne part qu'à ce
 * moment-là (pas de prefetch SSR), comme `useOrgaReservationsQuery`.
 */
export function useResourcesInPerimeterQuery(ids: readonly string[], perimeter: Partial<PoiPerimeter> | undefined) {
  const { entity } = useCocolight();
  const poiFilters = perimeter?.poiFilters;
  const sourceKey = perimeter?.sourceKey;
  const sortedIds = useMemo(() => [...new Set(ids)].sort(), [ids]);

  const query = useQuery<string[]>({
    queryKey: SEARCH_QUERY_KEYS.RESOURCES_IN_PERIMETER(sortedIds, { poiFilters, sourceKey }),
    enabled: Boolean(entity && poiFilters && sortedIds.length > 0),
    staleTime: 5 * 60 * 1000,
    queryFn: () => {
      if (!entity || !poiFilters) return [];
      return fetchResourceIdsInPerimeter(entity, sortedIds, { poiFilters, sourceKey });
    },
  });

  return {
    /** Identifiants retenus ; `null` = pas de périmètre configuré. VIDE tant que la réponse n'est
     *  pas là : jamais un instant « tout », qui afficherait les équipements hors site. */
    allowed: poiFilters ? (query.data ?? []) : null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
