import { Loader2, Map, List, LayoutGrid, Search, MapPin, Download, Plus, GitBranch, ArrowRight, ChartPie } from "lucide-react";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import React, { Suspense, useState, useMemo, useCallback, useContext, useEffect, useRef } from "react";
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
// Tableau de bord embarqué (`props.observatory`) : même import DYNAMIQUE que
// ci-dessus — recharts ne doit peser que sur les sections qui l'affichent, et
// seulement une fois la vue demandée.
const ObservatoryPanel = lazy(
  () => import("@/modules/observatoire/components/ObservatoryPanel"),
);
import { SwitchDetailsMode } from "./components/SwitchDetailsMode";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { getEntryCoords } from "./lib/searchMapSelection";

import { ClientOnly } from "@/components/layout/ClientOnly";
import { headerStickyOffsetPx } from "@/components/layout/header/headerOffset";
import { PageContext } from "@/contexts/PageContext";
import { useSite } from "@/hooks/useSite";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import "@/modules/search/i18n"; // Required: registers i18n resources
import "@/modules/search/styles.css";
import { DEFAULT_INSTALLATION_PARAM, SearchProStaticSectionProps } from "./schema";
import { useSearchQuery } from "./hooks/useSearchQuery";
import { useSearchAllResults } from "./hooks/useSearchAllResults";
import MapProgress from "./components/MapProgress";
import MapSkeleton from "./components/MapSkeleton";
import { useGeoShapesWarmup } from "@/lib/geoShapes";
import { useCsvExport } from "./hooks/useCsvExport";
import { canonicalSearchProStaticBaseParams } from "./lib/canonicalBaseParams";
import { useZonesQuery, getZoneId, getZoneName } from "./hooks/useZonesQuery";
import { usePageFiltersOptional } from "./contexts/pageFilters";
import { useInstallationFilterUrlSync } from "./hooks/useInstallationFilter";
import { searchByFieldsToQuery } from "./lib/searchByFieldsToQuery";
import { buildViewAllHref } from "./lib/viewAllHref";
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
 * Répartition {largeur liste, largeur carte, colonnes de la liste, densité des
 * cartes} du mode split, selon `map.splitRatio`. Classes Tailwind écrites EN
 * TOUTES LETTRES (le JIT ne génère pas de classe construite dynamiquement).
 * Défaut "40-60" : parité avec le split de l'agenda (liste étroite 1 colonne,
 * carte large). Les ratios plus larges passent la liste à 2 colonnes (largeur
 * suffisante).
 *
 * `compact` et `collapsible` suivent mécaniquement la largeur : à 30 %, la
 * colonne est trop étroite pour une carte pleine. Les cartes y sont DENSES
 * (mêmes informations, moins de hauteur) et REPLIÉES par défaut — la colonne se
 * parcourt alors comme la liste de la section `data-observatory`, une ligne par
 * item, et chaque carte se déplie d'un chevron. Les ratios historiques gardent
 * la carte pleine, dépliée : leur rendu ne bouge pas.
 */
const SPLIT_LAYOUTS = {
  "30-70": { list: "w-[30%]", map: "w-[70%]", columns: { sm: 1, md: 1, lg: 1, xl: 1 }, compact: true, collapsible: true },
  "40-60": { list: "w-2/5", map: "w-3/5", columns: { sm: 1, md: 1, lg: 1, xl: 1 }, compact: false, collapsible: false },
  "50-50": { list: "w-1/2", map: "w-1/2", columns: { sm: 1, md: 2, lg: 2, xl: 2 }, compact: false, collapsible: false },
  "60-40": { list: "w-3/5", map: "w-2/5", columns: { sm: 1, md: 2, lg: 2, xl: 2 }, compact: false, collapsible: false },
} as const;

/**
 * Hauteur des vues carte (carte seule, colonnes du split) = écran VISIBLE sous
 * la barre de navigation, dont la hauteur est posée en `--map-top` sur la
 * racine de la section. Calée sous la barre au clic (cf. `openMapView`), la vue
 * occupe alors tout l'écran sans être coupée en bas. `dvh` suit la barre
 * d'adresse mobile ; `vh` en repli : sans hauteur, la carte (en absolu)
 * s'effondrerait. Le split retranche son `py-4` (2rem). Classes littérales (JIT).
 */
const MAP_VIEW_HEIGHT =
  "h-[calc(100vh-var(--map-top))] supports-[height:100dvh]:h-[calc(100dvh-var(--map-top))]";
