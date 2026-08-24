import { useMemo } from "react";
import { useCocolight } from "@/hooks/useCocolight";
import { useInfiniteQueryScrollNextWithTransform } from "@/hooks/useInfiniteQueryScroll";
import { SearchType } from "../schema";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import type { PaginatorPage } from "@communecter/cocolight-api-client";
import { SEARCH_QUERY_KEYS } from "../constants/queryKeys";
import { buildSearchPayload } from "../lib/buildSearchPayload";
import { expandCostumSubType } from "../lib/costumSubType";
import { useContext } from "react";
import { SiteContext } from "@/contexts/SiteContext";

export interface UseSearchQueryParams {
  queryKeyPrefix: string;
  searchText: string;
  searchTags: Record<string, string[]>;
  searchType: Record<string, string[]> | null;
  mapUsed: boolean;
  graphUsed?: boolean;
  /**
   * Variant SDK pour `searchCostum`. Cf. `SearchVariantSchema`. Si absent ou
   * `"default"`, on appelle `searchCostum(payload)` sans le 2e argument
   * (comportement préservé). Sinon on passe `{ variant }` → endpoint alternatif.
   * `admin` requiert le SDK ≥ 1.0.161 (endpoint globalautocompleteadmin).
   */
  variant?: "default" | "navigator-tl" | "admin";
  /** Overrides du cache React Query (ex. dashboards « charger tout » : un
   *  staleTime long évite de re-chaîner toutes les pages au retour). */
  cache?: { staleTime?: number; gcTime?: number };
  /** Désactive la requête (défaut `true`) — pour les requêtes CONDITIONNELLES à une prop de
   *  config (ex. l'épinglée d'`articleFeed` en mode `featured:"flag"`). Composé avec le
   *  `!!entity` interne : `enabled: false` ne fetch JAMAIS, sans violer les règles des hooks. */
  enabled?: boolean;
  baseParams?: {
    fediverse?: boolean;
    indexStepList?: number;
    indexStepMap?: number;
    defaultTypes?: SearchType[];
    defaultTags?: string[];
    defaultFilters?: Record<string, unknown>;
    defaultFields?: string[];
    defaultSortBy?: Record<string, 1 | -1>;
    // Cf. `SearchBySchema` — "ALL" | CSV | string[]. Propagé au payload SDK
    // dès qu'il est défini ; sinon le backend applique son comportement par défaut.
    searchBy?: string | string[];
    // Sous-type de costum (clé `subType` d'un form) — expansé ICI en $or identity/annotation
    // (cf. `expandCostumSubType`), avant que le payload parte au SDK.
    costumSubType?: string;
    // Accepte `boolean` (ne pas sourcer) ou `number` (limite custom) — cf.
    // schema search.ts (config historique avec valeur numérique).
    notSourceKey?: boolean | number;
    locality?: Record<string, {
      name?: string;
      active?: boolean;
      id: string;
      countryCode?: string;
      level?: string | number;
      type: string;
      key?: string;
    }>;
  };
}

/**
 * Hook personnalisé pour gérer la requête de recherche
 * Factorise la logique de fetch entre SearchPro et SearchProStatic
 */
export function useSearchQuery({
  queryKeyPrefix,
  searchText,
  searchTags,
  searchType,
  mapUsed,
  graphUsed = false,
  variant,
  enabled,
  baseParams = {},
  cache,
}: UseSearchQueryParams) {
  const { entity, helper } = useCocolight();
  // Contexte site OPTIONNEL (les tests du hook et certains outils montent sans SiteProvider) :
  // sans lui, pas de costumForms → l'expansion est inerte et le hook se comporte comme avant.
  const siteConfig = useContext(SiteContext)?.config;

  // `costumSubType` → $or identity/annotation, résolu depuis la DÉCLARATION du form (costumForms)
  // et le slug du porteur : le discriminant vit une fois en config, jamais dupliqué dans les pages.
  // Sans la clé, les baseParams ressortent par la MÊME référence — aucune queryKey existante ne bouge.
  const baseParamsExpanses = useMemo(
    () => expandCostumSubType(
      baseParams,
      (siteConfig as { costumForms?: Record<string, never> } | undefined)?.costumForms,
      (entity as { slug?: string } | null)?.slug,
    ) ?? {},
    [baseParams, siteConfig, entity],
  );

  // Query key centralisée (single source of truth)
  const queryKey = SEARCH_QUERY_KEYS.RESULTS({
    queryKeyPrefix,
    searchText,
    searchTags,
    searchType,
    mapUsed,
    graphUsed,
    baseParams: baseParamsExpanses,
    variant,
  });

  const {
    data,
    error,
    lastItemRef,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isPending,
    refetch,
    totalCount,
    hasCount,
  } = useInfiniteQueryScrollNextWithTransform<SearchEntity>({
    queryKey,
    queryFn: async ({ pageParam }) => {
      if (!entity) {
        throw new Error("API non initialisée - entity manquante");
      }

      const type = Array.isArray(searchType)
        ? searchType
        : searchType
          ? Object.values(searchType).flat()
          : [];
      const tags = Object.values(searchTags).flat() as string[];
      const page = pageParam as PaginatorPage<SearchEntity> | undefined;

      const param = buildSearchPayload(baseParamsExpanses, {
        name: searchText,
        tags,
        type,
        mapUsed,
        graphUsed,
        // variant transmis → le filtre de validation ne s'applique jamais en mode admin.
        variant,
      });

      if (!param.searchType) {
        return { results: [], count: { total: 0 }, hasNext: false, hasPrev: false, pageNumber: 1, pageIndex: 0 };
      }

      try {
        // Passe `{ variant }` au SDK uniquement quand non-default — préserve
        // le call site existant pour les sites qui n'utilisent pas le variant.
        // Cast : le type SearchCostumVariant du SDK installé peut être en retard d'un variant
        // (« admin » exige ≥ 1.0.161) — au runtime le SDK ancien lèverait, le nouveau route.
        const result = variant && variant !== "default"
          ? await entity.searchCostum(param, { variant } as unknown as Parameters<typeof entity.searchCostum>[1])
          : await entity.searchCostum(param);
        if (
          page &&
          page?.pageNumber > 1 &&
          typeof page?.next !== "function" &&
          result.next
        ) {
          return result.next();
        }
        return result;
      } catch (error) {
        console.error("Error fetching search results:", error);
        if (error && typeof error === "object") {
        console.error("Error details:", {
          message: (error as Record<string, unknown>).message,
          validationErrors: (error as Record<string, unknown>).validationErrors,
          details: (error as Record<string, unknown>).details,
          response: (error as Record<string, unknown>).response,
          data: (error as Record<string, unknown>).data,
        });
      }
        throw error;
      }
    },
    options: {
      enabled: enabled !== false && !!entity,
      staleTime: cache?.staleTime ?? 60 * 1000,
      ...(cache?.gcTime !== undefined && { gcTime: cache.gcTime }),
      initialPageParam: undefined,
    },
    // Transformation SSR automatique via le hook
    transform: entity ? { entity, helper } : undefined,
  });

  // Les résultats sont déjà transformés par le hook
  const transformedResults = useMemo(() => {
    return data?.pages?.flatMap((p) => p?.results) ?? [];
  }, [data?.pages]);

  return {
    data,
    error,
    lastItemRef,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isPending,
    refetch,
    transformedResults,
    totalCount,
    hasCount,
  };
}
