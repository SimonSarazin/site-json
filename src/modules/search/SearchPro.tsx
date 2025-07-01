import { ClipboardList, Loader2, Map, X } from "lucide-react";
import React, { useState, useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import ActiveFiltersBar from "./components/ActiveFiltersBar";
import SearchFilters from "./components/SearchFilters";
import SearchListView from "./components/SearchListView";
import SearchMapWrapper from "./components/SearchMapWrapper";

import { useCocolight } from "@/hooks/useCocolight";
import { useInfiniteQueryScrollNext } from "@/hooks/useInfiniteQueryScroll";
import useSearchFilters from "@/modules/search/hooks/useSearchFilters";
import { ClientOnly } from "@/components/layout/ClientOnly";
import { type SearchProProps } from "./types";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import "@/modules/search/i18n"; 
import "@/modules/search/styles.css";


/**
 * Full‑featured search section driven entirely by props.
 * Keeps organisation.searchCostum + infinite scrolling logic.
 */
const SearchPro: React.FC<{ props: SearchProProps }> = ({ props }) => {
  /* ------------------------------------------------------------------ */
  /* i18n + Cocolight context                                            */
  /* ------------------------------------------------------------------ */
  const { loaded } = useLoadNamespace("modules/search");
  const t = useT("modules/search");  
  const { organization, helper } = useCocolight();

  /* ------------------------------------------------------------------ */
  /* Destructure props with sensible defaults                            */
  /* ------------------------------------------------------------------ */
  const {
    placeholder,
    useFilter = true,
    showMap = false,
    filters = {},
    baseParams = {},
  } = props;

  /* ------------------------------------------------------------------ */
  /* UI state                                                            */
  /* ------------------------------------------------------------------ */
  const [showFiltersModal, setShowFiltersModal] = useState(false);

  /* ------------------------------------------------------------------ */
  /* Search filters hook : manages q / tags / type / map                 */
  /* ------------------------------------------------------------------ */
  const {
    q: searchText,
    setQ: setSearchText,
    tags: searchTags,
    setTags: setSearchTags,
    type: searchType,
    map: mapUsed,
    setMap: setMapUsed,
  } = useSearchFilters({
    type:
      useFilter && filters?.types
        ? Array.isArray(filters.types)
          ? filters.types.filter(Boolean)
          : [filters.types]
        : null,
    map: !!showMap,
  });

  /* ------------------------------------------------------------------ */
  /* Infinite query using Communecter searchCostum                       */
  /* ------------------------------------------------------------------ */
  const {
    data,
    error,
    lastItemRef,
    isFetchingNextPage,
    isLoading: loadingMap,
    refetch,
  } = useInfiniteQueryScrollNext<unknown, Error>({
    queryKey: [
      "searchCostum",
      searchText,
      searchTags,
      searchType && Array.isArray(searchType) ? searchType : [searchType],
      mapUsed,
      baseParams,
    ],
    queryFn: async ({ pageParam } = { pageParam: undefined }) => {
      const tags = Object.values(searchTags).flat();
      const {
        fediverse = false,
        indexStepList = 10,
        indexStepMap = 0,
        defaultTypes,
        defaultTags,
      } = baseParams;

      const param: Record<string, any> = {
        name: searchText,
        fediverse,
        ...(mapUsed
          ? { mapUsed: true, indexMin: 0, indexStep: indexStepMap }
          : { indexMin: 0, indexStep: indexStepList }),
        ...(tags.length > 0 && {
          searchTags: tags,
          options: { tags: { verb: "$all" } },
        }),
      };

      // merge explicit type filter or defaults
      if (searchType && searchType.length > 0) param.searchType = searchType;
      if (!searchType && defaultTypes) param.searchType = defaultTypes;
      if (defaultTags && defaultTags.length > 0) {
        param.defaultTags = defaultTags;
      }

      try {
        const result = await organization.searchCostum(param);
        // pagination
        if (pageParam?.pageNumber > 1 && typeof pageParam?.next !== "function") {
          return result.next();
        }
        return result;
      } catch (err) {
        console.error("Error fetching search results:", err);
        throw err;
      }
    },
    options: {
      enabled: !!organization,
      staleTime: 60 * 1000,
      initialPageParam: []
    },
  });

  /* ------------------------------------------------------------------ */
  /* Transform raw JSON entities into Cocolight entities if needed        */
  /* ------------------------------------------------------------------ */

  const transformedResults = useMemo(() => {
      const results = data?.pages?.flatMap((p: any) => p?.results) ?? [];
    if (!organization || !results.length) return results || [];
    return results.flatMap((d: any) => {
      if (d?.getEntityType) return d;
      return helper.fromEntityJSON(d, organization);
    });
  }, [data, organization, helper]);

  /* ------------------------------------------------------------------ */
  /* Helper counts                                                       */
  /* ------------------------------------------------------------------ */
  const filtersActiveCount = Object.values(searchTags).reduce<number>(
    (total, arr) => total + (Array.isArray(arr) ? arr.length : 0),
    0,
  );

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */

  console.log("Loaded namespace:", loaded);

if (!loaded) {
  return (
    <div className="flex-1 flex items-center justify-center py-10 text-muted-foreground">
      <Loader2 className="animate-spin h-6 w-6 mr-2" />
      Loading…
    </div>
  );
}

  return (
    <div className="pageContent flex flex-col h-screen" data-co="page-search">
      {/* Error banner */}
      {error && (
        <div className="p-4 bg-red-100 text-red-800 border border-red-300 rounded mb-4">
          <p>❌ Une erreur est survenue lors du chargement des résultats.</p>
          <pre className="mt-2 text-sm whitespace-pre-wrap break-words">
            {error instanceof Error ? error.message : String(error)}
          </pre>
          <button
            onClick={() => refetch()}
            className="mt-2 px-3 py-1 text-sm bg-red-50 border border-red-400 text-red-700 rounded hover:bg-red-200"
          >
            Réessayer
          </button>
        </div>
      )}

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Mobile filters bar */}
        <div className="sm:hidden p-2 flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setShowFiltersModal(true)} className="relative bg-muted">
            <svg className="w-5 h-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 5h14M5 10h10M7 15h6" stroke="currentColor" strokeWidth="2" />
            </svg>
            {filtersActiveCount > 0 && (
              <Badge className="absolute -top-1 -right-1 text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {filtersActiveCount}
              </Badge>
            )}
          </Button>

          <SearchFilters
            minimal
            placeholder={placeholder}
            filters={filters}
            searchText={searchText}
            searchTags={searchTags}
            onTextChange={setSearchText}
            onTagChange={setSearchTags}
          />
        </div>

        {/* Desktop filters */}
        {!showFiltersModal && useFilter && (
          <div className="hidden sm:block p-4 space-y-4">
            <SearchFilters
              placeholder={placeholder}
              filters={filters}
              searchText={searchText}
              searchTags={searchTags}
              onTextChange={setSearchText}
              onTagChange={setSearchTags}
            />
            <ActiveFiltersBar
              filters={searchTags}
              onRemove={(key, value) => {
                setSearchTags((prev: any) => ({
                  ...prev,
                  [key]: prev[key].filter((v: string) => v !== value),
                }));
              }}
            />
          </div>
        )}

        {/* Map or list */}
        {mapUsed ? (
          <div className="relative flex-1 overflow-hidden">
            {loadingMap && (
              <div className="absolute inset-0 z-10 bg-background/80 flex flex-col items-center justify-center">
                <Loader2 className="animate-spin h-10 w-10 text-primary-foreground" />
                <p className="text-sm text-secondary-foreground mt-2">{t("Chargement de la carte…")}</p>
              </div>
            )}

            <Button
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2 z-[50]"
              onClick={() => setMapUsed(false)}
              title="Voir en liste"
            >
              <ClipboardList className="h-5 w-5 text-primary" />
            </Button>

            {Array.isArray(transformedResults) && transformedResults.length > 0 && (
              <ClientOnly
                fallback={
                  <div className="absolute inset-0 z-10 bg-white/80 flex flex-col items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
                    <p className="text-sm text-secondary-foreground mt-2">{t("Chargement de la carte…")}</p>
                  </div>
                }
              >
                {() => <SearchMapWrapper results={transformedResults} />}
              </ClientOnly>
            )}
          </div>
        ) : (
          <div className="p-4 overflow-y-auto">
            <div className="flex justify-end mb-4">
              <Button variant="outline" size="sm" onClick={() => setMapUsed(true)} className="flex items-center">
                <Map className="mr-2 h-4 w-4 text-primary" /> Carte
              </Button>
            </div>

            {loadingMap && (
              <div className="flex justify-center text-secondary-foreground py-8">{t("Chargement…")}</div>
            )}

            {!loadingMap && transformedResults.length === 0 && (
              <div className="text-center text-secondary-foreground py-8">{t("Aucun résultat trouvé.")}</div>
            )}

            <SearchListView results={transformedResults} />

            <div ref={lastItemRef} className="h-12" />

            {isFetchingNextPage && (
              <div className="flex justify-center py-4 text-secondary-foreground">{t("Chargement plus de résultats…")}</div>
            )}
          </div>
        )}
      </div>

      {/* Mobile filters modal */}
      {showFiltersModal && (
        <div className="fixed inset-0 z-[50] bg-background flex flex-col sm:items-center sm:justify-center">
          <div className="flex justify-between items-center p-4 border-b">
            <h2 className="text-lg font-semibold">Filtres</h2>
            <Button variant="ghost" size="icon" onClick={() => setShowFiltersModal(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
            <SearchFilters
              placeholder={placeholder}
              filters={filters}
              searchText={searchText}
              searchTags={searchTags}
              onTextChange={setSearchText}
              onTagChange={setSearchTags}
            />
            <ActiveFiltersBar
              filters={searchTags}
              onRemove={(key, value) => {
                setSearchTags((prev: any) => ({
                  ...prev,
                  [key]: prev[key].filter((v: string) => v !== value),
                }));
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchPro;