const SPLIT_COLUMN_HEIGHT =
  "h-[calc(100vh-var(--map-top)-2rem)] supports-[height:100dvh]:h-[calc(100dvh-var(--map-top)-2rem)]";
/** Carte (et son squelette) dans une vue carte : remplit la boîte ci-dessus. */
const MAP_FILL = "absolute inset-0 z-10 rounded shadow overflow-hidden";

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

  // Contours géographiques : préchauffage des couches déclarées `load: "page"`/`"idle"`. La CARTE
  // n'est montée qu'en vue carte (lazy + client-only) ; la section, elle, est toujours là — c'est
  // donc ici que « à l'entrée de la page » peut se jouer. `load: "map"` (défaut) : no-op.
  useGeoShapesWarmup(props.map?.shapes);

  // État local (pas de sync URL)
  const defaultViewMode = props.defaultViewMode || (showMap ? "map" : "list");
  const [viewMode, setViewMode] = useState<"list" | "map" | "graph" | "regions" | "thematics" | "split" | "observatory">(defaultViewMode);
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
  // Hauteur occupée en haut de l'écran par la barre de navigation (0 si elle
  // défile avec la page, ou si la page la masque) : les vues carte se calent
  // dessous et en déduisent leur hauteur (`--map-top`, cf. MAP_VIEW_HEIGHT).
  const { config } = useSite();
  const page = useContext(PageContext)?.page;
  const headerOffsetPx = page?.hideHeader ? 0 : headerStickyOffsetPx(config.header);
  // Ouverture de la carte PAR UN CLIC : la page défile pour caler la vue carte
  // (ou le split) sous la barre, où elle occupe tout l'écran. Jamais au
  // chargement — une page qui démarre sur la carte garde son en-tête visible.
  // Le défilement attend le rendu de la vue (effet ci-dessous) : avant, la
  // boîte à viser n'existe pas.
  const mapViewRef = useRef<HTMLDivElement>(null);
  const scrollToMapPending = useRef(false);
  const openMapView = () => {
    scrollToMapPending.current = true;
    setViewMode(mapView);
  };
  useEffect(() => {
    if (!scrollToMapPending.current) return;
    scrollToMapPending.current = false;
    const el = mapViewRef.current;
    if (!el) return;
    // `window.scrollTo` et non `scrollIntoView` : celui-ci fait aussi défiler
    // les ancêtres `overflow-hidden` de la section s'ils débordent.
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - headerOffsetPx, behavior: "smooth" });
  }, [viewMode, headerOffsetPx]);
  // Tableau de bord embarqué : déclaré (`props.observatory`) = 3ᵉ vue proposée,
  // à côté de la liste et de la carte. Il n'a pas de données propres — il lit
  // celles de la section (cf. `needsAllResults`).
  const observatory = props.observatory;
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

  // Bouton « Observatoire » — troisième bascule, à côté de Liste et Carte.
  // Factorisé pour la MÊME raison que `addButtonElement` : les deux en-têtes
  // (standard et `customHeader`) sont exclusifs, et deux JSX divergeraient.
  const observatoryLabel = observatory?.label ? t(observatory.label) : t("Observatoire");
  const observatoryButtonElement = observatory ? (
    <Button
      variant={viewMode === "observatory" ? "default" : "outline"}
      size="sm"
      aria-label={observatoryLabel}
      onClick={() => setViewMode(viewMode === "observatory" ? "list" : "observatory")}
    >
      <ChartPie className="h-4 w-4 sm:mr-1" />
      <span className="hidden sm:inline">{observatoryLabel}</span>
    </Button>
  ) : null;

  // Bascules disponibles depuis une vue PLEIN PANNEAU (carte, observatoire).
  // INDISPENSABLE : avec un `customHeader`, l'en-tête de la section — et donc
  // les boutons de vue — n'est rendu QUE dans la vue liste. Chaque vue plein
  // panneau porte donc ses propres sorties : vers l'autre vue plein panneau, et
  // vers la liste. Exception `split` CANONIQUE (`defaultViewMode: "split"`) :
  // pas de sortie liste, il n'y a pas de « retour » à proposer.
  const mapViewLabel = mapView === "split" ? t("Liste + carte") : t("Carte");
  const panelViewSwitch = (current: "map" | "split" | "observatory") => (
    <div className="flex items-center gap-2">
      {observatory && current !== "observatory" && (
        <Button
          variant="secondary"
          size="sm"
          aria-label={observatoryLabel}
          onClick={() => setViewMode("observatory")}
        >
          <ChartPie className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">{observatoryLabel}</span>
        </Button>
      )}
      {enableMap && current === "observatory" && (
        <Button
          variant="secondary"
          size="sm"
          aria-label={mapViewLabel}
          onClick={openMapView}
        >
          <Map className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">{mapViewLabel}</span>
        </Button>
      )}
      {current !== "split" && (
        <Button
          variant="secondary"
          size="sm"
          aria-label={t("Voir en liste")}
          onClick={() => setViewMode("list")}
        >
          <List className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">{t("Voir en liste")}</span>
        </Button>
      )}
    </div>
  );

  const filterNames = contextFilters?.filterNames;
  const searchQuery = contextFilters?.searchQuery;

  const searchText = useMemo(
    () => showSearch ? debouncedLocalSearch : (searchQuery || ""),
    [showSearch, debouncedLocalSearch, searchQuery]
  );

  // Lien « voir sur la page complète » (ex. /lieux) AVEC les filtres courants :
  // on recopie les query params actifs (typologies/services, déjà dans l'URL) +
  // la recherche texte (`?search=`). Affiché seulement si `customHeader.linkText`.
  // La fusion vit dans `buildViewAllHref` : un `linkHref` de config peut porter sa propre query
  // (scope de la page cible, ex. `?territoire=…`), qu'une concaténation naïve détruisait.
  const viewAllHref = useMemo(() => {
    if (!customHeader?.linkText) return null;
    return buildViewAllHref(customHeader.linkHref || "/lieux", searchParams, searchQuery);
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

  // Vues qui ont besoin du périmètre COMPLET, et pas de la seule page courante :
  // la CARTE (tous les marqueurs) et le TABLEAU DE BORD (des chiffres calculés
  // sur 10 équipements ne veulent rien dire). Elles partagent le même
  // chargement et le même cache : la bascule de l'une à l'autre est instantanée
  // et les deux montrent exactement le même jeu de résultats.
  const needsAllResults =
    ((viewMode === "map" || (viewMode === "split" && !isMobile)) && enableMap) ||
    (viewMode === "observatory" && !!observatory);

  // Périmètre COMPLET chargé PROGRESSIVEMENT — pages de 500 enchaînées par le
  // paginator SDK (indexMin manuel ignoré par le backend), plafond 5000, cache
  // 30 min. Désactivé (searchType: null → aucun appel) dans les autres vues.
  const mapAll = useSearchAllResults({
    queryKeyPrefix: SEARCH_STATIC_MAP_PREFIX,
    searchType: needsAllResults ? searchType : null,
    searchText,
    searchTags,
    mapUsed: true,
    baseParams: mergedBaseParams,
    variant: searchVariant,
  });

  // Conf de liste de la COLONNE LATÉRALE. Densité et pliage doivent passer par
  // `list` et non par la prop `card` : `SearchListView` résout la carte par item
  // (`itemLists[i]?.card ?? card`) et, sans `itemRules`, chaque entrée vaut
  // `list` — une prop `card` y serait systématiquement écrasée.
  const splitList = useMemo(
    () =>
      (splitLayout.compact || splitLayout.collapsible) && list
        ? {
            ...list,
            card: {
              ...list.card,
              ...(splitLayout.compact ? { compact: true } : {}),
              ...(splitLayout.collapsible ? { collapsible: true } : {}),
            },
          }
        : list,
    [splitLayout.compact, splitLayout.collapsible, list],
  );

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
      style={{ "--map-top": `${headerOffsetPx}px` } as React.CSSProperties}
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
                    onClick={() => (viewMode === mapView ? setViewMode("list") : openMapView())}
                  >
                    <Map className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">{mapView === "split" ? t("Liste + carte") : t("Carte")}</span>
                  </Button>
                )}
                {observatoryButtonElement}
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

        {viewMode === "observatory" && observatory ? (
          /* Vue OBSERVATOIRE : les graphes prennent la place de la carte, la
             liste des équipements reste à gauche. Le jeu de résultats est CELUI
             de la carte (`mapAll`) — mêmes filtres, même recherche, même cache :
             les chiffres décrivent toujours ce que la liste montre, et la
             bascule carte ↔ observatoire ne recharge rien.

             L'agencement (KPI en bandeau, deux colonnes, hauteur commandée par
             les graphes) vit dans `ObservatoryPanel` : c'est lui qui porte le
             raffinement, il doit donc pouvoir filtrer la liste comme les
             graphes. Ici ne restent que la barre de bascule, la progression du
             chargement et la liste elle-même. Sur mobile, pas de colonne
             latérale (comme le split carte) : le tableau de bord prend toute la
             largeur. */
          <div className="w-full space-y-6 overflow-y-auto p-4">
            <div className="flex justify-end">{panelViewSwitch("observatory")}</div>

            {/* Progression : le total est connu dès la 1ʳᵉ page. Même forme que
                la page observatoire — pas `MapProgress`, qui est une surcouche
                positionnée SUR une carte et parle de « points ». */}
            {!mapAll.isComplete && mapAll.total !== null && mapAll.loaded > 0 && (
              <div className="space-y-1">
                <Progress
                  value={Math.round((mapAll.loaded / Math.max(mapAll.total, 1)) * 100)}
                  className="h-1.5"
                />
                <p className="text-right text-xs text-muted-foreground tabular-nums">
                  {t("Chargement des données… {{loaded}} / {{total}}", undefined, {
                    loaded: mapAll.loaded,
                    total: mapAll.total,
                  })}
                </p>
              </div>
            )}

            {mapAll.results.length === 0 ? (
              mapAll.isComplete ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  {t("Aucun résultat")}
                </div>
              ) : (
                <Skeleton className="h-[420px] w-full rounded-2xl" />
              )
            ) : (
              /* Suspense local : le chunk du tableau de bord (recharts) ne doit
                 pas faire disparaître la barre de bascule le temps de son
                 téléchargement.

                 Le panneau POSSÈDE le raffinement (sélection d'un équipement,
                 drill-down sur un graphe) : il doit donc commander l'agencement
                 ET la liste — une sélection qui ne toucherait que les graphes,
                 en laissant la liste intacte, n'aurait aucun sens. D'où
                 `renderList` : la section fournit SA liste, le panneau lui
                 passe les entités survivantes. */
              <Suspense fallback={<Skeleton className="h-[420px] w-full rounded-2xl" />}>
                <ObservatoryPanel
                  results={mapAll.results}
                  conf={observatory}
                  animate={mapAll.isComplete}
                  listClass={splitLayout.list}
                  panelClass={splitLayout.map}
                  renderList={
                    isMobile
                      ? undefined
                      : ({ entities, select }) => (
                          <SearchListView
                            results={entities as SearchEntity[]}
                            columns={splitLayout.columns}
                            list={splitList}
                            // `select` fourni (config `observatory.select`) : le clic
                            // sélectionne et la carte gagne son bouton « Fiche ».
                            // Absent : clic = ouverture de la fiche, comme ailleurs.
                            onSelectItem={select ?? undefined}
                          />
                        )
                  }
                />
              </Suspense>
            )}
          </div>
        ) : ((viewMode === "split") || (viewMode === "map" && isSplit)) && enableMap && !isMobile ? (
          /* Mode SPLIT (desktop) : liste (gauche) + carte (droite) SYNCHRONISÉES,
             alimentées par mapAll.results (source UNIQUE → ids alignés). Clic
             carte-liste → flyTo+popup ; clic marqueur → highlight liste. Rendu
             uniquement hors mobile (cf. !isMobile) → côte-à-côte. Hauteur EXPLICITE
             (SPLIT_COLUMN_HEIGHT, l'écran visible sous la barre de navigation) sur
             les deux colonnes : indispensable pour que la carte (`height:100%`) ait
             une référence et que son canvas = la zone visible (sinon fitBounds
             cadre sur une mauvaise taille). */
          /* `px-4 py-4` : sans elle, les deux colonnes collaient au bord haut et
             bas de la fenêtre. La hauteur des colonnes retranche exactement cette
             marge (`- 2rem`) — la section est en `overflow-hidden`, un padding
             ajouté sans compensation ferait rogner le bas de la carte. */
          <div ref={mapViewRef} className="flex w-full gap-4 overflow-hidden px-4 py-4">
            {/* Liste (gauche) — défile dans sa hauteur ; 2 colonnes max (panneau
                étroit), pas les colonnes pleines de la vue liste. */}
            <div className={`${SPLIT_COLUMN_HEIGHT} ${splitLayout.list} overflow-y-auto pr-2`}>
              {!isPending && mapAll.isComplete && splitGeoResults.length === 0 && (
                <div className="py-8 text-center text-secondary-foreground">
                  {t("Aucun résultat trouvé.")}
                </div>
              )}
              <SearchListView
                results={splitGeoResults}
                columns={splitLayout.columns}
                list={splitList}
                focusedItemId={focusedItemId}
                onFocusItem={setFocusedItemId}
              />
            </div>
            {/* Carte (droite) : SPLIT_COLUMN_HEIGHT borne la hauteur → la carte
                embarquée (height:100% via containerClass) la remplit exactement (cf. SearchMap). */}
            <div className={`relative ${SPLIT_COLUMN_HEIGHT} ${splitLayout.map} overflow-hidden rounded shadow`}>
              {/* Bascules de vue (cf. `panelViewSwitch`) : vers l'observatoire
                  s'il est déclaré, et vers la liste — sauf quand le split EST la
                  vue canonique (`defaultViewMode: "split"`), où il n'y a pas de
                  « retour liste » à proposer. */}
              <div className="absolute top-2 right-2 z-50">
                {panelViewSwitch(viewMode === "split" ? "split" : "map")}
              </div>
              <MapProgress
                loaded={mapAll.loaded}
                total={mapAll.total}
                isComplete={mapAll.isComplete}
                capped={mapAll.capped}
              />
              {/* Suspense LOCAL : même raison que dans la vue carte ci-dessous. */}
              {splitGeoResults.length > 0 ? (
                <ClientOnly fallback={<MapSkeleton label={t("Chargement de la carte…")} containerClass={MAP_FILL} />}>
                  {() => (
                    <Suspense fallback={<MapSkeleton label={t("Chargement de la carte…")} containerClass={MAP_FILL} />}>
                      <SearchMapWrapper
                        results={splitGeoResults}
                        card={list?.card}
                        preview={list?.preview}
                        list={list}
                        map={props.map}
                        focusedItemId={focusedItemId}
                        onMarkerFocus={setFocusedItemId}
                        containerClass={MAP_FILL}
                      />
                    </Suspense>
                  )}
                </ClientOnly>
              ) : mapAll.isComplete ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  {t("Aucun résultat")}
                </div>
              ) : (
                <MapSkeleton label={t("Chargement de la carte…")} containerClass={MAP_FILL} />
              )}
            </div>
          </div>
        ) : viewMode === "map" && enableMap ? (
          /* Hauteur EXPLICITE (MAP_VIEW_HEIGHT) : l'écran visible sous la barre
             de navigation. Pas de `flex-1` : dans cette colonne flex sans hauteur
             définie, sa base de 0 % ferait ignorer la hauteur, et la boîte — dont
             la carte est en absolu — s'effondrerait. */
          <div ref={mapViewRef} className={`relative w-full overflow-hidden ${MAP_VIEW_HEIGHT}`}>
            <div className="absolute top-2 right-2 z-50">{panelViewSwitch("map")}</div>

            {/* Progression du chargement par pages + alerte plafond. */}
            <MapProgress
              loaded={mapAll.loaded}
              total={mapAll.total}
              isComplete={mapAll.isComplete}
              capped={mapAll.capped}
            />

            {/* MapSkeleton AVANT la 1ʳᵉ page et pendant le chunk Leaflet, dans la
                MÊME boîte que la carte (MAP_FILL) — sans lui, le clic « Carte »
                donne un cadre vide jusqu'à la 1ʳᵉ page.
                Suspense LOCAL : `SearchMapWrapper` est lazy ; sans lui, c'est la
                frontière de la SECTION (SectionRenderer) qui prend le relais au
                1er affichage — section entière remplacée par un squelette
                d'~100 px, page raccourcie, et le défilement vers la carte
                (`openMapView`) perd sa cible. */}
            {mapAll.results.length > 0 ? (
              <ClientOnly fallback={<MapSkeleton label={t("Chargement de la carte…")} containerClass={MAP_FILL} />}>
                {() => (
                  <Suspense fallback={<MapSkeleton label={t("Chargement de la carte…")} containerClass={MAP_FILL} />}>
                    <SearchMapWrapper
                      results={mapAll.results}
                      card={list?.card}
                      preview={list?.preview}
                      list={list}
                      map={props.map}
                      containerClass={MAP_FILL}
                    />
                  </Suspense>
                )}
              </ClientOnly>
            ) : mapAll.isComplete ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {t("Aucun résultat")}
              </div>
            ) : (
              <MapSkeleton label={t("Chargement de la carte…")} containerClass={MAP_FILL} />
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
              // Ni `container` ni marge latérale : l'en-tête s'aligne sur les bords de la grille
              // de résultats, qui remplit ce même bloc. Un `container` (max 1280) l'aurait rentré
              // de 64 px à 1440 — titre et cartes ne commençaient pas au même bord.
              <div className="flex justify-between items-center mb-3">
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
                      onClick={() => (viewMode === mapView ? setViewMode("list") : openMapView())}
                    >
                      <Map className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">{mapView === "split" ? t("Liste + carte") : t("Carte")}</span>
                    </Button>
                  )}
                  {observatoryButtonElement}
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
