import { useQuery, type QueryKey } from "@tanstack/react-query";
import type {
  GlobalAutocompleteCostumData,
  PaginatorPage,
} from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import type { SearchBaseParams } from "../schema";

/**
 * Option de filtre dérivée d'une entité backend (réseau régional, etc.).
 * `value` = champ désigné par `filterBy` (slug par défaut) → valeur injectée
 * dans le filtre (cf. filterType "sourceKey"). `name` = libellé affiché.
 */
export interface FilterEntity {
  name: string;
  value: string;
}

/** Options = sous-ensemble du baseParams des sections search (réutilisé). */
export type FilterEntitiesOptions = SearchBaseParams;

// Référence stable pour le cas "pas chargé / disabled".
const EMPTY_ENTITIES: FilterEntity[] = [];

/**
 * Interface minimale (duck-typing) : tout porteur de `searchCostum`
 * (Organization, Project, ou l'`entity` de `initApi` côté SSR).
 */
interface SearchCostumEntity {
  searchCostum(
    data?: Partial<GlobalAutocompleteCostumData>,
  ): Promise<PaginatorPage<unknown>>;
}

/** QueryKey partagée hook + prefetch SSR. */
export function filterEntitiesQueryKey(
  query: string,
  options: FilterEntitiesOptions,
): QueryKey {
  return ["filter-entities", query, JSON.stringify(options)] as const;
}

/** Construit le payload searchCostum depuis les baseParams du groupe. */
function buildSearchParams(
  options: FilterEntitiesOptions,
): Partial<GlobalAutocompleteCostumData> {
  return {
    name: "",
    indexMin: 0,
    indexStep: options.indexStepList ?? 200,
    fediverse: options.fediverse ?? false,
    ...(options.defaultTypes
      ? { searchType: options.defaultTypes as GlobalAutocompleteCostumData["searchType"] }
      : {}),
    ...(options.defaultFilters && Object.keys(options.defaultFilters).length > 0
      ? { filters: options.defaultFilters }
      : {}),
    ...(options.defaultFields ? { fields: options.defaultFields } : {}),
    ...(options.defaultSortBy ? { sortBy: options.defaultSortBy } : {}),
    ...(options.contextId ? { contextId: options.contextId } : {}),
    ...(options.contextType
      ? { contextType: options.contextType as GlobalAutocompleteCostumData["contextType"] }
      : {}),
    ...(options.costumSlug ? { costumSlug: options.costumSlug } : {}),
    ...(options.notSourceKey ? { notSourceKey: true } : {}),
  } as Partial<GlobalAutocompleteCostumData>;
}

/**
 * Fetcher partagé hook + prefetch SSR. Les résultats de `searchCostum` sont
 * des documents bruts (non transformés en instances) → champs à plat.
 */
export async function fetchFilterEntities(
  entity: SearchCostumEntity,
  options: FilterEntitiesOptions,
  filterBy = "slug",
): Promise<FilterEntity[]> {
  const page = await entity.searchCostum(buildSearchParams(options));
  const results = (page?.results ?? []) as Array<Record<string, unknown>>;
  return results
    .map((r) => {
      const sd = (r.serverData ?? r) as Record<string, unknown>;
      return {
        name: String(sd.name ?? ""),
        value: String(sd[filterBy] ?? ""),
      };
    })
    .filter((e) => e.value && e.name);
}

/**
 * Charge une liste d'entités pour peupler un groupe de filtre `entityList`
 * (réseaux régionaux…). Mise en cache React Query, même queryKey que le
 * prefetch SSR `prefetchFilterEntities`.
 */
export function useFilterEntitiesQuery(
  query: string,
  options: FilterEntitiesOptions,
  filterBy = "slug",
) {
  const { entity } = useCocolight();

  const result = useQuery<FilterEntity[], Error>({
    queryKey: filterEntitiesQueryKey(query, options),
    queryFn: () => {
      if (!entity) throw new Error("API non initialisée - entity manquante");
      return fetchFilterEntities(entity as unknown as SearchCostumEntity, options, filterBy);
    },
    enabled: !!entity && !!options.defaultTypes?.length,
    staleTime: 30 * 60 * 1000,
  });

  return {
    data: result.data ?? EMPTY_ENTITIES,
    isLoading: result.isLoading,
    error: result.error ?? null,
  };
}
