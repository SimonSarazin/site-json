import { ClipboardList, Loader2, Map, X } from "lucide-react";
import React, { useState, useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import ActiveFiltersBar from "./components/ActiveFiltersBar";
import SearchFilters from "./components/SearchFilters";
import SearchListView from "./components/SearchListView";
import SearchListSkeleton from "./components/SearchListSkeleton";
import SearchMapWrapper from "./components/SearchMapWrapper";
import { Skeleton } from "@/components/ui/skeleton";

import { useCocolight } from "@/hooks/useCocolight";
import { useInfiniteQueryScrollNext } from "@/hooks/useInfiniteQueryScroll";
import useSearchFilters from "@/modules/search/hooks/useSearchFilters";
import { ClientOnly } from "@/components/layout/ClientOnly";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import "@/modules/search/i18n"; 
import "@/modules/search/styles.css";
import { SearchProSectionProps, TagsFilter } from "./schema";
import { SearchResultPage } from "@communecter/cocolight-api-client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


function normalizeDefaultTypes(
  filters: Record<string, TagsFilter>,
  defaultTypes: string[] | undefined,
  fallbackKey = "type"
): Record<string, string[]> | undefined {

  if (!defaultTypes || !Array.isArray(defaultTypes)) return undefined;

  const typeFilterEntry = Object.entries(filters).find(
    ([_, config]) => config.type === "type"
  );

  const key = typeFilterEntry?.[0] ?? fallbackKey;

  return {
    [key]: defaultTypes,
  };
}

/**
 * Full‑featured search section driven entirely by props.
 * Keeps organisation.searchCostum + infinite scrolling logic.
 */
const SearchPro: React.FC<{ props: SearchProSectionProps }> = ({ props }) => {
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
    title,
    description,
    placeholder,
    useFilter = true,
    showMap = false,
    enableMap = true,
    showActiveFiltersTypes = true,
    showActiveFiltersTags = true,
    filters = {},
    baseParams = {},
    list,
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
    setType: setSearchType,
    map: rawMapUsed,
    setMap: rawSetMapUsed,
  } = useSearchFilters({
    type: useFilter ? normalizeDefaultTypes(filters, baseParams?.defaultTypes) : null,
    map: !!enableMap && !!showMap,
  });


  const mapUsed = enableMap ? rawMapUsed : false;
  const setMapUsed = enableMap ? rawSetMapUsed : () => {};

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
  } = useInfiniteQueryScrollNext({
    queryKey: [
      "searchCostum",
      searchText,
      JSON.stringify(searchTags),
      JSON.stringify(searchType), 
      mapUsed,
      JSON.stringify(baseParams),
    ],
    queryFn: async ({ pageParam } = { pageParam: undefined }) => {

      if (!organization) {
        throw new Error("API non initialisée");
      }
      
      const tags = Object.values(searchTags).flat();
      const type = Array.isArray(searchType) ? searchType : Object.values(searchType).flat();
      const page = pageParam as SearchResultPage<unknown> | undefined;

      const {
        fediverse = false,
        indexStepList = 10,
        indexStepMap = 0,
        defaultTypes,
        defaultTags,
        defaultFilters,
        defaultFields,
        defaultSortBy,
        notSourceKey
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
        ...(defaultFilters && Object.keys(defaultFilters).length > 0 && {
          filters: defaultFilters,
        }),
        ...(defaultFields && defaultFields.length > 0 && {
          fields: defaultFields,
        }),
        ...(defaultSortBy && Object.keys(defaultSortBy).length > 0 && {
          sortBy: defaultSortBy,
        }),
        ...(notSourceKey ? { notSourceKey: true } : {}),
      };

      // merge explicit type filter or defaults
      if (type && type.length > 0) param.searchType = type;
      if (!type && defaultTypes) param.searchType = defaultTypes;
      if (defaultTags && defaultTags.length > 0) {
        param.defaultTags = defaultTags;
      }

      if(!param.searchType) {
        return {"results":[], "count":{}, "hasNext": false, "pageNumber": 1};
      }

      try {
        const result = await organization.searchCostum(param);
        // pagination
        if (page && page?.pageNumber > 1 && typeof page?.next !== "function") {
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


  const hasCount = data?.pages?.[0]?.count && typeof data?.pages?.[0]?.count === "object";

  const totalCount = hasCount && data?.pages?.[0]?.count?.["total"] ? data?.pages?.[0]?.count?.["total"] : undefined;

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

if (!loaded) {
  return (
    <div className="flex-1 flex items-center justify-center py-10 text-muted-foreground">
      <Loader2 className="animate-spin h-6 w-6 mr-2" />
      Loading…
    </div>
  );
}

  return (
    <div className="pageContent flex flex-col min-h-screen" data-co="page-search">

    {error ? (
      <div className="p-4 bg-red-100 text-red-800 border border-red-300 rounded mb-4">
        <p>❌ Une erreur est survenue lors du chargement des résultats.</p>
        <pre className="mt-2 text-sm whitespace-pre-wrap break-words">
        {error instanceof Error
        ? error.message
        : String(error)}
        </pre>
        <button
          onClick={() => refetch()}
          className="mt-2 px-3 py-1 text-sm bg-red-50 border border-red-400 text-red-700 rounded hover:bg-red-200"
        >
          Réessayer
        </button>
      </div>
    ) : null}

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header with title and description */}
        {(title || description) && (
          <div className="p-4 flex items-center justify-center">
            <div className="flex flex-col items-center text-center space-y-1">
            {title && <h1 className="text-2xl font-bold">{t(title)} {totalCount ? <span className="text-sm font-normal">({totalCount})</span> : null}</h1>}
            {description && <p className="text-sm">{t(description)}</p>}
            </div>
          </div>
        )}
        {/* Mobile filters bar */}
        <div className="sm:hidden px-4 py-2 flex items-center gap-2">
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
            searchType={searchType}
            onTextChange={setSearchText}
            onTagChange={setSearchTags}
            onTypeChange={setSearchType}
            countTypes={hasCount && data?.pages?.[0]?.count ? data?.pages?.[0]?.count : {}}
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
              searchType={searchType}
              onTextChange={setSearchText}
              onTagChange={setSearchTags}
              onTypeChange={setSearchType}
              countTypes={hasCount && data?.pages?.[0]?.count ? data?.pages?.[0]?.count : {}}
            />
            {(showActiveFiltersTypes || showActiveFiltersTags) && filters && Object.keys(filters).length > 0 && (
            <ActiveFiltersBar
              filters={filters}
              showActiveFiltersTypes={showActiveFiltersTypes}
              showActiveFiltersTags={showActiveFiltersTags}
              filtersSearchTags={searchTags}
              filtersSearchType={searchType}
              onRemove={(key, value) => {
                const current = searchTags?.[key] ?? [];
                if (!Array.isArray(current)) return;

                const updatedValues = current.filter((v) => v !== value);
                const next = { ...searchTags };

                if (updatedValues.length === 0) {
                  delete next[key];
                } else {
                  next[key] = updatedValues;
                }

                setSearchTags(next);
              }}
              onRemoveType={(key, value) => {
                const current = searchType?.[key] ?? [];
                if (!Array.isArray(current)) return;

                const updatedValues = current.filter((v) => v !== value);
                const next = { ...searchType };

                if (updatedValues.length === 0) {
                  delete next[key];
                } else {
                  next[key] = updatedValues;
                }

                setSearchType(next); // ✅ on envoie un objet directement
              }}
            />
            )}
          </div>
        )}

        {/* Map or list */}
        {enableMap && mapUsed ? (
          <div className="relative flex-1 overflow-hidden">
            {loadingMap && (
              <div className="absolute inset-0 z-10 bg-background/80 flex flex-col items-center justify-center">
                <Loader2 className="animate-spin h-10 w-10 text-primary-foreground" />
                <p className="text-sm text-secondary-foreground mt-2">{t("Chargement de la carte…")}</p>
              </div>
            )}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2 z-50"
              onClick={() => setMapUsed(false)}
              aria-label="Voir en liste"
            >
              <ClipboardList className="h-5 w-5 text-primary" />
            </Button>
            </TooltipTrigger>
            <TooltipContent>{t("Voir en liste")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>



            {Array.isArray(transformedResults) && transformedResults.length > 0 && (
              <ClientOnly
                fallback={
                  <div className="absolute inset-0 z-10 bg-white/80 flex flex-col items-center justify-center">
                    <Skeleton className="w-3/4 h-1/2" />
                    <p className="text-sm text-secondary-foreground mt-2">{t("Chargement de la carte…")}</p>
                  </div>
                }
              >
                {() => <SearchMapWrapper results={transformedResults} card={list?.card} />}
              </ClientOnly>
            )}
          </div>
        ) : (
          <div className="p-4 overflow-y-auto">
          {enableMap && (
            <div className="flex justify-end mb-4">
              <Button variant="outline" size="sm" onClick={() => setMapUsed(true)} className="flex items-center">
                <Map className="mr-2 h-4 w-4 text-primary" /> {t("Carte")}
              </Button>
            </div>
          )}

            {loadingMap && <SearchListSkeleton />}

            {!loadingMap && transformedResults.length === 0 && (
              <div className="text-center text-secondary-foreground py-8">{t("Aucun résultat trouvé.")}</div>
            )}

            <SearchListView results={transformedResults} columns={list?.columns} card={list?.card} preview={list?.preview} />

            <div ref={lastItemRef} className="h-12" />

            {isFetchingNextPage && (
              <div className="flex justify-center py-4 text-secondary-foreground">{t("Chargement plus de résultats…")}</div>
            )}
          </div>
        )}
      </div>

      {/* Mobile filters modal */}
      {showFiltersModal && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col sm:items-center sm:justify-center">
          <div className="flex justify-between items-center p-4 border-b">
            <h2 className="text-lg font-semibold">{t("Filtres")}</h2>
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
              searchType={searchType}
              onTextChange={setSearchText}
              onTagChange={setSearchTags}
              onTypeChange={setSearchType}
            />
            { (showActiveFiltersTypes || showActiveFiltersTags) && (
              <ActiveFiltersBar
                filters={filters}
                filtersSearchTags={searchTags}
                filtersSearchType={searchType}
                onRemove={(key, value) => {
                  const current = searchTags?.[key] ?? [];
                  if (!Array.isArray(current)) return;

                  const updatedValues = current.filter((v) => v !== value);
                  const next = { ...searchTags };

                  if (updatedValues.length === 0) {
                    delete next[key];
                  } else {
                    next[key] = updatedValues;
                  }

                  setSearchTags(next);
                }}
                onRemoveType={(key, value) => {
                  const current = searchType?.[key] ?? [];
                  if (!Array.isArray(current)) return;

                  const updatedValues = current.filter((v) => v !== value);
                  const next = { ...searchType };

                  if (updatedValues.length === 0) {
                    delete next[key];
                  } else {
                    next[key] = updatedValues;
                  }

                  setSearchType(next); // ✅ on envoie un objet directement
                }}
            />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchPro;
