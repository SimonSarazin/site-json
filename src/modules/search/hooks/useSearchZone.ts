import { useQuery, type QueryKey } from "@tanstack/react-query";
import type { SearchZonesData, ZoneItemNormalized } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";

export interface SearchZoneOptions {
  countryCode: string[];
  level: string[];
  upperLevelId?: string;
  sortBy?: string;
}

interface SearchZoneResult {
  data: ZoneItemNormalized[];
  isLoading: boolean;
  error: Error | null;
}

// Référence stable pour le cas "pas encore chargé / disabled" — éviter une
// nouvelle référence à chaque render qui ferait re-fire les useEffect côté caller.
const EMPTY_ZONES: ZoneItemNormalized[] = [];

/**
 * Interface minimale attendue par fetchSearchZones — duck-typing pour accepter
 * indifféremment une `Organization`, un `Project`, ou tout autre porteur de
 * `searchZone` (ex: l'`entity` retournée par `initApi` côté SSR).
 */
interface SearchZoneEntity {
  searchZone(options: SearchZonesData): Promise<ZoneItemNormalized[]>;
}

/**
 * QueryKey partagée hook + prefetch SSR. Sérialise `options` pour stabilité.
 */
export function searchZoneQueryKey(
  query: string,
  options: SearchZoneOptions
): QueryKey {
  return ["search-zone", query, JSON.stringify(options)] as const;
}

/**
 * Fetcher partagé hook + prefetch SSR.
 */
export async function fetchSearchZones(
  entity: SearchZoneEntity,
  options: SearchZoneOptions
): Promise<ZoneItemNormalized[]> {
  return entity.searchZone(options as SearchZonesData);
}

/**
 * Charge la liste des zones (pays/régions/villes…) pour un ensemble de
 * `countryCode` + `level`. Mise en cache via React Query.
 */
export function useSearchZoneQuery(
  query: string,
  options: SearchZoneOptions
): SearchZoneResult {
  const { entity } = useCocolight();

  const result = useQuery<ZoneItemNormalized[], Error>({
    queryKey: searchZoneQueryKey(query, options),
    queryFn: () => {
      if (!entity) throw new Error("API non initialisée - entity manquante");
      return fetchSearchZones(entity as unknown as SearchZoneEntity, options);
    },
    enabled: !!entity && options.countryCode.length > 0 && options.level.length > 0,
    staleTime: 30 * 60 * 1000,
  });

  return {
    data: result.data ?? EMPTY_ZONES,
    isLoading: result.isLoading,
    error: result.error ?? null,
  };
}
