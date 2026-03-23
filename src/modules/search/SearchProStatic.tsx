import { Loader2, Map, List, LayoutGrid, Search, MapPin, Download, Plus, GitBranch } from "lucide-react";
import * as LucideIcons from "lucide-react";
import React, { useState, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useDebounce } from "@/hooks/useDebounce";
import SearchListView from "./components/SearchListView";
import SearchListSkeleton from "./components/SearchListSkeleton";
import SearchMapWrapper from "./components/SearchMapWrapper";
import SearchBubbleChart from "./components/SearchBubbleChart";
import { SwitchDetailsMode } from "./components/SwitchDetailsMode";
import { Skeleton } from "@/components/ui/skeleton";
import type { SearchEntity } from "@communecter/cocolight-api-client";

import { ClientOnly } from "@/components/layout/ClientOnly";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import "@/modules/search/i18n"; // Required: registers i18n resources
import "@/modules/search/styles.css";
import { SearchProStaticSectionProps } from "./schema";
import { useSearchQuery } from "./hooks/useSearchQuery";
import { useCsvExport } from "./hooks/useCsvExport";
import { useZonesQuery, getZoneId, getZoneName } from "./hooks/useZonesQuery";
import { usePageFiltersOptional } from "@/contexts/PageFiltersContext";
import { useCocolight } from "@/hooks/useCocolight";
import { useLocalization } from "@/hooks/useLocalization";
import { DynamicModal } from "@/modules/profil/components/add/ModalRegistry";
import { useProfilPermissions } from "@/modules/profil/hooks/useProfilPermissions";
import { toast } from "sonner";

/**
 * SearchProStatic: Version statique sans synchronisation URL
 * Utilisé pour afficher plusieurs sections de recherche sur une même page
 * Tous les paramètres sont passés via props et restent locaux
 */
