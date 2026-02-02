import { Loader2, Map, List, LayoutGrid, Search } from "lucide-react";
import * as LucideIcons from "lucide-react";
import React, { useState, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/useDebounce";
import SearchListView from "./components/SearchListView";
import SearchListSkeleton from "./components/SearchListSkeleton";
import SearchMapWrapper from "./components/SearchMapWrapper";
import { Skeleton } from "@/components/ui/skeleton";

import { ClientOnly } from "@/components/layout/ClientOnly";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import "@/modules/search/i18n"; // Required: registers i18n resources
import "@/modules/search/styles.css";
import { SearchProStaticSectionProps } from "./schema";
import { useSearchQuery } from "./hooks/useSearchQuery";
import { usePageFiltersOptional } from "@/contexts/PageFiltersContext";
import { useCocolight } from "@/hooks/useCocolight";
import { Plus } from "lucide-react";
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
    baseParams = {},
    list,
  } = props;

  const { me, entity } = useCocolight();
  const isConnected = !!me;
  const permissions = useProfilPermissions(entity || null);

  const IconComponent = icon ? (LucideIcons as any)[icon.charAt(0).toUpperCase() + icon.slice(1).replace(/-./g, x => x[1].toUpperCase())] : null;

  const customHeader = props.customHeader;
  const showDetailedViewToggle = props.showDetailedViewToggle ?? false;
  const defaultDetailedView = props.defaultDetailedView ?? false;

  const contextFilters = usePageFiltersOptional();

  // État local (pas de sync URL)
  const [mapUsed, setMapUsed] = useState(showMap);
  const [isDetailedView, setIsDetailedView] = useState(defaultDetailedView);
  const [localSearchInput, setLocalSearchInput] = useState("");
  const debouncedLocalSearch = useDebounce(localSearchInput, 500);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const searchTags = useMemo<Record<string, string[]>>(
    () =>
      filterNames && filterNames.length > 0
        ? { tags: filterNames }
        : {} as Record<string, string[]>,
    [filterNames]
  );

  const [searchType] = useState<Record<string, string[]> | null>(
    baseParams?.defaultTypes ? { type: baseParams.defaultTypes } : null
  );

  const filters = useMemo<Record<string, any>>(() => {
    if (contextFilters?.searchByFields) {
      const obj: Record<string, any> = {};
      for (const { field, type, value } of Object.values(contextFilters.searchByFields)) {
        if(type && type === "scopeList") continue;
        if (value && value.length > 0) {
          if(!obj[field]) {
            obj[field] = { "$in": value };
          }else{
            obj[field]["$in"] = Array.from(new Set([...obj[field]["$in"], ...value]));
          }
        };
      }
      return obj;
    }
    return {};
  }, [contextFilters?.searchByFields]);

  const locality = useMemo<Record<string, any>>(() => {
    if (contextFilters?.searchByFields) {
      const obj: Record<string, any> = {};
      for (const { field, type, value } of Object.values(contextFilters.searchByFields)) {
        if(type && type === "scopeList") {
          if(!obj[field]) {
            obj[field] = value;
          }
        }
      }
      return obj;
    }
    return {};
  }, [contextFilters?.searchByFields]);
  // Utilisation du hook de recherche partagé
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
    mapUsed,
    baseParams: {
      ...baseParams,
      defaultFilters: {
        ...baseParams.defaultFilters,
        ...filters,
      },
      locality: locality
    },
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
          <div className="flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
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
                {showSearch && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder={placeholder ? t(placeholder) : t("Rechercher...")}
                      value={localSearchInput}
                      onChange={(e) => setLocalSearchInput(e.target.value)}
                      className="pl-9 w-48 sm:w-64 h-9"
                    />
                  </div>
                )}
                {enableMap && (
                  <Button
                    variant={mapUsed ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMapUsed(!mapUsed)}
                  >
                    <Map className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">{t("Carte")}</span>
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
            {description && <p className="text-sm text-muted-foreground">{t(description)}</p>}
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
        />
      )}
    </div>
  );
};

export default SearchProStatic;
