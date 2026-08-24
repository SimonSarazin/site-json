import { Loader2, Map, List, LayoutGrid, Search, MapPin, Download, Plus, GitBranch, ArrowRight } from "lucide-react";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import React, { Suspense, useState, useMemo, useCallback } from "react";
import { useNavigate, Link, useSearchParams } from "react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useDebounce } from "@/hooks/useDebounce";
import { useIsMobile } from "@/hooks/use-mobile";
import { lazy } from "vite-preload";
import SearchListView from "./components/SearchListView";
import SearchListSkeleton from "./components/SearchListSkeleton";
// Vues alternatives en lazy : `viewMode` est "list" par défaut. Les chunks
// map/graph/regions ne sont téléchargés que si l'utilisateur change de vue.
const SearchMapWrapper = lazy(() => import("./components/SearchMapWrapper"));
const SearchBubbleChart = lazy(() => import("./components/SearchBubbleChart"));
const FranceRegionsMap = lazy(() => import("./components/FranceRegionsMap"));
const ThematicCards = lazy(() => import("./components/ThematicCards"));
// Création d'une answer CoForm (`addButton.coform`, ex. « Ajouter un créneau ») :
// monté au premier clic seulement → le chunk coform n'est jamais téléchargé sur
// les sections sans cette config.
const CoFormModal = lazy(() => import("@/modules/coform/components/CoFormModal"));
// Fiche installation ouverte par l'URL (lien partagé). Import DYNAMIQUE : pas
// d'arête statique search → observatoire (l'inverse existe déjà), et le chunk
// recharts n'est tiré que sur un deep-link effectif.
const InstallationUrlModal = lazy(
  () => import("@/modules/observatoire/components/installation/InstallationUrlModal"),
);
import { SwitchDetailsMode } from "./components/SwitchDetailsMode";
import { Skeleton } from "@/components/ui/skeleton";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { getEntryCoords } from "./lib/searchMapSelection";

import { ClientOnly } from "@/components/layout/ClientOnly";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import "@/modules/search/i18n"; // Required: registers i18n resources
import "@/modules/search/styles.css";
import { DEFAULT_INSTALLATION_PARAM, SearchProStaticSectionProps } from "./schema";
import { useSearchQuery } from "./hooks/useSearchQuery";
import { useSearchAllResults } from "./hooks/useSearchAllResults";
import MapProgress from "./components/MapProgress";
import MapSkeleton from "./components/MapSkeleton";
import { useCsvExport } from "./hooks/useCsvExport";
import { canonicalSearchProStaticBaseParams } from "./lib/canonicalBaseParams";
import { useZonesQuery, getZoneId, getZoneName } from "./hooks/useZonesQuery";
import { usePageFiltersOptional } from "./contexts/pageFilters";
import { useInstallationFilterUrlSync } from "./hooks/useInstallationFilter";
import { searchByFieldsToQuery } from "./lib/searchByFieldsToQuery";
import { useCocolight } from "@/hooks/useCocolight";
import { useAuthModal } from "@/modules/auth";
import { useLocalization } from "@/hooks/useLocalization";
import { DynamicModal } from "@/modules/profil/components/add/ModalRegistry";
import { useProfilPermissions } from "@/modules/profil/hooks/useProfilPermissions";
import { useQueryClient } from "@tanstack/react-query";
import {
  SEARCH_QUERY_KEYS,
  SEARCH_STATIC_LIST_PREFIX,
  SEARCH_STATIC_MAP_PREFIX,
} from "./constants/queryKeys";

/**
 * Répartition {largeur liste, largeur carte, colonnes de la liste} du mode split,
 * selon `map.splitRatio`. Classes Tailwind écrites EN TOUTES LETTRES (le JIT ne
 * génère pas de classe construite dynamiquement). Défaut "40-60" : parité avec le
 * split de l'agenda (liste étroite 1 colonne, carte large). Les ratios plus larges
 * passent la liste à 2 colonnes (largeur suffisante).
 */
