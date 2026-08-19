import { Suspense, useEffect, useMemo, useState } from "react";
import { lazy } from "vite-preload";
import { Link, useSearchParams } from "react-router";
import { endOfMonth, startOfMonth } from "date-fns";
import { ArrowRight, CalendarDays, ChevronDown, List, Loader2, MapPin, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { EVENT_TYPES, type SearchEntity } from "@communecter/cocolight-api-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MultiCombobox } from "@/components/ui/multi-combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useDebounce } from "@/hooks/useDebounce";
import { useHydrated } from "@/hooks/useHydrated";
import { useIsMobile } from "@/hooks/use-mobile";
import { useT } from "@/hooks/useT";
import { useLocalization } from "@/hooks/useLocalization";
import { sectionMaxWidthClass } from "@/lib/sectionMaxWidth";
import { SwitchDetailsMode } from "@/modules/search/components/SwitchDetailsMode";
import SearchListView from "@/modules/search/components/SearchListView";
import { SearchPropsProvider } from "@/modules/search/contexts/SearchPropsProvider";
import { usePageFiltersOptional } from "@/modules/search/contexts/pageFilters";
import { searchByFieldsToQuery } from "@/modules/search/lib/searchByFieldsToQuery";
import type { ListConf, SearchProStaticSectionProps } from "@/modules/search/schema";
import { getEntryCoords } from "@/modules/search/lib/searchMapSelection";
import type { AgendaBaseParams } from "./lib/buildAgendaParams";
import AgendaList from "./components/AgendaList";
import { useAgendaCalendar } from "./hooks/useAgendaCalendar";
import { useAgendaList } from "./hooks/useAgendaList";
import { useAgendaClock } from "./hooks/useAgendaClock";
import { partitionByTime } from "./lib/partitionByTime";
import { eventOccurrence } from "./lib/eventDates";
import { distinctTags, filterByTags } from "./lib/eventTags";
import { readAgendaUrl, writeAgendaUrl, type AgendaFilterDefaults, type AgendaMode } from "./lib/agendaUrlParams";
import type { AgendaSectionProps, AgendaTab } from "./schema";

// Défaut STABLE (référence constante) : un `tabs = [...]` en défaut de destructuration crée un
// NOUVEAU tableau à chaque render → `urlDefaults` instable → effet de sync URL en boucle (re-render
// permanent qui empêche l'effet `useHydrated` de commiter). Cf. bug /evenements.
const DEFAULT_TABS: AgendaTab[] = ["upcoming", "ongoing", "past"];
// Split liste+carte : la liste (panneau étroit ~2/5) affiche UNE carte par ligne, comme search
// (cf. configs search en `defaultViewMode: split` → list.columns {1,1,1,1}). Les `columns` de la
// section ne s'appliquent qu'aux vues pleine largeur (liste/teaser). Réf. stable.
const SPLIT_COLUMNS = { sm: 1, md: 1, lg: 1, xl: 1 } as const;

const AgendaCalendar = lazy(() => import("./components/AgendaCalendar"));
const SearchMapWrapper = lazy(() => import("@/modules/search/components/SearchMapWrapper"));

/**
 * Conteneur agenda (event-centré) — SOURCE UNIQUE de données : bascule Liste/Calendrier, filtres
 * (texte + type → backend `searchEventsCostum` ; tags → client), détail au clic. La liste est
 * présentationnelle (AgendaList) ; tout le fetch + filtrage vit ici.
 */
