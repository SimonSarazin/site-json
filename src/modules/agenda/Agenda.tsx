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
import { SwitchDetailsMode } from "@/modules/search/components/SwitchDetailsMode";
import SearchListView from "@/modules/search/components/SearchListView";
import { SearchPropsProvider } from "@/modules/search/contexts/SearchPropsProvider";
import type { ListConf, SearchProStaticSectionProps } from "@/modules/search/schema";
import { getEntryCoords } from "@/modules/search/lib/searchMapSelection";
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
  } = props;
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
  const debouncedText = useDebounce(text, 500);
  const typeParam = type || undefined;
  const nameParam = debouncedText || undefined;

  // Projette les filtres dans l'URL (texte débouncé pour ne pas spammer l'historique).
  useEffect(() => {
    setSearchParams(
      (prev) => writeAgendaUrl(prev, { mode, tab, text: debouncedText, type, tags: selectedTags }, urlDefaults),
      { replace: true, preventScrollReset: true },
    );
  }, [mode, tab, debouncedText, type, selectedTags, urlDefaults, setSearchParams]);

  const showText = filters?.text !== false;
  const showType = filters?.type !== false;
  const showTags = filters?.tags === true;

  // Île client : on ne fetch (ni ne rend le contenu data-dépendant) qu'APRÈS hydratation. Le serveur
  // et le 1ᵉʳ render client produisent ainsi le MÊME squelette → pas de mismatch d'hydratation
  // (donc pas de section dupliquée). L'agenda est `now`-relatif → mal adapté au SSR de données.
  const hydrated = useHydrated();

  // Horloge STABLE (react-query staleTime: Infinity) → `now`/bornes constants au re-render,
  // y compris double-invoke StrictMode → queryKey CALENDAR stable (pas de boucle de refetch).
  const { now, upcomingStart, upcomingEnd } = useAgendaClock(upcomingWindowMonths);

  // ── Fetch (gaté par hydratation + mode) — backend searchEventsCostum ────────
  // Liste : À venir/En cours = mode CALENDRIER now→fenêtre ; Passés = mode LISTE paginé.
  const needsEventList = mode === "list" || mode === "map"; // la carte agrège upcoming + past
  const upcomingFetch = useAgendaCalendar({
    rangeStart: upcomingStart,
    rangeEnd: upcomingEnd,
    type: typeParam,
    name: nameParam,
    baseParams,
    enabled: hydrated && needsEventList,
  });
  const pastFetch = useAgendaList({ type: typeParam, name: nameParam, baseParams, enabled: hydrated && needsEventList });
  // Calendrier : plage = mois visible (refetch à la navigation via onRangeChange).
  const [calRange, setCalRange] = useState(() => ({ start: startOfMonth(now), end: endOfMonth(now) }));
  const gridFetch = useAgendaCalendar({
    rangeStart: calRange.start,
    rangeEnd: calRange.end,
    type: typeParam,
    name: nameParam,
    baseParams,
    enabled: hydrated && mode === "calendar",
  });

  // ── Tags disponibles + filtrage client ─────────────────────────────────────
  // Vocabulaire de tags STABLE (M1) : union des tags des events chargés des 3 fetchs
  // (à-venir ∪ passés ∪ grille calendrier), INDÉPENDANT du `mode` → la liste ne se réordonne
  // pas en changeant de vue/de mois, elle ne fait que grandir au fil des chargements. On y
  // inclut TOUJOURS `selectedTags` → un tag actif reste proposable dans toutes les vues (le
  // chip et les options du menu ne divergent jamais). Set + re-tri = liste dédupliquée/triée.
  const availableTags = useMemo(() => {
    const set = new Set<string>([
      ...distinctTags([...upcomingFetch.events, ...pastFetch.events, ...gridFetch.events]),
      ...selectedTags,
    ]);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [upcomingFetch.events, pastFetch.events, gridFetch.events, selectedTags]);

  const { ongoing, upcoming } = useMemo(
    () => partitionByTime(filterByTags(upcomingFetch.events, selectedTags), now),
    [upcomingFetch.events, selectedTags, now],
  );
  const past = useMemo(
    () =>
      filterByTags(
        pastFetch.events.filter((e) => {
          const { start, end } = eventOccurrence(e);
          const eff = end ?? start;
          return eff != null && eff.getTime() < now.getTime();
        }),
        selectedTags,
      ),
    [pastFetch.events, selectedTags, now],
  );
  const calendarEvents = useMemo(() => filterByTags(gridFetch.events, selectedTags), [gridFetch.events, selectedTags]);
  // Carte + liste du split : union dédupliquée upcoming + past, GÉOLOCALISÉS
  // uniquement (mêmes que les marqueurs), filtrée tags. La liste du split partage
  // CETTE source → un event sans coordonnées (que la carte ne peut pas afficher)
  // ne doit pas apparaître dans la liste (sinon item sans marqueur). Le filtre géo
  // utilise `getEntryCoords` — exactement le critère de rendu d'un marqueur.
  const mapEvents = useMemo(() => {
    const seen = new Set<string>();
    const out: typeof past = [];
    for (const ev of [...upcomingFetch.events, ...pastFetch.events]) {
      if (!getEntryCoords(ev as unknown as SearchEntity)) continue; // sans géoloc → ni marqueur ni ligne
      const id = String((ev.serverData as { id?: string } | undefined)?.id ?? "");
      if (id && !seen.has(id)) {
        seen.add(id);
        out.push(ev);
      }
    }
    return filterByTags(out, selectedTags);
  }, [upcomingFetch.events, pastFetch.events, selectedTags]);

  // `limit` (teaser home) : plafonne chaque bucket ; sinon tous (+ « charger plus » pour Passés).
  const cap = (arr: typeof past) => (limit ? arr.slice(0, limit) : arr);
  const buckets: Record<AgendaTab, typeof past> = { ongoing: cap(ongoing), upcoming: cap(upcoming), past: cap(past) };
  const listLoading = tab === "past" ? pastFetch.isLoading : upcomingFetch.isLoading;

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
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          // Teaser (limit) : pas de « charger plus » — on plafonne déjà les buckets.
          hasMorePast={!limit && pastFetch.hasNextPage}
          onLoadMorePast={() => pastFetch.fetchNextPage()}
          loadingMorePast={pastFetch.isFetchingNextPage}
        />
      )}

      {selected && (
        <SwitchDetailsMode openDetails={openDetails} setOpenDetails={setOpenDetails} item={selected} card={card} preview={preview} />
      )}
    </div>
  );
}

export default Agenda;