const SPLIT_LAYOUTS = {
  "40-60": { list: "w-2/5", map: "w-3/5", columns: { sm: 1, md: 1, lg: 1, xl: 1 } },
  "50-50": { list: "w-1/2", map: "w-1/2", columns: { sm: 1, md: 2, lg: 2, xl: 2 } },
  "60-40": { list: "w-3/5", map: "w-2/5", columns: { sm: 1, md: 2, lg: 2, xl: 2 } },
} as const;

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
    enableRegions = false,
    disableInfiniteScroll = false,
    addButton,
    zoneSelector,
    tagSelector,
    csvButton,
    baseParams = {},
    list,
    searchVariant,
  } = props;

  const { me, entity, helper } = useCocolight();
  const { openLogin } = useAuthModal();
  const isConnected = !!me;
  const permissions = useProfilPermissions(entity || null);

  const iconName = icon as IconName | undefined;

  const customHeader = props.customHeader;
  const [searchParams] = useSearchParams();
  const showDetailedViewToggle = props.showDetailedViewToggle ?? false;
  const defaultDetailedView = props.defaultDetailedView ?? false;

  const contextFilters = usePageFiltersOptional();

  // Filtre installation déclenché depuis les cartes : restauration one-time
  // depuis l'URL (liens partagés / rechargement). Monté ICI et pas dans la
  // carte — une seule hydratation par page.
  useInstallationFilterUrlSync(list?.card?.installationFilter);

  // Fiche installation partagée : on ne monte (donc ne télécharge) le chunk que
  // si le param est effectivement présent.
  const installationConf = list?.preview?.installationDashboard;
  const showInstallationUrlModal = Boolean(
    installationConf &&
      list?.preview?.reservations &&
      searchParams.get(installationConf.param ?? DEFAULT_INSTALLATION_PARAM),
  );

  // État local (pas de sync URL)
  const defaultViewMode = props.defaultViewMode || (showMap ? "map" : "list");
  const [viewMode, setViewMode] = useState<"list" | "map" | "graph" | "regions" | "thematics" | "split">(defaultViewMode);
  const isMobile = useIsMobile();
  // La vue carte peut être SPLIT (liste + carte synchronisées) via DEUX
  // déclencheurs : `defaultViewMode: "split"` (la vue carte canonique de la
  // section EST le split) OU `map.layout: "split"` (la vue « Carte » plein écran
  // devient split). Le split est DESKTOP only : sur mobile (côte-à-côte
  // illisible) on retombe sur la carte plein écran (cf. `!isMobile`).
  const isSplit = props.map?.layout === "split";
  // Répartition liste/carte du split (déf. "40-60", aligné sur l'agenda) —
  // configurable via `map.splitRatio`. Cf. SPLIT_LAYOUTS (classes littérales).
  const splitLayout = SPLIT_LAYOUTS[props.map?.splitRatio ?? "40-60"];
  // Cible « carte » du bouton de bascule : "split" si la section démarre en
  // split (desktop), sinon "map" (le déclencheur `map.layout` reste sur "map").
  const mapView: "split" | "map" = props.defaultViewMode === "split" && !isMobile ? "split" : "map";
  const [isDetailedView, setIsDetailedView] = useState(defaultDetailedView);
  const [localSearchInput, setLocalSearchInput] = useState("");
  const debouncedLocalSearch = useDebounce(localSearchInput, 500);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCoformModalOpen, setIsCoformModalOpen] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");
  const [selectedTagValue, setSelectedTagValue] = useState<string>("");
  // Synchro liste↔carte (mode split) : id de l'item focalisé — source UNIQUE,
  // partagée par la liste (highlight + scroll) et la carte (flyTo + openPopup).
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);

  const navigate = useNavigate();
  const regionsTarget = props.regionsTarget;
  // Clic sur la carte regions → navigue vers la page cible avec les slugs en
  // query (le groupe entityList correspondant pré-coche le filtre). Stable
  // (useCallback) pour ne pas re-déclencher le redraw d3 de FranceRegionsMap.
  const handleRegionsSelect = useCallback(
    (slugs: string[]) => {
      if (!regionsTarget || slugs.length === 0) return;
      navigate(`${regionsTarget.path}?${regionsTarget.filterId}=${encodeURIComponent(slugs.join(","))}`);
    },
    [navigate, regionsTarget]
  );

  const thematicsTarget = props.thematicsTarget;
  const thematicSource = props.thematicSource;
  // Nombre de thématiques remonté par ThematicCards (compteur du header en mode
  // thematics — le totalCount du moteur compte les orgas, pas les thématiques).
  const [thematicCount, setThematicCount] = useState(0);
  // Clic sur une card thématique → navigue vers la page cible avec le `name` en
  // query (le groupe filtersByPath correspondant pré-coche le filtre, match par
  // name). Ex. /lieux?reseauxThematiques=<name>.
  const handleThematicSelect = useCallback(
    (name: string) => {
      if (!thematicsTarget || !name) return;
      navigate(`${thematicsTarget.path}?${thematicsTarget.filterId}=${encodeURIComponent(name)}`);
    },
    [navigate, thematicsTarget]
  );

  const enableGraph = props.enableGraph ?? false;
  const graphTags = props.graphTags ?? props.graphCategories;
  const graphDetailsMode = props.graphDetailsMode ?? "drawer";
  const graphDefaultGroupMode = props.graphDefaultGroupMode ?? "country";
  const graphEnableCountryGrouping = props.graphEnableCountryGrouping ?? true;

  const [graphOpenDetails, setGraphOpenDetails] = useState(false);
  const [graphSelectedItem, setGraphSelectedItem] = useState<SearchEntity | null>(null);

  const handleGraphItemClick = (item: unknown) => {
    if (graphDetailsMode === "link") {
      const itemObj = item as Record<string, unknown>;
      const data = ('serverData' in itemObj && itemObj.serverData ? itemObj.serverData : itemObj) as Record<string, unknown>;
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
    // `coform` prime : le bouton ouvre la création d'answer (CoFormModal), pas
    // une modale d'entité — sinon les défauts organization/project (true dans
    // le schéma) détourneraient le clic vers add-organization.
    if (addButton?.coform) return null;
    if (addButton?.modal) return addButton.modal;
    if (addButton?.organization) return "add-organization";
    if (addButton?.project) return "add-project";
    if (addButton?.poi) return "add-poi";
    return null;
  };

  const modalName = getModalName();

  const handleAddClick = () => {
    if (!isConnected) {
      openLogin();
      return;
    }
    if (addButton?.coform) {
      setIsCoformModalOpen(true);
      return;
    }
    if (modalName) {
      setIsModalOpen(true);
    }
  };

  const queryClient = useQueryClient();
  // Après création d'une answer (ex. créneau) : re-fetch des listes de la
  // section — useCoFormFinalMutation n'invalide que les caches coform
  // (FORM/FORM_ANSWERS), jamais ceux du module search.
  const handleCoformSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: SEARCH_QUERY_KEYS.RESULTS_PREFIX(SEARCH_STATIC_LIST_PREFIX) });
    queryClient.invalidateQueries({ queryKey: SEARCH_QUERY_KEYS.RESULTS_PREFIX(SEARCH_STATIC_MAP_PREFIX) });
  }, [queryClient]);

  // Bouton « Ajouter » (modale d'entité ou création d'answer CoForm) —
  // activation par CONFIG (`show`), gate admin débrayable (`adminOnly: false`,
  // le clic d'un non-connecté ouvre le login). Factorisé : il doit apparaître
  // à côté du bouton Carte dans le header STANDARD **et** dans le header
  // custom (`customHeader`), qui sont exclusifs — deux JSX divergeraient.
  const showAddButton = Boolean(addButton?.show && (addButton.adminOnly === false || permissions.isAdmin));
  const addButtonElement = showAddButton && addButton ? (
    <Button variant="outline" size="sm" onClick={handleAddClick}>
      <Plus className="h-4 w-4 sm:mr-1" />
      <span className="hidden sm:inline">
        {addButton.label ? t(addButton.label) : t("Ajouter")}
      </span>
    </Button>
  ) : null;

  const filterNames = contextFilters?.filterNames;
  const searchQuery = contextFilters?.searchQuery;

  const searchText = useMemo(
    () => showSearch ? debouncedLocalSearch : (searchQuery || ""),
    [showSearch, debouncedLocalSearch, searchQuery]
  );

  // Lien « voir sur la page complète » (ex. /lieux) AVEC les filtres courants :
  // on recopie les query params actifs (typologies/services, déjà dans l'URL) +
  // la recherche texte (`?search=`). Affiché seulement si `customHeader.linkText`.
  const viewAllHref = useMemo(() => {
    if (!customHeader?.linkText) return null;
    const base = customHeader.linkHref || "/lieux";
    const params = new URLSearchParams(searchParams);
    if (searchQuery) params.set("search", searchQuery);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }, [customHeader, searchParams, searchQuery]);

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

  const searchByFields = contextFilters?.searchByFields;

  // Traduction `searchByFields` → filtres MongoDB / locality / sourceKeys / cible
  // « type d'info » (helper partagé avec l'autocomplete du hero → mêmes filtres
  // dynamiques des deux côtés).
  const { filters, contextLocality, dynamicSourceKeys, searchTarget } = useMemo(() => {
    const { filters, locality, sourceKeys, searchTarget } = searchByFieldsToQuery(searchByFields ?? {});
    return { filters, contextLocality: locality, dynamicSourceKeys: sourceKeys, searchTarget };
  }, [searchByFields]);

  // Le filtre « type d'info » (groupe `searchTargets`) REMPLACE les types par
  // défaut de la section — réactif (useMemo, plus useState) : la sélection
  // change les collections interrogées. Contenu identique → queryKey stable
  // (React Query sérialise la clé).
  const searchType = useMemo<Record<string, string[]> | null>(() => {
    const types = searchTarget?.defaultTypes ?? baseParams?.defaultTypes;
    return types ? { type: types } : null;
  }, [searchTarget, baseParams?.defaultTypes]);

  const locality = useMemo<Record<string, unknown>>(
    () => ({ ...contextLocality, ...zoneLocality }),
    [contextLocality, zoneLocality],
  );

  const mergedBaseParams = useMemo<Record<string, unknown>>(() => {
    const merged = canonicalSearchProStaticBaseParams(baseParams, filters, locality);
    // Un sourceKey actif prend le dessus sur notSourceKey (qui dit l'inverse).
    if (dynamicSourceKeys.length > 0) {
      merged.sourceKey = dynamicSourceKeys;
      delete merged.notSourceKey;
    }
    // La cible « type d'info » fusionne ses defaultFilters (ex. {"type":"affiche"})
    // PAR-DESSUS ceux de la section — mêmes clés = la cible gagne.
    if (searchTarget?.defaultFilters) {
      merged.defaultFilters = {
        ...(merged.defaultFilters as Record<string, unknown> | undefined),
        ...searchTarget.defaultFilters,
      };
    }
    return merged;
  }, [baseParams, filters, locality, dynamicSourceKeys, searchTarget]);

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
    queryKeyPrefix: SEARCH_STATIC_LIST_PREFIX,
    searchText,
    searchTags,
    searchType,
    // La vue carte ne passe plus par cette query (cf. mapAll ci-dessous).
    mapUsed: false,
    graphUsed: viewMode === "graph",
    baseParams: mergedBaseParams,
    variant: searchVariant,
  });

  // Vue carte : périmètre COMPLET chargé PROGRESSIVEMENT — pages de 500
  // enchaînées par le paginator SDK (indexMin manuel ignoré par le backend),
  // plafond 5000, cache 30 min (re-toggle liste↔carte instantané). Désactivée
  // (searchType: null → aucun appel) hors vue carte.
  const mapAll = useSearchAllResults({
    queryKeyPrefix: SEARCH_STATIC_MAP_PREFIX,
    searchType: (viewMode === "map" || (viewMode === "split" && !isMobile)) && enableMap ? searchType : null,
    searchText,
    searchTags,
    mapUsed: true,
    baseParams: mergedBaseParams,
    variant: searchVariant,
  });

  // Split : la liste ne montre que les résultats GÉOLOCALISÉS (= ceux qui ont un
  // marqueur sur la carte) → liste et carte correspondent, pas d'item sans point.
  // `getEntryCoords` est exactement le critère de rendu d'un marqueur (cf. SearchMap).
  const splitGeoResults = useMemo(
    () => mapAll.results.filter((e) => getEntryCoords(e as SearchEntity)),
    [mapAll.results],
  );

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
        {(title || description || showSearch || (enableMap && !customHeader)) && (
          <div className="flex flex-col gap-3 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center space-x-2">
                {iconName && <DynamicIcon name={iconName} className="h-5 w-5" />}
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
                {enableMap && !customHeader && (
                  <Button
                    variant={viewMode === mapView ? "default" : "outline"}
                    size="sm"
                    aria-label={mapView === "split" ? t("Liste + carte") : t("Carte")}
                    onClick={() => setViewMode(viewMode === mapView ? "list" : mapView)}
                  >
                    <Map className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">{mapView === "split" ? t("Liste + carte") : t("Carte")}</span>
                  </Button>
                )}
                {addButtonElement}
                {enableRegions && !customHeader && (
                  <Button
                    variant={viewMode === "regions" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode(viewMode === "regions" ? "list" : "regions")}
                  >
                    <MapPin className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">{t("Régions")}</span>
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

        {((viewMode === "split") || (viewMode === "map" && isSplit)) && enableMap && !isMobile ? (
          /* Mode SPLIT (desktop) : liste (gauche) + carte (droite) SYNCHRONISÉES,
             alimentées par mapAll.results (source UNIQUE → ids alignés). Clic
             carte-liste → flyTo+popup ; clic marqueur → highlight liste. Rendu
             uniquement hors mobile (cf. !isMobile) → côte-à-côte. Hauteur EXPLICITE
             `h-[78vh]` sur les deux colonnes : indispensable pour que la carte
             (`height:100%`) ait une référence et que son canvas = la zone visible
             (sinon fitBounds cadre sur une mauvaise taille). */
          <div className="flex w-full gap-4 overflow-hidden">
            {/* Liste (gauche) — défile dans sa hauteur ; 2 colonnes max (panneau
                étroit), pas les colonnes pleines de la vue liste. */}
            <div className={`h-[78vh] ${splitLayout.list} overflow-y-auto p-4`}>
              {!isPending && mapAll.isComplete && splitGeoResults.length === 0 && (
                <div className="py-8 text-center text-secondary-foreground">
                  {t("Aucun résultat trouvé.")}
                </div>
              )}
              <SearchListView
                results={splitGeoResults}
                columns={splitLayout.columns}
                list={list}
                focusedItemId={focusedItemId}
                onFocusItem={setFocusedItemId}
              />
            </div>
            {/* Carte (droite) : `h-[78vh]` borne la hauteur → la carte embarquée
                (height:100% via containerClass) la remplit exactement (cf. SearchMap). */}
            <div className={`relative h-[78vh] ${splitLayout.map} overflow-hidden rounded shadow`}>
              {/* Sortie du split → vue liste (détail), UNIQUEMENT quand le split
                  vient de `map.layout` (viewMode "map" + isSplit) : on est arrivé
                  depuis la liste, il faut pouvoir y retourner. Quand le split EST
                  la vue canonique (`defaultViewMode: "split"`), pas de bouton —
                  il n'y a pas de « retour liste » à proposer. */}
              {viewMode === "map" && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-2 right-2 z-50"
                  onClick={() => setViewMode("list")}
                  aria-label={t("Voir en liste")}
                >
                  <List className="h-5 w-5 text-primary" />
                </Button>
              )}
              <MapProgress
                loaded={mapAll.loaded}
                total={mapAll.total}
                isComplete={mapAll.isComplete}
                capped={mapAll.capped}
              />
              {splitGeoResults.length > 0 ? (
                <ClientOnly fallback={<MapSkeleton label={t("Chargement de la carte…")} />}>
                  {() => (
                    <SearchMapWrapper
                      results={splitGeoResults}
                      card={list?.card}
                      preview={list?.preview}
                      list={list}
                      map={props.map}
                      focusedItemId={focusedItemId}
                      onMarkerFocus={setFocusedItemId}
                      containerClass="absolute inset-0 z-10 rounded shadow overflow-hidden"
                    />
                  )}
                </ClientOnly>
              ) : mapAll.isComplete ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  {t("Aucun résultat")}
                </div>
              ) : (
                <MapSkeleton label={t("Chargement de la carte…")} />
              )}
            </div>
          </div>
        ) : viewMode === "map" && enableMap ? (
          <div className="relative flex-1 h-full w-full overflow-hidden">
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2 z-50"
              onClick={() => setViewMode("list")}
              aria-label={t("Voir en liste")}
            >
              <Map className="h-5 w-5 text-primary" />
            </Button>

            {/* Progression du chargement par pages + alerte plafond. */}
            <MapProgress
              loaded={mapAll.loaded}
              total={mapAll.total}
              isComplete={mapAll.isComplete}
              capped={mapAll.capped}
            />

            {/* MapSkeleton AVANT la 1ʳᵉ page et pendant le chunk Leaflet :
                le conteneur n'a aucune hauteur tant que SearchMap n'est pas
                monté — sans squelette dimensionné, le clic « Carte » donne un
                blanc total jusqu'à la 1ʳᵉ page. */}
            {mapAll.results.length > 0 ? (
              <ClientOnly fallback={<MapSkeleton label={t("Chargement de la carte…")} />}>
                {() => (
                  <SearchMapWrapper
                    results={mapAll.results}
                    card={list?.card}
                    preview={list?.preview}
                    list={list}
                    map={props.map}
                  />
                )}
              </ClientOnly>
            ) : mapAll.isComplete ? (
              <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
                {t("Aucun résultat")}
              </div>
            ) : (
              <MapSkeleton label={t("Chargement de la carte…")} />
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
                    results={transformedResults as unknown as React.ComponentProps<typeof SearchBubbleChart>["results"]}
                    categories={graphTags}
                    onItemClick={handleGraphItemClick}
                    height={450}
                    defaultGroupMode={graphDefaultGroupMode}
                    enableCountryGrouping={graphEnableCountryGrouping}
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
                list={list}
              />
            )}
          </div>
        ) : (
          <div className="p-4 overflow-y-auto mx-auto w-full max-w-[1536px]">
            {customHeader && (
              <div className="container flex justify-between items-center mx-auto px-4 sm:px-6 lg:px-8 mb-6">
                <div>
                  {customHeader.title && (
                    <h2 className="text-2xl font-extrabold text-foreground">
                      {typeof customHeader.title === "string"
                        ? customHeader.title
                        : t(customHeader.title)}
                      {(() => {
                        // En mode thematics, le compteur reflète le nombre de
                        // thématiques (pas les orgas du moteur de recherche).
                        const headerCount = viewMode === "thematics" ? thematicCount : totalCount;
                        return headerCount !== undefined && headerCount !== null && headerCount > 0 ? (
                          <span className="ml-2 text-base font-normal text-muted-foreground">
                            ({headerCount})
                          </span>
                        ) : null;
                      })()}
                    </h2>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {enableMap && (
                    <Button
                      variant={viewMode === mapView ? "default" : "outline"}
                      size="sm"
                      aria-label={mapView === "split" ? t("Liste + carte") : t("Carte")}
                      onClick={() => setViewMode(viewMode === mapView ? "list" : mapView)}
                    >
                      <Map className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">{mapView === "split" ? t("Liste + carte") : t("Carte")}</span>
                    </Button>
                  )}
                  {addButtonElement}
                  {customHeader.linkText && viewAllHref && (
                    // `text-foreground` : le lien est un <a> (asChild) → sinon il hérite
                    // du style global `a { text-primary }` et tranche avec les autres boutons.
                    <Button asChild variant="outline" size="sm" className="text-foreground">
                      <Link to={viewAllHref}>
                        {customHeader.linkIcon ? (
                          <DynamicIcon name={customHeader.linkIcon} className="h-4 w-4 sm:mr-1" />
                        ) : (
                          <ArrowRight className="h-4 w-4 sm:mr-1" />
                        )}
                        <span className="hidden sm:inline">
                          {typeof customHeader.linkText === "string"
                            ? customHeader.linkText
                            : t(customHeader.linkText)}
                        </span>
                      </Link>
                    </Button>
                  )}
                  {enableRegions && (
                    <Button
                      variant={viewMode === "regions" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setViewMode(viewMode === "regions" ? "list" : "regions")}
                    >
                      {viewMode === "regions" ? (
                        <><List className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">{t("Mode Liste")}</span></>
                      ) : (
                        <><MapPin className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">{t("Mode Carte")}</span></>
                      )}
                    </Button>
                  )}
                  {showDetailedViewToggle && viewMode !== "regions" && viewMode !== "thematics" && (
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
              </div>
            )}

            {viewMode === "regions" && (
              <ClientOnly>
                {() => (
                  <FranceRegionsMap
                    results={transformedResults}
                    onSelect={handleRegionsSelect}
                    height={550}
                  />
                )}
              </ClientOnly>
            )}

            {viewMode === "thematics" && thematicSource && (
              <ThematicCards
                queryId={thematicSource.id ?? thematicSource.thematicPath}
                source={thematicSource}
                onSelect={handleThematicSelect}
                onCountChange={setThematicCount}
              />
            )}

            {viewMode !== "regions" && viewMode !== "thematics" && (
              <>
                {isPending && <SearchListSkeleton />}

                {!isPending && !loadingMap && transformedResults.length === 0 && (
                  <div className="text-center text-secondary-foreground py-8">
                    {t("Aucun résultat trouvé.")}
                  </div>
                )}

                <SearchListView
                  results={transformedResults}
                  list={list}
                  isDetailedView={isDetailedView}
                />

                {!disableInfiniteScroll && <div ref={lastItemRef} className="h-12" />}
              </>
            )}

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

      {/* Monté seulement après le 1er clic (chunk coform à la demande). Suspense
          local : sans lui, le fallback de la section (SectionRenderer) ferait
          flasher toute la liste pendant le chargement du chunk. */}
      {addButton?.coform && isCoformModalOpen && (
        <Suspense fallback={null}>
          <CoFormModal
            formId={addButton.coform}
            open={isCoformModalOpen}
            onOpenChange={setIsCoformModalOpen}
            title={addButton.label ? String(t(addButton.label)) : undefined}
            onAfterSubmit={handleCoformSaved}
          />
        </Suspense>
      )}

      {showInstallationUrlModal && (
        <Suspense fallback={null}>
          <InstallationUrlModal preview={list!.preview!} />
        </Suspense>
      )}
    </div>
  );
};

export default SearchProStatic;