export function Agenda({ props }: { props: AgendaSectionProps }) {
  const { t: tl } = useLocalization();
  const t = useT("modules/agenda");
  const {
    title,
    description,
    defaultMode = "list",
    tabs = DEFAULT_TABS,
    defaultTab = "upcoming",
    upcomingWindowMonths = 12,
    baseParams,
    filters,
    detailsMode = "drawer",
    columns,
    customHeader,
    limit,
    showViewToggle = true,
    showTabs = true,
    enableMap = false,
    mapView = "map",
    map: mapConf,
    maxWidth,
  } = props;
  // `maxWidth` absent → `container` historique (page agenda dédiée). Présent →
  // échelon explicite, pour qu'un teaser s'aligne sur les sections voisines.
  const containerClass = maxWidth
    ? `mx-auto w-full ${sectionMaxWidthClass(maxWidth, "7xl")} px-4 sm:px-6 lg:px-8 py-8`
    : "container mx-auto px-4 sm:px-6 lg:px-8 py-8";
  const isMobile = useIsMobile();
  const isSplit = mapView === "split" && !isMobile; // split = desktop only ; mobile → carte plein écran

  // ── Filtres synchronisés à l'URL (partage/bookmark/retour navigateur) ──────
  const [searchParams, setSearchParams] = useSearchParams();
  const urlDefaults = useMemo<AgendaFilterDefaults>(
    () => ({ mode: defaultMode, tab: tabs.includes(defaultTab) ? defaultTab : tabs[0], tabs }),
    [defaultMode, defaultTab, tabs],
  );
  // Seed UNE fois depuis l'URL au montage (URL identique serveur↔client → état initial cohérent).
  const initial = useMemo(() => readAgendaUrl(searchParams, urlDefaults), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [mode, setMode] = useState<AgendaMode>(initial.mode);
  const [tab, setTab] = useState<AgendaTab>(initial.tab);
  const [text, setText] = useState(initial.text);
  const [type, setType] = useState(initial.type);
  const [selectedTags, setSelectedTags] = useState<string[]>(initial.tags);
  const showText = filters?.text !== false;
  const showType = filters?.type !== false;
  const showTags = filters?.tags === true;

  const pageFilters = usePageFiltersOptional();
  const debouncedText = useDebounce(text, 500);
  const typeParam = type || undefined;
  // Recherche : barre PROPRE de l'agenda (`showText`) OU, si elle est coupée (`filters.text:false`),
  // celle du `searchHeader` sœur via `pageFilters.searchQuery` (déjà débouncée 400ms) — patron
  // identique à `SearchProStatic:234`. → recherche + facettes réunies dans le header (cf. /ressources).
  const nameParam = (showText ? debouncedText : (pageFilters?.searchQuery ?? "")) || undefined;

  // Projette les filtres dans l'URL (texte débouncé). `manageText=showText` : quand la recherche est
  // déléguée au header (showText=false), l'agenda NE touche PAS `q` (le header le possède) → pas de
  // bataille de deux écrivains sur le même paramètre.
  useEffect(() => {
    setSearchParams(
      (prev) =>
        writeAgendaUrl(prev, { mode, tab, text: debouncedText, type, tags: selectedTags }, urlDefaults, {
          text: showText,
          type: showType,
          tags: showTags,
        }),
      { replace: true, preventScrollReset: true },
    );
  }, [mode, tab, debouncedText, type, selectedTags, urlDefaults, setSearchParams, showText, showType, showTags]);

  // ── Facettes de page (générique, comme `useArticleFeed` / `SearchProStatic`) ─────────────────
  // Un `searchHeader`/`filters` SŒUR de la même page écrit dans le PageFilters partagé (provider
  // page-level, toujours monté). Les facettes AVEC `field` (territoires/publics/thèmes) deviennent
  // `{ <field>: { $in:[…] } }` et sont injectées dans `baseParams.filters` (mongo brut) → appliquées
  // CÔTÉ SERVEUR par searchEventsCostum (parité legacy `/co2/search/agenda` → SearchNew::searchFilters,
  // sans whitelist). Hors provider (page `['agenda']` seule) → tout vide = no-op (fil de base).
  // `pageFilters` est déclaré plus haut (aussi lu pour `searchQuery` quand la recherche est déléguée au header).
  const { filters: facetFilters, locality: facetLocality, sourceKeys: facetSourceKeys } = useMemo(
    () => searchByFieldsToQuery(pageFilters?.searchByFields ?? {}),
    [pageFilters?.searchByFields],
  );
  const effectiveBaseParams = useMemo<AgendaBaseParams>(() => {
    const hasFilters = Object.keys(facetFilters).length > 0;
    const hasLocality = Object.keys(facetLocality).length > 0;
    return {
      ...baseParams,
      ...(hasFilters ? { filters: { ...(baseParams?.filters ?? {}), ...facetFilters } } : {}),
      ...(hasLocality ? { locality: { ...(baseParams?.locality ?? {}), ...facetLocality } } : {}),
      ...(facetSourceKeys.length ? { sourceKey: facetSourceKeys } : {}),
    };
  }, [baseParams, facetFilters, facetLocality, facetSourceKeys]);

  // Île client : on ne fetch (ni ne rend le contenu data-dépendant) qu'APRÈS hydratation. Le serveur
  // et le 1ᵉʳ render client produisent ainsi le MÊME squelette → pas de mismatch d'hydratation
  // (donc pas de section dupliquée). L'agenda est `now`-relatif → mal adapté au SSR de données.
  const hydrated = useHydrated();

  // Horloge STABLE (react-query staleTime: Infinity) → `now`/bornes constants au re-render,
  // y compris double-invoke StrictMode → queryKey CALENDAR stable (pas de boucle de refetch).
  const { now, upcomingEnd } = useAgendaClock(upcomingWindowMonths);

  // ── Fetch (gaté par hydratation + mode) — backend searchEventsCostum ────────
  // Liste (les 3 onglets) : UN SEUL flux, mode LISTE paginé — ponctuels ET récurrents (le backend ne
  // renvoie qu'une ligne par récurrent, sa prochaine occurrence), triés par date DÉCROISSANTE. Plus
  // de fetch CALENDRIER dédié à « À venir »/« En cours » (l'ancien `upcomingFetch` sur une fenêtre de
  // 12 mois ramenait une ligne par OCCURRENCE) : le mode LISTE fait le travail côté backend.
  const needsEventList = mode === "list" || mode === "map"; // la carte agrège upcoming + past
  const listFetch = useAgendaList({ type: typeParam, name: nameParam, baseParams: effectiveBaseParams, enabled: hydrated && needsEventList });
  // Calendrier : plage = mois visible (refetch à la navigation via onRangeChange). Toujours en mode
  // CALENDRIER (inchangé) — la grille a besoin d'une case par occurrence dans le mois affiché.
  const [calRange, setCalRange] = useState(() => ({ start: startOfMonth(now), end: endOfMonth(now) }));
  const gridFetch = useAgendaCalendar({
    rangeStart: calRange.start,
    rangeEnd: calRange.end,
    type: typeParam,
    name: nameParam,
    baseParams: effectiveBaseParams,
    enabled: hydrated && mode === "calendar",
  });

  // ── Tags disponibles + filtrage client ─────────────────────────────────────
  // Vocabulaire de tags STABLE (M1) : union des tags des events chargés (flux liste ∪ grille
  // calendrier), INDÉPENDANT du `mode` → la liste ne se réordonne pas en changeant de vue, elle ne
  // fait que grandir au fil des chargements. On y inclut TOUJOURS `selectedTags` → un tag actif
  // reste proposable dans toutes les vues. Set + re-tri = liste dédupliquée/triée.
  const availableTags = useMemo(() => {
    const set = new Set<string>([...distinctTags([...listFetch.events, ...gridFetch.events]), ...selectedTags]);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [listFetch.events, gridFetch.events, selectedTags]);

  // Vue LISTE : une entrée par event — le backend ne renvoie qu'une occurrence par récurrent en mode
  // LISTE (une ligne par event, pas de déduplication côté client nécessaire).
  const { ongoing, upcoming } = useMemo(() => {
    const buckets = partitionByTime(filterByTags(listFetch.events, selectedTags), now);
    // `upcomingWindowMonths` (contrat de la prop, inchangé) : borne haute de « À venir ». Le flux
    // brut est trié décroissant côté backend (adapté à « Passés ») → remis croissant (le plus
    // proche d'abord) pour l'affichage.
    const withinWindow = buckets.upcoming.filter((e) => {
      const { start } = eventOccurrence(e);
      return start != null && start.getTime() <= upcomingEnd.getTime();
    });
    return { ongoing: buckets.ongoing, upcoming: withinWindow.reverse() };
  }, [listFetch.events, selectedTags, now, upcomingEnd]);
  const past = useMemo(
    () =>
      filterByTags(
        listFetch.events.filter((e) => {
          const { start, end } = eventOccurrence(e);
          const eff = end ?? start;
          return eff != null && eff.getTime() < now.getTime();
        }),
        selectedTags,
      ),
    [listFetch.events, selectedTags, now],
  );
  const calendarEvents = useMemo(() => filterByTags(gridFetch.events, selectedTags), [gridFetch.events, selectedTags]);
  // Carte + liste du split : GÉOLOCALISÉS uniquement (mêmes que les marqueurs), filtrée tags — même
  // flux liste que ongoing/upcoming/past (passés non bornés, comme avant ; futurs bornés à
  // `upcomingWindowMonths`, même contrat que le bucket « upcoming »). Le filtre géo utilise
  // `getEntryCoords` — exactement le critère de rendu d'un marqueur.
  const mapEvents = useMemo(() => {
    const geolocated = listFetch.events.filter((ev) => {
      if (!getEntryCoords(ev as unknown as SearchEntity)) return false; // sans géoloc → ni marqueur ni ligne
      const { start } = eventOccurrence(ev);
      return start == null || start.getTime() < now.getTime() || start.getTime() <= upcomingEnd.getTime();
    });
    return filterByTags(geolocated, selectedTags);
  }, [listFetch.events, selectedTags, now, upcomingEnd]);

  // `limit` (teaser home) : plafonne chaque bucket ; sinon tous (+ « charger plus », flux partagé).
  const cap = (arr: typeof past) => (limit ? arr.slice(0, limit) : arr);
  const buckets: Record<AgendaTab, typeof past> = { ongoing: cap(ongoing), upcoming: cap(upcoming), past: cap(past) };
  const listLoading = listFetch.isLoading;

  // ── Détail au clic (partagé liste/calendrier) ──────────────────────────────
  const [openDetails, setOpenDetails] = useState(false);
  const [selected, setSelected] = useState<SearchEntity | null>(null);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null); // synchro liste↔carte (split)
  const card = useMemo<ListConf["card"]>(() => ({ type: "event", detailsMode }), [detailsMode]);
  const preview = useMemo<ListConf["preview"]>(() => ({ type: "event" }), []);
  // La carte de search lit `inSection` via useSearchProps → fournir le provider (sinon throw).
  const searchProps = useMemo(
    () => ({ list: { card, preview, columns } }) as unknown as SearchProStaticSectionProps,
    [card, preview, columns],
  );
  const toggleTag = (tag: string) =>
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]));

  // ── Barre de filtres (alignée sur search : pas de label, h-11/rounded-xl/bg-muted,
  //     inline ≥ lg, repliée dans un Sheet bas en mobile) ─────────────────────
  const [filtersOpen, setFiltersOpen] = useState(false);
  const hasFilters = showType || showTags;
  const activeFilterCount = (type ? 1 : 0) + selectedTags.length;
  const TYPE_ALL = "__all__"; // Radix Select interdit value="" → sentinelle « Tous ».

  const renderTypeSelect = () => (
    <Select value={type === "" ? TYPE_ALL : type} onValueChange={(v) => setType(v === TYPE_ALL ? "" : v)}>
      <SelectTrigger className="h-11! w-full rounded-xl border-border bg-muted/60! text-foreground shadow-sm hover:border-primary/50 hover:bg-muted! dark:bg-muted/50! dark:hover:bg-muted/70! lg:w-auto lg:min-w-[170px]">
        <SelectValue placeholder={t("filters.allTypes")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TYPE_ALL}>{t("filters.allTypes")}</SelectItem>
        {EVENT_TYPES.map((evType) => (
          <SelectItem key={evType} value={evType}>{t(`eventType.${evType}`)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  // Tags : multi-select (réutilise `MultiCombobox` ui/, comme les filtres de search) au lieu d'une
  // rangée de chips-toggle → unité de style (dropdown shadcn aligné sur le type, même hauteur).
  const renderTagsSelect = () =>
    availableTags.length > 0 ? (
      <MultiCombobox
        options={availableTags.map((tag) => ({ id: tag, label: tag }))}
        selected={selectedTags}
        onToggle={toggleTag}
        allLabel={t("filters.allTags")}
        onClear={() => setSelectedTags([])}
        // Les tags viennent des événements chargés : leur nombre suit les données, pas une config.
        searchPlaceholder={t("filters.searchValue")}
        noResultLabel={t("filters.noResult")}
        moreLabel={(n) => t("filters.more", undefined, { count: n })}
        contentClassName="w-72"
      >
        <Button
          variant="outline"
          className="h-11! w-full justify-between rounded-xl border-border bg-muted/60! px-3 font-normal text-foreground shadow-sm hover:border-primary/50 hover:bg-muted! hover:text-foreground dark:bg-muted/50! dark:hover:bg-muted/70! lg:w-auto lg:min-w-[150px] lg:max-w-full"
        >
          <span className="truncate">
            {selectedTags.length === 0
              ? t("filters.tags")
              : selectedTags.length === 1
                ? selectedTags[0]
                : `${selectedTags.length} ${t("filters.tags").toLowerCase()}`}
          </span>
          <ChevronDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </MultiCombobox>
    ) : null;

  return (
    <div className={containerClass}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          {(customHeader?.title ?? title) && (
            <h2 className="text-2xl font-bold text-foreground">{tl(customHeader?.title ?? title!)}</h2>
          )}
          {description && <p className="text-muted-foreground mt-1">{tl(description)}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Lien « voir tous » (teaser → page complète, ex. home → /evenements) */}
          {customHeader?.linkText && customHeader?.linkHref && (
            <Button asChild variant="outline" size="sm" className="text-foreground">
              <Link to={customHeader.linkHref}>
                {customHeader.linkIcon ? (
                  <DynamicIcon name={customHeader.linkIcon as IconName} className="h-4 w-4 sm:mr-1" />
                ) : (
                  <ArrowRight className="h-4 w-4 sm:mr-1" />
                )}
                <span className="hidden sm:inline">{tl(customHeader.linkText)}</span>
              </Link>
            </Button>
          )}
          {showViewToggle && (
            <div className="flex gap-1">
              <Button variant={mode === "list" ? "default" : "outline"} size="sm" onClick={() => setMode("list")}>
                <List className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">{t("view.list")}</span>
              </Button>
              {/* Préchauffe le chunk au survol/focus (vite-preload `.preload()`) → pas de
                  flash de squelette au 1ᵉʳ basculement vers la vue. */}
              <Button
                variant={mode === "calendar" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("calendar")}
                onMouseEnter={() => AgendaCalendar.preload()}
                onFocus={() => AgendaCalendar.preload()}
              >
                <CalendarDays className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">{t("view.calendar")}</span>
              </Button>
              {enableMap && (
                <Button
                  variant={mode === "map" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode("map")}
                  onMouseEnter={() => SearchMapWrapper.preload()}
                  onFocus={() => SearchMapWrapper.preload()}
                >
                  <MapPin className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">{isSplit ? t("view.mapSplit") : t("view.map")}</span>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {(showText || hasFilters) && (
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          {showText && (
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t("filters.searchPlaceholder")}
                className="h-11 rounded-xl border-border bg-muted/60! pl-12 text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 dark:bg-muted/50!"
              />
            </div>
          )}

          {hasFilters && (
            <>
              {/* Desktop : type + tags inline (dropdowns shadcn, même hauteur que la recherche) */}
              {showType && <div className="hidden shrink-0 lg:block">{renderTypeSelect()}</div>}
              {showTags && <div className="hidden shrink-0 lg:block">{renderTagsSelect()}</div>}

              {/* Desktop : compteur + Réinitialiser inline (comme SearchHeaderSection) */}
              {activeFilterCount > 0 && (
                <div className="hidden shrink-0 items-center gap-2 lg:flex">
                  <Badge className="rounded-full px-2">{activeFilterCount}</Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { setType(""); setSelectedTags([]); }}
                    className="h-9 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="h-3 w-3" /> {t("filters.reset")}
                  </Button>
                </div>
              )}

              {/* Mobile : bouton « Filtres » → Sheet bas (type + tags) */}
              <div className="w-full lg:hidden">
                <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-11 w-full justify-between rounded-xl border-border bg-muted/60! px-3 text-foreground shadow-sm hover:bg-muted! dark:bg-muted/50!"
                    >
                      <span className="flex items-center gap-2">
                        <SlidersHorizontal className="h-4 w-4" />
                        {t("filters.title")}
                      </span>
                      {activeFilterCount > 0 && <Badge className="ml-2 rounded-full px-2">{activeFilterCount}</Badge>}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="max-h-[85vh] gap-0 rounded-t-2xl p-0">
                    <SheetHeader className="border-b border-border">
                      <SheetTitle className="flex items-center gap-2">
                        <SlidersHorizontal className="h-5 w-5 text-primary" />
                        {t("filters.title")}
                      </SheetTitle>
                    </SheetHeader>
                    <div className="flex flex-col gap-4 overflow-y-auto p-4">
                      {showType && (
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs font-medium text-muted-foreground">{t("filters.typeLabel")}</span>
                          {renderTypeSelect()}
                        </div>
                      )}
                      {showTags && availableTags.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs font-medium text-muted-foreground">{t("filters.tags")}</span>
                          {renderTagsSelect()}
                        </div>
                      )}
                    </div>
                    <SheetFooter className="flex-row gap-2 border-t border-border">
                      {activeFilterCount > 0 && (
                        <Button variant="ghost" className="flex-1" onClick={() => { setType(""); setSelectedTags([]); }}>
                          {t("filters.reset")}
                        </Button>
                      )}
                      <SheetClose asChild>
                        <Button className="flex-1">{t("filters.apply")}</Button>
                      </SheetClose>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>
              </div>
            </>
          )}
        </div>
      )}

      {/* Chips de filtres actifs (type + tags), supprimables — même encart « pilulier » que
          SearchHeaderSection (rounded-2xl + bg-card/80 + shadow + backdrop, badges rounded-full
          + X rond). Affiché uniquement quand un filtre est actif ; mb-6 → ne colle pas aux tabs. */}
      {((showType && !!type) || (showTags && selectedTags.length > 0)) && (
        <div className="mt-2 mb-6 flex flex-wrap gap-2 rounded-2xl border border-border/60 bg-card/80 px-3 py-2 shadow-lg backdrop-blur-md">
          {showType && type && (
            <Badge className="gap-1 rounded-full py-1 pe-1">
              {t(`eventType.${type}`)}
              <button
                type="button"
                onClick={() => setType("")}
                className="-me-0.5 ml-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-primary-foreground/15 hover:text-primary-foreground/80"
                aria-label={`Supprimer ${t(`eventType.${type}`)}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </Badge>
          )}
          {showTags &&
            selectedTags.map((tag) => (
              <Badge key={tag} className="gap-1 rounded-full py-1 pe-1">
                {tag}
                <button
                  type="button"
                  onClick={() => setSelectedTags((prev) => prev.filter((x) => x !== tag))}
                  className="-me-0.5 ml-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-primary-foreground/15 hover:text-primary-foreground/80"
                  aria-label={`Supprimer ${tag}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </Badge>
            ))}
        </div>
      )}

      {!hydrated ? (
        // Squelette identique serveur ↔ 1ᵉʳ render client → hydratation propre, puis montage du contenu.
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : mode === "calendar" ? (
        <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
          <AgendaCalendar
            events={calendarEvents}
            onEventClick={(ev) => {
              setSelected(ev as unknown as SearchEntity);
              setOpenDetails(true);
            }}
            onRangeChange={(s, e) => setCalRange({ start: s, end: e })}
          />
        </Suspense>
      ) : mode === "map" ? (
        // Vue CARTE : réutilise SearchMapWrapper (lazy/client-only) ; clic marqueur → même détail (card/preview).
        // `split` (desktop) : liste (gauche) + carte (droite) SYNCHRONISÉES via focusedItemId (clic carte → flyTo,
        // clic marqueur → highlight) — même source mapEvents → ids alignés. Sinon carte plein écran.
        // SearchPropsProvider : la carte de search lit `inSection` via useSearchProps.
        <SearchPropsProvider props={searchProps} inSection>
        {isSplit ? (
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="md:h-[78vh] md:w-2/5 md:overflow-y-auto">
              {mapEvents.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">{t("calendar.noEvents")}</div>
              ) : (
                <SearchListView
                  results={mapEvents as unknown as SearchEntity[]}
                  columns={SPLIT_COLUMNS}
                  card={card}
                  preview={preview}
                  focusedItemId={focusedItemId}
                  onFocusItem={setFocusedItemId}
                />
              )}
            </div>
            <div className="relative h-[55vh] overflow-hidden rounded-xl border border-border shadow-sm md:sticky md:top-20 md:h-[78vh] md:w-3/5">
              <Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
                <SearchMapWrapper
                  results={mapEvents as unknown as SearchEntity[]}
                  card={card}
                  preview={preview}
                  map={mapConf ?? { marker: { useItemImage: true, style: "pin", color: "primary" } }}
                  focusedItemId={focusedItemId}
                  onMarkerFocus={setFocusedItemId}
                  containerClass="absolute inset-0 z-10 rounded-xl"
                />
              </Suspense>
            </div>
          </div>
        ) : (
          <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <SearchMapWrapper
              results={mapEvents as unknown as SearchEntity[]}
              card={card}
              preview={preview}
              map={mapConf ?? { marker: { useItemImage: true, style: "pin", color: "primary" } }}
            />
          </Suspense>
        )}
        </SearchPropsProvider>
      ) : (
        <AgendaList
          tab={tab}
          onTabChange={setTab}
          tabs={tabs}
          buckets={buckets}
          loading={listLoading}
          card={card}
          preview={preview}
          columns={columns}
          showTabs={showTabs}
          // Teaser (limit) : pas de « charger plus » — on plafonne déjà les buckets. Flux partagé
          // par les 3 onglets (mode LISTE unique) → disponible quel que soit l'onglet actif.
          hasMore={!limit && listFetch.hasNextPage}
          onLoadMore={() => listFetch.fetchNextPage()}
          loadingMore={listFetch.isFetchingNextPage}
        />
      )}

      {selected && (
        <SwitchDetailsMode openDetails={openDetails} setOpenDetails={setOpenDetails} item={selected} card={card} preview={preview} />
      )}
    </div>
  );
}

export default Agenda;
