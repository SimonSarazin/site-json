import { ClipboardList, Loader2, Map, X, Plus, List, LayoutGrid } from "lucide-react";
import React, { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import ActiveFiltersBar from "./components/ActiveFiltersBar";
import SearchFilters from "./components/SearchFilters";
import SearchListView from "./components/SearchListView";
import SearchListSkeleton from "./components/SearchListSkeleton";
import SearchMapWrapper from "./components/SearchMapWrapper";
import DynamicFormModal from "./components/DynamicFormModal";
import { Skeleton } from "@/components/ui/skeleton";

import { useCocolight } from "@/hooks/useCocolight";
import useSearchFilters from "@/modules/search/hooks/useSearchFilters";
import { useSearchQuery } from "@/modules/search/hooks/useSearchQuery";
import { ClientOnly } from "@/components/layout/ClientOnly";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import "@/modules/search/i18n";
import "@/modules/search/styles.css";
import { SearchProSectionProps, TagsFilter } from "./schema";
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
  const { me } = useCocolight();

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
    disableInfiniteScroll = false,
    filters = {},
    baseParams = {},
    list,
  } = props;

  const customHeader = props.customHeader;
  const showDetailedViewToggle = props.showDetailedViewToggle ?? false;

  /* ------------------------------------------------------------------ */
  /* UI state                                                            */
  /* ------------------------------------------------------------------ */
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isDetailedView, setIsDetailedView] = useState(false);

  /* ------------------------------------------------------------------ */
  /* Gestionnaire pour le bouton Ajouter                                */
  /* ------------------------------------------------------------------ */
  const handleAddClick = () => {
    setShowAddModal(true);
  };

  /* ------------------------------------------------------------------ */
  /* Déterminer le type d'entité basé sur les filtres                   */
  /* ------------------------------------------------------------------ */
  const determineEntityType = (): string | null => {
    // Si un type est spécifié dans les filtres, utiliser le premier
    if (searchType && Object.keys(searchType).length > 0) {
      const firstTypeKey = Object.keys(searchType)[0];
      const firstTypeValues = searchType[firstTypeKey];
      if (Array.isArray(firstTypeValues) && firstTypeValues.length > 0) {
        return firstTypeValues[0];
      }
    }

    // Sinon, utiliser le type par défaut de la configuration
    if (baseParams?.defaultTypes && Array.isArray(baseParams.defaultTypes) && baseParams.defaultTypes.length > 0) {
      return baseParams.defaultTypes[0];
    }

    return null;
  };


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
  const setMapUsed = enableMap ? rawSetMapUsed : () => { };

  /* ------------------------------------------------------------------ */
  /* Infinite query using Communecter searchCostum via shared hook       */
  /* ------------------------------------------------------------------ */
  const {
    data,
    error,
    lastItemRef,
    isFetchingNextPage,
    isLoading: loadingMap,
    isPending,
    refetch,
    transformedResults,
    totalCount,
    hasCount,
  } = useSearchQuery({
    queryKeyPrefix: "searchCostum",
    searchText,
    searchTags,
    searchType,
    mapUsed,
    baseParams,
  });

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
    <div className="pageContent flex-1 w-full h-full overflow-hidden" data-co="page-search">

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

      <div className="flex flex-col flex-1 w-full h-full overflow-hidden">
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

          {/* Bouton Ajouter conditionnel mobile - seulement si connecté */}
          {me && (
            <Button size="icon" className="flex-shrink-0" onClick={handleAddClick}>
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Desktop filters */}
        {!showFiltersModal && useFilter && (
          <div className="hidden sm:block p-4 space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
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
              </div>
              {/* Bouton Ajouter conditionnel - seulement si connecté */}
              {me && (
                <Button className="flex items-center gap-2 whitespace-nowrap" onClick={handleAddClick}>
                  <Plus className="h-4 w-4" />
                  {t("Ajouter")}
                </Button>
              )}
            </div>
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
          <div className="relative flex-1 h-full w-full overflow-hidden">
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
                    aria-label={t("Voir en liste")}
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
            {customHeader ? (
              <div className="container flex justify-between mx-auto px-4 sm:px-6 lg:px-8 mb-6">
                <div className="flex justify-between items-center">
                  {customHeader.title && (
                    <h2 className="text-2xl font-extrabold text-secondary-foreground">
                      {typeof customHeader.title === 'string' ? customHeader.title : t(customHeader.title)}
                    </h2>
                  )}
                </div>
                <div className="flex gap-2">
                  {showDetailedViewToggle && (
                    <Button
                      variant={isDetailedView ? "default" : "outline"}
                      size="sm"
                      onClick={() => setIsDetailedView(!isDetailedView)}
                    >
                      {isDetailedView ? (
                        <><LayoutGrid className="mr-2 h-4 w-4" /> Grille</>
                      ) : (
                        <><List className="mr-2 h-4 w-4" /> Détails</>
                      )}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setMapUsed(true)}>
                    <Map className="mr-2 h-4 w-4 text-primary" /> {t("Carte")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end mb-4 gap-2">
                {showDetailedViewToggle && (
                  <Button
                    variant={isDetailedView ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsDetailedView(!isDetailedView)}
                  >
                    {isDetailedView ? (
                      <><LayoutGrid className="mr-2 h-4 w-4" /> Grille</>
                    ) : (
                      <><List className="mr-2 h-4 w-4" /> Détails</>
                    )}
                  </Button>
                )}
                {enableMap && (
                  <Button variant="outline" size="sm" onClick={() => setMapUsed(true)}>
                    <Map className="mr-2 h-4 w-4 text-primary" /> {t("Carte")}
                  </Button>
                )}
              </div>
            )}

            {/* Afficher le skeleton uniquement lors du premier chargement (isPending) */}
            {isPending && <SearchListSkeleton />}

            {/* Afficher "Aucun résultat" seulement si pas en chargement ET pas de résultats */}
            {!isPending && !loadingMap && transformedResults.length === 0 && (
              <div className="text-center text-secondary-foreground py-8">{t("Aucun résultat trouvé.")}</div>
            )}

            <SearchListView
              results={transformedResults}
              columns={list?.columns}
              card={list?.card}
              preview={list?.preview}
              isDetailedView={isDetailedView}
            />

            {!disableInfiniteScroll && <div ref={lastItemRef} className="h-12" />}

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
            {(showActiveFiltersTypes || showActiveFiltersTags) && (
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

      {/* Modal d'ajout d'entité */}
      <DynamicFormModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        entityType={determineEntityType()}
        defaultTypes={baseParams?.defaultTypes}
      />
    </div>
  );
};

export default SearchPro;
