import { Loader2, Map } from "lucide-react";
import React, { useState, useMemo } from "react";

import { Button } from "@/components/ui/button";
import SearchListView from "./components/SearchListView";
import SearchListSkeleton from "./components/SearchListSkeleton";
import SearchMapWrapper from "./components/SearchMapWrapper";
import { Skeleton } from "@/components/ui/skeleton";

import { useCocolight } from "@/hooks/useCocolight";
import { useInfiniteQueryScrollNext } from "@/hooks/useInfiniteQueryScroll";
import { ClientOnly } from "@/components/layout/ClientOnly";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import "@/modules/search/i18n";
import "@/modules/search/styles.css";
import { SearchProStaticSectionProps, SearchResultPage } from "./schema";
import type { GlobalAutocompleteCostumData } from "@communecter/cocolight-api-client";

/**
 * SearchProStatic: Version statique sans synchronisation URL
 * Utilisé pour afficher plusieurs sections de recherche sur une même page
 * Tous les paramètres sont passés via props et restent locaux
 */
const SearchProStatic: React.FC<{ props: SearchProStaticSectionProps }> = ({ props }) => {
  const { loaded } = useLoadNamespace("modules/search");
  const t = useT("modules/search");
  const { organization, helper } = useCocolight();

  // Extraction des props
  const {
    title,
    description,
    showMap = false,
    enableMap = true,
    disableInfiniteScroll = false,
    baseParams = {},
    list,
  } = props;

  const customHeader = props.customHeader;

  // État local (pas de sync URL)
  const [mapUsed, setMapUsed] = useState(showMap);
  const [searchText] = useState("");
  const [searchTags] = useState<Record<string, string[]>>({});
  const [searchType] = useState<Record<string, string[]> | null>(
    baseParams?.defaultTypes ? { type: baseParams.defaultTypes } : null
  );

  // Infinite query
  const {
    data,
    error,
    lastItemRef,
    isFetchingNextPage,
    isLoading: loadingMap,
    isPending,
    refetch,
  } = useInfiniteQueryScrollNext({
    queryKey: [
      "searchCostumStatic",
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

      const type = Array.isArray(searchType)
        ? searchType
        : searchType
          ? Object.values(searchType).flat()
          : [];
      const tags = Object.values(searchTags).flat() as string[];
      const page = pageParam as SearchResultPage | undefined;

      const {
        fediverse = false,
        indexStepList = 10,
        indexStepMap = 0,
        defaultTypes,
        defaultTags,
        defaultFilters,
        defaultFields,
        defaultSortBy,
        notSourceKey,
      } = baseParams;

      const param: Partial<GlobalAutocompleteCostumData> = {
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

      if (type && type.length > 0) param.searchType = type as GlobalAutocompleteCostumData["searchType"];
      if (!type && defaultTypes) param.searchType = defaultTypes;
      if (defaultTags && defaultTags.length > 0) {
        param.defaultTags = defaultTags;
      }

      if (!param.searchType) {
        return { results: [], count: {}, hasNext: false, pageNumber: 1 };
      }

      try {
        const result = await organization.searchCostum(param);
        if (
          page &&
          page?.pageNumber > 1 &&
          typeof page?.next !== "function" &&
          result.next
        ) {
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
      initialPageParam: [],
    },
  });

  // Transformation des résultats
  const transformedResults = useMemo(() => {
    const results = data?.pages?.flatMap((p) => p?.results) ?? [];
    if (!organization || !results.length) return results || [];
    return results.flatMap((d: any) => {
      if (d?.getEntityType) return d;
      return helper.fromEntityJSON(d, organization);
    });
  }, [data, organization, helper]);

  const hasCount =
    data?.pages?.[0]?.count && typeof data?.pages?.[0]?.count === "object";
  const totalCount =
    hasCount && data?.pages?.[0]?.count?.["total"]
      ? data?.pages?.[0]?.count?.["total"]
      : undefined;

  if (!loaded) {
    return (
      <div className="flex-1 flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="animate-spin h-6 w-6 mr-2" />
        Loading…
      </div>
    );
  }

  return (
    <div
      className="pageContent flex-1 w-full h-full overflow-hidden"
      data-co="page-search-static"
    >
      {error ? (
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
      ) : null}

      <div className="flex flex-col flex-1 w-full h-full overflow-hidden">
        {/* Header */}
        {(title || description) && (
          <div className="p-4 flex items-center justify-center">
            <div className="flex flex-col items-center text-center space-y-1">
              {title && (
                <h1 className="text-2xl font-bold">
                  {t(title)}{" "}
                  {totalCount ? (
                    <span className="text-sm font-normal">({totalCount})</span>
                  ) : null}
                </h1>
              )}
              {description && <p className="text-sm">{t(description)}</p>}
            </div>
          </div>
        )}

        {enableMap && mapUsed ? (
          <div className="relative flex-1 h-full w-full overflow-hidden">
            {loadingMap && (
              <div className="absolute inset-0 z-10 bg-background/80 flex flex-col items-center justify-center">
                <Loader2 className="animate-spin h-10 w-10 text-primary-foreground" />
                <p className="text-sm text-secondary-foreground mt-2">
                  {t("Chargement de la carte…")}
                </p>
              </div>
            )}

            <Button
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2 z-50"
              onClick={() => setMapUsed(false)}
              aria-label={t("Voir en liste")}
            >
              <Map className="h-5 w-5 text-primary" />
            </Button>

            {Array.isArray(transformedResults) &&
              transformedResults.length > 0 && (
                <ClientOnly
                  fallback={
                    <div className="absolute inset-0 z-10 bg-white/80 flex flex-col items-center justify-center">
                      <Skeleton className="w-3/4 h-1/2" />
                      <p className="text-sm text-secondary-foreground mt-2">
                        {t("Chargement de la carte…")}
                      </p>
                    </div>
                  }
                >
                  {() => (
                    <SearchMapWrapper
                      results={transformedResults}
                      card={list?.card}
                    />
                  )}
                </ClientOnly>
              )}
          </div>
        ) : (
          <div className="p-4 overflow-y-auto">
            {customHeader ? (
              <div className="container flex justify-between mx-auto px-4 sm:px-6 lg:px-8 mb-6">
                <div className="flex justify-between items-center">
                  {customHeader.title && (
                    <h2 className="text-2xl font-extrabold text-gray-900">
                      {typeof customHeader.title === "string"
                        ? customHeader.title
                        : t(customHeader.title)}
                    </h2>
                  )}
                </div>
                {enableMap && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMapUsed(true)}
                  >
                    <Map className="mr-2 h-4 w-4 text-primary" /> {t("Carte")}
                  </Button>
                )}
              </div>
            ) : (
              enableMap && (
                <div className="flex justify-end mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMapUsed(true)}
                  >
                    <Map className="mr-2 h-4 w-4 text-primary" /> {t("Carte")}
                  </Button>
                </div>
              )
            )}

            {/* Afficher le skeleton uniquement lors du premier chargement (isPending) */}
            {isPending && <SearchListSkeleton />}

            {/* Afficher "Aucun résultat" seulement si pas en chargement ET pas de résultats */}
            {!isPending && !loadingMap && transformedResults.length === 0 && (
              <div className="text-center text-secondary-foreground py-8">
                {t("Aucun résultat trouvé.")}
              </div>
            )}

            <SearchListView
              results={transformedResults}
              columns={list?.columns}
              card={list?.card}
              preview={list?.preview}
            />

            {!disableInfiniteScroll && <div ref={lastItemRef} className="h-12" />}

            {isFetchingNextPage && (
              <div className="flex justify-center py-4 text-secondary-foreground">
                {t("Chargement plus de résultats…")}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchProStatic;