const SearchProStatic: React.FC<{ props: SearchProStaticSectionProps }> = ({ props }) => {
  const { loaded } = useLoadNamespace("modules/search");
  const t = useT("modules/search");
  const { currentLocale } = useLocalization();

  // Extraction des props
  const {
    title,
    icon,
    description,
    placeholder,
    showSearch = false,
    showMap = false,
    enableMap = true,
    disableInfiniteScroll = false,
    addButton,
    zoneSelector,
    tagSelector,
    csvButton,
    baseParams = {},
    list,
  } = props;

  const { me, entity, helper } = useCocolight();
  const isConnected = !!me;
  const permissions = useProfilPermissions(entity || null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const IconComponent = icon ? (LucideIcons as any as Record<string, React.ComponentType<{ className?: string }>>)[icon.charAt(0).toUpperCase() + icon.slice(1).replace(/-./g, x => x[1].toUpperCase())] : null;

  const customHeader = props.customHeader;
  const showDetailedViewToggle = props.showDetailedViewToggle ?? false;
  const defaultDetailedView = props.defaultDetailedView ?? false;

  const contextFilters = usePageFiltersOptional();

  // État local (pas de sync URL)
  const defaultViewMode = props.defaultViewMode || (showMap ? "map" : "list");
  const [viewMode, setViewMode] = useState<"list" | "map" | "graph">(defaultViewMode);
  const [isDetailedView, setIsDetailedView] = useState(defaultDetailedView);
  const [localSearchInput, setLocalSearchInput] = useState("");
  const debouncedLocalSearch = useDebounce(localSearchInput, 500);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");
  const [selectedTagValue, setSelectedTagValue] = useState<string>("");

  const enableGraph = props.enableGraph ?? false;
  const graphCategories = props.graphCategories;
  const graphDetailsMode = props.graphDetailsMode ?? "drawer";

  const [graphOpenDetails, setGraphOpenDetails] = useState(false);
  const [graphSelectedItem, setGraphSelectedItem] = useState<SearchEntity | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleGraphItemClick = (item: any) => {
    if (graphDetailsMode === "link") {
      const data = ('serverData' in item && item.serverData ? item.serverData : item) as Record<string, unknown>;
      if (data.slug) {
        window.location.href = `/@${data.slug}`;
      }
      return;
    }
    setGraphSelectedItem(item as SearchEntity);
    setGraphOpenDetails(true);
  };

  const { zones, isLoading: zonesLoading } = useZonesQuery({ zoneSelector });

  const selectedZone = useMemo(() => {
    if (!selectedZoneId || selectedZoneId === "__all__" || !zones) {
      return null;
    }
    const found = zones.find((z) => getZoneId(z) === selectedZoneId);
    return found;
  }, [selectedZoneId, zones]);

  const zoneLocality = useMemo<Record<string, { id: string; type: "cities" | "level1" }>>(() => {
    if (!selectedZone) {
      return {};
    }

    const zoneId = getZoneId(selectedZone);
    const levelRaw = selectedZone.level?.[0];
    const levelValue = String(levelRaw || "1");
    const levelNum = parseInt(levelValue, 10);
    const key = `${zoneId}level${levelValue}`;
    const zoneType: "cities" | "level1" = levelNum >= 4 ? "cities" : "level1";

    const result = {
      [key]: {
        id: zoneId,
        type: zoneType,
      },
    };
    return result;
  }, [selectedZone]);

  const getModalName = (): string | null => {
    if (addButton?.modal) return addButton.modal;
    if (addButton?.organization) return "add-organization";
    if (addButton?.project) return "add-project";
    if (addButton?.poi) return "add-poi";
    return null;
  };

  const modalName = getModalName();

  const handleAddClick = () => {
    if (!isConnected) {
      toast.error(t("Vous devez être connecté pour ajouter"));
      return;
    }
    if (modalName) {
      setIsModalOpen(true);
    }
  };

  const filterNames = contextFilters?.filterNames;
  const searchQuery = contextFilters?.searchQuery;

  const searchText = useMemo(
    () => showSearch ? debouncedLocalSearch : (searchQuery || ""),
    [showSearch, debouncedLocalSearch, searchQuery]
  );

  const searchTags = useMemo<Record<string, string[]>>(() => {
    const tags: string[] = [];

    if (filterNames && filterNames.length > 0) {
      tags.push(...filterNames);
    }

    if (selectedTagValue && selectedTagValue !== "__all__") {
      tags.push(selectedTagValue);
    }

    return tags.length > 0 ? { tags } : {} as Record<string, string[]>;
  }, [filterNames, selectedTagValue]);

  const [searchType] = useState<Record<string, string[]> | null>(
    baseParams?.defaultTypes ? { type: baseParams.defaultTypes } : null
  );

  const searchByFields = contextFilters?.searchByFields;

  const filters = useMemo<Record<string, unknown>>(() => {
    if (searchByFields) {
      const obj: Record<string, Record<string, string[]>> = {};
      for (const { field, type, value } of Object.values(searchByFields)) {
        if (type && type === "scopeList") continue;
        if (value && value.length > 0) {
          if (!obj[field]) {
            obj[field] = { "$in": value };
          } else {
            obj[field]["$in"] = Array.from(new Set([...obj[field]["$in"], ...value]));
          }
        };
      }
      return obj;
    }
    return {};
  }, [searchByFields]);

  const contextLocality = useMemo<Record<string, unknown>>(() => {
    if (searchByFields) {
      const obj: Record<string, unknown> = {};
      for (const { field, type, value } of Object.values(searchByFields)) {
        if (type && type === "scopeList") {
          if (!obj[field]) {
            obj[field] = value;
          }
        }
      }
      return obj;
    }
    return {};
  }, [searchByFields]);

  const locality = useMemo<Record<string, unknown>>(() => {
    const combined = {
      ...contextLocality,
      ...zoneLocality,
    };
    return combined;
  }, [contextLocality, zoneLocality]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mergedBaseParams = useMemo<any>(() => ({
    ...baseParams,
    defaultFilters: {
      ...baseParams.defaultFilters,
      ...filters,
    },
    locality: locality,
  }), [baseParams, filters, locality]);

  const csvSearchParams = useMemo(() => ({
    searchText,
    searchTags,
    searchType,
    baseParams: mergedBaseParams,
  }), [searchText, searchTags, searchType, mergedBaseParams]);

  const { exportCsv, isExporting } = useCsvExport({
    csvButton,
    entity,
    searchParams: csvSearchParams,
    helper,
  });

  const {
    error,
    lastItemRef,
    isFetchingNextPage,
    isLoading: loadingMap,
    isPending,
    refetch,
    transformedResults,
    totalCount,
  } = useSearchQuery({
    queryKeyPrefix: "searchCostumStatic",
    searchText,
    searchTags,
    searchType,
    mapUsed: viewMode === "map",
    graphUsed: viewMode === "graph",
    baseParams: mergedBaseParams,
  });

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
        <div className="p-4 bg-destructive/10 text-destructive border border-destructive/30 rounded mb-4">
          <p>❌ Une erreur est survenue lors du chargement des résultats.</p>
          <pre className="mt-2 text-sm whitespace-pre-wrap wrap-break-words">
            {error instanceof Error ? error.message : String(error)}
          </pre>
          <button
            onClick={() => refetch()}
            className="mt-2 px-3 py-1 text-sm bg-destructive/5 border border-destructive/40 text-destructive rounded hover:bg-destructive/20"
          >
            Réessayer
          </button>
        </div>
      ) : null}

      <div className="flex flex-col flex-1 w-full h-full overflow-hidden">
        {/* Header */}
        {(title || description || showSearch || enableMap) && (
          <div className="flex flex-col gap-3 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center space-x-2">
                {IconComponent && <IconComponent className="h-5 w-5" />}
                {title && (
                  <span className="text-xl font-semibold">
                    {t(title)}{" "}
                    {totalCount ? (
                      <span className="text-sm font-normal">({totalCount})</span>
                    ) : null}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {enableMap && (
                  <Button
                    variant={viewMode === "map" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode(viewMode === "map" ? "list" : "map")}
                  >
                    <Map className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">{t("Carte")}</span>
                  </Button>
                )}
                {enableGraph && (
                  <Button
                    variant={viewMode === "graph" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode(viewMode === "graph" ? "list" : "graph")}
                  >
                    <GitBranch className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">{t("Graphe")}</span>
                  </Button>
                )}
                {csvButton?.show && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportCsv()}
                    disabled={isExporting}
                  >
                    {isExporting ? (
                      <Loader2 className="h-4 w-4 animate-spin sm:mr-1" />
                    ) : (
                      <Download className="h-4 w-4 sm:mr-1" />
                    )}
                    <span className="hidden sm:inline">
                      {csvButton.label ? t(csvButton.label) : t("CSV")}
                    </span>
                  </Button>
                )}
                {addButton?.show && permissions.isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddClick}
                  >
                    <Plus className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">
                      {addButton.label ? t(addButton.label) : t("Ajouter")}
                    </span>
                  </Button>
                )}
              </div>
            </div>
            {(showSearch || (tagSelector?.show && tagSelector.options) || zoneSelector?.show) && (
              <div className="flex flex-col gap-2 items-center sm:flex-row sm:items-center sm:justify-center">
                {showSearch && (
                  <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder={placeholder ? t(placeholder) : t("Rechercher...")}
                      value={localSearchInput}
                      onChange={(e) => setLocalSearchInput(e.target.value)}
                      className="pl-9 w-full sm:w-64 h-9"
                    />
                  </div>
                )}
                {tagSelector?.show && tagSelector.options && (
                  <div className="relative w-full sm:w-auto">
                    <select
                      value={selectedTagValue}
                      onChange={(e) => setSelectedTagValue(e.target.value)}
                      className="h-9 px-3 rounded-md border border-input bg-background text-sm w-full sm:min-w-45 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">
                        {tagSelector.placeholder
                          ? t(tagSelector.placeholder)
                          : t("Toutes les catégories")}
                      </option>
                      <option value="__all__">{t("Toutes les catégories")}</option>
                      {Object.entries(tagSelector.options).map(([value, label]) => (
                        <option key={value} value={value}>
                          {typeof label === "string" ? label : t(label)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {zoneSelector?.show && (
                  <div className="relative w-full sm:w-auto flex items-center gap-2">
                    {zonesLoading && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
                    <div className="relative w-full sm:w-auto">
                      <MapPin className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <select
                        value={selectedZoneId}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          setSelectedZoneId(newValue);
                        }}
                        className="h-9 pl-8 pr-3 rounded-md border border-input bg-background text-sm w-full sm:min-w-50 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
                        disabled={zonesLoading}
                      >
                        <option value="">
                          {zonesLoading
                            ? t("Chargement...")
                            : zoneSelector.placeholder
                              ? t(zoneSelector.placeholder)
                              : t("Sélectionner une zone")}
                        </option>
                        <option value="__all__">{t("Toutes les zones")}</option>
                        {zones && zones.length > 0 && zones.map((zone) => {
                          const zoneId = getZoneId(zone);
                          const zoneName = getZoneName(zone, currentLocale);
                          return (
                            <option key={zoneId} value={zoneId}>
                              {zoneName}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}
            {description && <p className="text-sm text-muted-foreground">{t(description)}</p>}
          </div>
        )}

        {viewMode === "map" && enableMap ? (
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
              onClick={() => setViewMode("list")}
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
        ) : viewMode === "graph" && enableGraph ? (
          <div className="relative flex-1 h-full w-full overflow-hidden p-4">
            {loadingMap && (
              <div className="absolute inset-0 z-10 bg-background/80 flex flex-col items-center justify-center">
                <Loader2 className="animate-spin h-10 w-10 text-primary-foreground" />
                <p className="text-sm text-secondary-foreground mt-2">
                  {t("Chargement du graphe…")}
                </p>
              </div>
            )}

            <Button
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2 z-50"
              onClick={() => setViewMode("list")}
              aria-label={t("Voir en liste")}
            >
              <GitBranch className="h-5 w-5 text-primary" />
            </Button>

            {Array.isArray(transformedResults) && transformedResults.length > 0 && (
              <ClientOnly
                fallback={
                  <div className="flex items-center justify-center h-64">
                    <Skeleton className="w-3/4 h-64" />
                  </div>
                }
              >
                {() => (
                  <SearchBubbleChart
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    results={transformedResults as any}
                    categories={graphCategories}
                    onItemClick={handleGraphItemClick}
                    height={450}
                  />
                )}
              </ClientOnly>
            )}

            {graphSelectedItem && (
              <SwitchDetailsMode
                openDetails={graphOpenDetails}
                setOpenDetails={setGraphOpenDetails}
                item={graphSelectedItem}
                card={{ detailsMode: graphDetailsMode === "link" ? "drawer" : graphDetailsMode }}
                preview={list?.preview}
              />
            )}
          </div>
        ) : (
          <div className="p-4 overflow-y-auto">
            {customHeader && (
              <div className="container flex justify-between mx-auto px-4 sm:px-6 lg:px-8 mb-6">
                <div className="flex justify-between items-center">
                  {customHeader.title && (
                    <h2 className="text-2xl font-extrabold text-foreground">
                      {typeof customHeader.title === "string"
                        ? customHeader.title
                        : t(customHeader.title)}
                    </h2>
                  )}
                </div>
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
              </div>
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
              isDetailedView={isDetailedView}
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

      {modalName && (
        <DynamicModal
          modalName={modalName}
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          parent={entity}
          formConfig={addButton?.formConfig}
        />
      )}
    </div>
  );
};

export default SearchProStatic;
