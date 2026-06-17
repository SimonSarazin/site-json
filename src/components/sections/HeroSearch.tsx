import { T } from "@/components/ui/T";
import { useLocalization } from "@/hooks/useLocalization";
import { useState, useRef, useEffect, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { HeroBackgroundImage } from "./HeroBackgroundImage";

import { HeroSearchProps as SchemaHeroSearchProps } from "@/types/site-schema";
import { useAutocomplete } from "@/modules/search/hooks/useAutocomplete";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { cn } from "@/lib/utils";
import { Link, useSearchParams, useNavigate } from "react-router";
import { usePageFiltersOptional } from "@/modules/search/contexts/pageFilters";
import type { SearchBaseParamsInput } from "@/modules/search/lib/buildSearchPayload";
import { searchByFieldsToQuery } from "@/modules/search/lib/searchByFieldsToQuery";
import { canonicalSearchProStaticBaseParams } from "@/modules/search/lib/canonicalBaseParams";
import { usePageFiltersUrlSync } from "@/modules/search/hooks/usePageFiltersUrlSync";
import { getEntityIcon } from "@/lib/entityIcons";

const getEntityTitle = (entity: SearchEntity): string => {

  if (entity.serverData?.name) {
    return String(entity.serverData.name);
  }

  if (entity.serverData?.title) {
    return String(entity.serverData.title);
  }

  return "Sans titre";
};

const getEntityAddress = (entity: SearchEntity): string | null => {

  if (entity.serverData?.address) {
    const addr = entity.serverData.address;
    if (typeof addr === 'string') return addr;
    if (typeof addr === 'object' && 'addressLocality' in addr) {
      const parts = [
        'postalCode' in addr ? addr.postalCode : undefined,
        addr.addressLocality,
      ].filter(Boolean);
      return parts.join(" ");
    }
  }

  return null;
};

const getEntityId = (entity: SearchEntity, index: number): string => {
  if (entity?.id) {
    return String(entity.id);
  }

  return `entity-${index}`;
};

interface HeroSearchProps {
  id?: string;
  props: SchemaHeroSearchProps;
}

type HeroSearchCtaButton = NonNullable<SchemaHeroSearchProps["ctaButtons"]>[number];

/** `true` si tous les filtres déclarés par le bouton sont présents dans l'URL. */
const buttonMatchesParams = (btn: HeroSearchCtaButton, searchParams: URLSearchParams): boolean => {
  if (!btn.filters?.length) return false;
  return btn.filters.every((f) => {
    const raw = searchParams.get(f.param);
    if (!raw) return false;
    const present = raw.split(",").map((v) => v.trim());
    return f.values.every((v) => present.includes(v));
  });
};

export function HeroSearch({ id, props }: HeroSearchProps) {
  const { t } = useLocalization();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const headline = props.headline;
  const subhead = props.subhead;
  const [search, setSearch] = useState("");
  // L'ouverture du dropdown est DÉRIVÉE (suggestions présentes + saisie ≥ 2),
  // pas synchronisée par effet (règle set-state-in-effect). `dismissed`
  // mémorise une fermeture explicite (Échap, clic dehors, sélection,
  // recherche) et se réarme à la saisie ou au focus.
  const [dismissed, setDismissed] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const ctaButtons = useMemo(() => props.ctaButtons ?? [], [props.ctaButtons]);

  // Params gérés par les boutons de CE hero — seuls ceux-là sont effacés/posés
  // (les autres query params de la page sont préservés).
  const managedParams = useMemo(() => {
    const set = new Set<string>();
    ctaButtons.forEach((btn) => btn.filters?.forEach((f) => set.add(f.param)));
    return set;
  }, [ctaButtons]);

  // Bouton actif = dérivé des query params (URL = source de vérité, comme /lieux).
  // Sans correspondance, le premier bouton « reset » (sans filters ni href) est actif.
  const activeTabIndex = useMemo(() => {
    const matched = ctaButtons.findIndex((btn) => buttonMatchesParams(btn, searchParams));
    if (matched >= 0) return matched;
    return ctaButtons.findIndex((btn) => !btn.filters?.length && !btn.href);
  }, [ctaButtons, searchParams]);

  // Boutons proposables dans le <select> du mode compact (`href` = navigation, exclus).
  const selectableButtons = useMemo(
    () => ctaButtons.map((btn, idx) => ({ btn, idx })).filter(({ btn }) => !btn.href),
    [ctaButtons],
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const pageFilters = usePageFiltersOptional();

  // Applicateur headless : ?typologies=/?services= → état PageFilters (comme /lieux).
  // `id` = id de la section → même queryKey que le prefetch SSR (cf. findFiltersSections).
  usePageFiltersUrlSync({
    id,
    filterGroups: props.filterGroups,
    filtersByAnswers: props.filtersByAnswers,
  });

  // Applique les filtres d'un bouton : efface les params gérés puis pose les
  // siens (format pluriel `?param=v1,v2` — celui de `computeFiltersFromUrl`).
  // Bouton sans `filters` = réinitialisation (état « tous »).
  const applyButtonFilters = (btn: HeroSearchCtaButton | undefined) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      managedParams.forEach((param) => next.delete(param));
      btn?.filters?.forEach((f) => next.set(f.param, f.values.join(",")));
      return next;
    });
  };

  // CTA : `href` → navigation (ex. recherche complète) ; sinon filtre la page.
  const handleCta = (idx: number) => {
    const btn = ctaButtons[idx];
    if (btn?.href) {
      navigate(btn.href);
    } else {
      applyButtonFilters(btn);
    }
  };

  // Filtres actifs (tags + searchByFields) → mêmes inputs que la liste, pour que
  // l'autocomplete interroge le MÊME périmètre que /lieux (catégorie comprise).
  const selectedFilters = pageFilters?.selectedFilters;
  const searchByFields = pageFilters?.searchByFields;
  const activeTags = useMemo(
    () => Object.values(selectedFilters ?? {}).flat() as string[],
    [selectedFilters],
  );
  const { filters, locality, sourceKeys } = useMemo(
    () => searchByFieldsToQuery(searchByFields ?? {}),
    [searchByFields],
  );
  const mergedBaseParams = useMemo(() => {
    const merged = canonicalSearchProStaticBaseParams(
      (props.baseParams ?? {}) as Record<string, unknown>,
      filters,
      locality,
    );
    if (sourceKeys.length > 0) {
      merged.sourceKey = sourceKeys;
      delete merged.notSourceKey;
    }
    return merged;
  }, [props.baseParams, filters, locality, sourceKeys]);

  const autocompleteOptions = useMemo(() => ({
    // Même périmètre que la liste : baseParams réseau + filtres actifs (tags +
    // searchByFields) + variant → suggestions cohérentes avec la tab/catégorie.
    baseParams: mergedBaseParams as SearchBaseParamsInput,
    variant: props.searchVariant,
    tags: activeTags,
    indexMax: 8,
  }), [mergedBaseParams, props.searchVariant, activeTags]);

  const { suggestions, isLoading } = useAutocomplete(search, autocompleteOptions);

  const isAutocompleteOpen = !dismissed && suggestions.length > 0 && search.length >= 2;

  const isFullStyle = props.ctaButtons && props.ctaButtons.length > 0 && props.subhead;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setDismissed(true);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /**
   * Lance la recherche : pousse le texte saisi dans le contexte `PageFilters`
   * (→ le `searchProStatic` de la page filtre la liste) puis scrolle vers
   * `props.scrollTarget` (id de la section résultats — pas de scroll si absent).
   * Déclenché par le bouton « Rechercher » et par Entrée.
   */
  const triggerSearch = () => {
    pageFilters?.setSearchQuery(search);
    setDismissed(true);
    if (props.scrollTarget && typeof document !== "undefined") {
      document.getElementById(props.scrollTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isAutocompleteOpen) {
      // Pas de suggestion ouverte → Entrée lance la recherche sur la liste.
      if (e.key === "Enter") {
        e.preventDefault();
        triggerSearch();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        if (suggestions[highlightedIndex]) {
          handleSelectSuggestion(suggestions[highlightedIndex]);
        }
        break;
      case "Escape":
        setDismissed(true);
        break;
    }
  };

  const handleSelectSuggestion = (item: SearchEntity) => {
    const title = getEntityTitle(item);
    setSearch(title);
    // `dismissed` reste vrai quand les suggestions du titre sélectionné
    // arrivent — l'ancien effet rouvrait le dropdown juste après la sélection.
    setDismissed(true);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setDismissed(false);
    setHighlightedIndex(0);
    // Champ vidé → on réinitialise la recherche de la liste (sinon elle reste
    // filtrée sur l'ancien texte tant qu'on ne reclique pas « Rechercher »).
    if (value === "" && pageFilters?.searchQuery) {
      pageFilters.setSearchQuery("");
    }
  };

  if (!isFullStyle) {
    return (
      <section className="relative min-h-112.5 md:min-h-125 flex flex-col -mt-10">
        <div className="relative z-10 flex-1 flex items-center justify-center">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="max-w-6xl mx-auto">
              <div
                className="bg-card/80 backdrop-blur-md rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 md:p-8 border border-border"
                style={{
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)'
                }}
              >
                <T k={headline} as="h1" className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground/80 mb-2 sm:mb-3 text-center px-2" />

                <div className="relative">
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 shadow-xl rounded-2xl sm:rounded-full overflow-hidden">
                    {selectableButtons.length > 0 && (
                      <div className="relative w-full sm:w-auto">
                        {/* Mêmes boutons que le mode complet, en <select> compact
                            (les boutons `href` — navigation — sont exclus). */}
                        <select
                          value={activeTabIndex >= 0 ? String(activeTabIndex) : ""}
                          onChange={(e) => handleCta(Number(e.target.value))}
                          className="h-full w-full sm:w-auto pl-4 sm:pl-6 pr-10 py-3 sm:py-4 bg-background text-foreground text-sm sm:text-base font-medium focus:outline-none appearance-none cursor-pointer sm:border-r border-border rounded-t-2xl sm:rounded-none"
                          style={{ minWidth: '0', }}
                        >
                          {selectableButtons.map(({ btn, idx }) => (
                            <option key={idx} value={String(idx)}>
                              {t(btn.label)}
                            </option>
                          ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                          <svg className="w-4 h-4 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    )}

                    <div className="relative flex-1">
                      <input
                        ref={inputRef}
                        type="text"
                        value={search}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => setDismissed(false)}
                        placeholder={props.placeholder ? t(props.placeholder) : "Nom, ville, département ..."}
                        className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-card text-foreground text-sm sm:text-base focus:outline-none"
                      />
                      {isLoading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                          <Loader2 className="h-4 w-5 sm:h-5 sm:w-5 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    <button type="button" onClick={triggerSearch} className="px-4 sm:px-8 py-3 sm:py-4 bg-primary text-primary-foreground text-sm sm:text-base font-semibold hover:bg-primary/90 transition flex items-center justify-center gap-2 rounded-b-2xl sm:rounded-none">
                      <span className="hidden sm:inline">{props.searchButtonText ? t(props.searchButtonText) : "Rechercher"}</span>
                      <span className="sm:hidden">{props.searchButtonText ? t(props.searchButtonText) : "Rechercher"}</span>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </button>
                  </div>

                  {isAutocompleteOpen && suggestions.length > 0 && (
                    <div
                      ref={dropdownRef}
                      className="absolute top-full left-0 right-0 mt-2 bg-popover rounded-xl shadow-2xl border border-border max-h-96 overflow-y-auto z-50"
                    >
                      {suggestions.map((item, index) => {
                        const title = getEntityTitle(item);
                        const address = getEntityAddress(item);
                        const id = getEntityId(item, index);

                        return (
                          <button
                            key={id}
                            onClick={() => handleSelectSuggestion(item)}
                            onMouseEnter={() => setHighlightedIndex(index)}
                            className={cn(
                              "w-full px-4 py-3 flex items-start gap-3 hover:bg-accent transition-colors text-left border-b border-border last:border-b-0",
                              highlightedIndex === index && "bg-accent"
                            )}
                          >
                            <div className="mt-1">{getEntityIcon(item?.getEntityType?.() || "", { className: "h-4 w-4", withColor: true })}</div>
                            <Link to={`/profil/${item.slug}`}>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-popover-foreground truncate">
                                  {title}
                                </div>
                                {address && (
                                  <div className="text-sm text-muted-foreground truncate">
                                    {address}
                                  </div>
                                )}
                              </div>
                            </Link>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {props.backgroundImage && (
          <div className="absolute bottom-0 left-0 right-0 h-64 overflow-hidden">
            <HeroBackgroundImage
              src={props.backgroundImage}
              position="top"
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="relative min-h-112.5 md:min-h-125 flex flex-col -mt-10">
      <div className="relative z-10 flex-1 flex items-center justify-center">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-6xl mx-auto">
            <div
              className="bg-card/80 backdrop-blur-md rounded-2xl sm:rounded-3xl shadow-2xl p-2 sm:p-3 md:p-4 border border-border"
              style={{
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)'
              }}
            >
              <T k={headline} as="h1" className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground/80 mb-2 sm:mb-3 text-center px-2" />

              {subhead && (
                <T k={subhead} as="p" className="text-center text-primary font-extralight text-sm sm:text-base italic mb-4 sm:mb-6 px-4" />
              )}

              <div className="flex justify-center space-x-1 mb-4 sm:mb-6 text-xs sm:text-sm flex-wrap gap-y-2 px-2">
                {props.ctaButtons?.map((btn, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleCta(idx)}
                    className={`px-3 sm:px-6 py-2 sm:py-3 font-semibold transition ${activeTabIndex === idx
                      ? "border-b-4 border-primary text-primary-foreground bg-primary rounded-t-md"
                      : "hover:bg-muted"
                      }`}
                  >
                    <T k={btn.label} />
                  </button>
                ))}
              </div>

              <div className="relative">
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 shadow-xl rounded-2xl sm:rounded-full overflow-hidden">
                  <div className="relative flex-1">
                    <input
                      ref={inputRef}
                      type="text"
                      value={search}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onFocus={() => setDismissed(false)}
                      placeholder={props.placeholder ? t(props.placeholder) : "Ville, département ..."}
                      className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-card text-foreground text-sm sm:text-base focus:outline-none rounded-t-2xl sm:rounded-l-full sm:rounded-r-none"
                    />
                    {isLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <Loader2 className="h-4 w-5 sm:h-5 sm:w-5 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  <button type="button" onClick={triggerSearch} className="px-4 sm:px-8 py-3 sm:py-4 bg-primary text-primary-foreground text-sm sm:text-base font-semibold hover:bg-primary/90 transition flex items-center justify-center gap-2 rounded-b-2xl sm:rounded-r-full sm:rounded-l-none">
                    <span className="hidden sm:inline">{props.searchButtonText ? t(props.searchButtonText) : "Rechercher"}</span>
                    <span className="sm:hidden">{props.searchButtonText ? t(props.searchButtonText) : "Rechercher"}</span>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </button>
                </div>

                {isAutocompleteOpen && suggestions.length > 0 && (
                  <div
                    ref={dropdownRef}
                    className="absolute top-full left-0 right-0 mt-2 bg-popover rounded-xl shadow-2xl border border-border max-h-96 overflow-y-auto z-50"
                  >
                    {suggestions.map((item, index) => {
                      const title = getEntityTitle(item);
                      const address = getEntityAddress(item);
                      const id = getEntityId(item, index);

                      return (
                        <button
                          key={id}
                          onClick={() => handleSelectSuggestion(item)}
                          onMouseEnter={() => setHighlightedIndex(index)}
                          className={cn(
                            "w-full px-4 py-3 flex items-start gap-3 hover:bg-accent transition-colors text-left border-b border-border last:border-b-0",
                            highlightedIndex === index && "bg-accent"
                          )}
                        >
                          <div className="mt-1">{getEntityIcon(item?.getEntityType?.() || "", { className: "h-4 w-4", withColor: true })}</div>
                          <Link to={`/profil/${item.slug}`}>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-popover-foreground truncate">
                                {title}
                              </div>
                              {address && (
                                <div className="text-sm text-muted-foreground truncate">
                                  {address}
                                </div>
                              )}
                            </div>
                          </Link>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {props.backgroundImage && (
        <div className="absolute -bottom-10 left-0 right-0 h-64 overflow-hidden">
          <HeroBackgroundImage
            src={props.backgroundImage}
            position="top"
            className="w-full h-full object-cover"
          />
        </div>
      )}
    </section>
  );
}
export default HeroSearch;
