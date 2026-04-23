import { T } from "@/components/ui/T";
import { useLocalization } from "@/hooks/useLocalization";
import { useState, useRef, useEffect, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { OptimizedImage } from "@/components/ui/OptimizedImage";

import { HeroTiersLieuxProps as SchemaHeroTiersLieuxProps } from "@/types/site-schema";
import { useAutocomplete } from "@/hooks/useAutocomplete";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { cn } from "@/lib/utils";
import { GlobalAutocompleteCostumData } from "@communecter/cocolight-api-client";
import { Link, useSearchParams, useLocation } from "react-router";
import { usePageFiltersOptional } from "@/contexts/PageFiltersContext";
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

interface HeroTiersLieuxProps {
  id?: string;
  props: SchemaHeroTiersLieuxProps;
}

const CATEGORY_TO_FILTERS: Record<string, { group: string; names: string[] }> = {
  all: { group: "", names: [] },
  coworking: { group: "typologies", names: ["Bureaux partagés / Coworking"] },
  fablab: { group: "typologies", names: ["Fablab / Makerspace / Hackerspace (Espaces du Faire)"] },
  meeting: { group: "tags", names: ["Salle de réunion"] },
  food: { group: "typologies", names: ["Cuisine partagée / Foodlab"] },
  learn: { group: "typologies", names: ["Tiers-lieu nourricier"] },
  stay: { group: "typologies", names: ["Tiers-lieu nourricier"] },
};

const URL_TYPOLOGY_TO_CATEGORY: Record<string, string> = {
  coworking: "coworking",
  fablab: "fablab",
  foodlab: "food",
  livinglab: "learn",
  nourricier: "stay",
};

const TAB_INDEX_TO_CATEGORY = ["all", "meeting", "coworking", "fablab", "food", "learn", "stay", "all"];

export function HeroTiersLieux({ props }: HeroTiersLieuxProps) {
  const { t } = useLocalization();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isSubsite = location.pathname.startsWith("/s/");

  const headline = isSubsite && props.headlineSubsite ? props.headlineSubsite : props.headline;
  const subhead = isSubsite && props.subheadSubsite ? props.subheadSubsite : props.subhead;
  // Initialiser la catégorie depuis les query params de l'URL
  const initialCategory = useMemo(() => {
    const typology = searchParams.get("typologies");
    if (typology && URL_TYPOLOGY_TO_CATEGORY[typology]) {
      return URL_TYPOLOGY_TO_CATEGORY[typology];
    }
    const services = searchParams.get("services");
    if (services) {
      return "meeting";
    }
    return "all";
  }, [searchParams]);

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const pageFilters = usePageFiltersOptional();

  const autocompleteOptions = useMemo(() => ({
    searchTypes: ["NGO", "LocalBusiness", "Group", "GovernmentOrganization", "Cooperative", "organizations", "projects", "events", "citoyens", "poi"] as GlobalAutocompleteCostumData["searchType"],
    indexMax: 30,
  }), []);

  const { suggestions, isLoading } = useAutocomplete(search, autocompleteOptions);

  const isFullStyle = props.ctaButtons && props.ctaButtons.length > 0 && props.subhead;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsAutocompleteOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (suggestions.length > 0 && search.length >= 2) {
      setIsAutocompleteOpen(true);
      setHighlightedIndex(0);
    } else {
      setIsAutocompleteOpen(false);
    }
  }, [suggestions, search]);

  useEffect(() => {
    if (pageFilters?.setSelectedFilters) {
      const mapping = CATEGORY_TO_FILTERS[selectedCategory];
      if (mapping && mapping.group && mapping.names.length > 0) {
        pageFilters.setSelectedFilters({ [mapping.group]: mapping.names });
      } else {
        pageFilters.setSelectedFilters({});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]); // Ne dépendre que de selectedCategory, pas de pageFilters

  useEffect(() => {
    const typology = searchParams.get("typologies");
    const services = searchParams.get("services");
    if (typology && URL_TYPOLOGY_TO_CATEGORY[typology]) {
      setSelectedCategory(URL_TYPOLOGY_TO_CATEGORY[typology]);
    } else if (services) {
      setSelectedCategory("meeting");
    } else if (!typology && !services) {
      setSelectedCategory("all");
    }
  }, [searchParams]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isAutocompleteOpen) return;

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
        setIsAutocompleteOpen(false);
        break;
    }
  };

  const handleSelectSuggestion = (item: SearchEntity) => {
    const title = getEntityTitle(item);
    setSearch(title);
    setIsAutocompleteOpen(false);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
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
                    <div className="relative w-full sm:w-auto">
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="h-full w-full sm:w-auto pl-4 sm:pl-6 pr-10 py-3 sm:py-4 bg-background text-foreground text-sm sm:text-base font-medium focus:outline-none appearance-none cursor-pointer sm:border-r border-border rounded-t-2xl sm:rounded-none"
                        style={{ minWidth: '0', }}
                      >
                        <option value="all">Tous les lieux</option>
                        <option value="coworking">Coworking</option>
                        <option value="fablab">Fablab</option>
                        <option value="meeting">Se réunir</option>
                        <option value="food">Manger</option>
                        <option value="learn">S'instruire</option>
                        <option value="stay">Séjourner</option>
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg className="w-4 h-4 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    <div className="relative flex-1">
                      <input
                        ref={inputRef}
                        type="text"
                        value={search}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => {
                          if (suggestions.length > 0 && search.length >= 2) {
                            setIsAutocompleteOpen(true);
                          }
                        }}
                        placeholder={props.placeholder ? t(props.placeholder) : "Nom, ville, département ..."}
                        className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-card text-foreground text-sm sm:text-base focus:outline-none"
                      />
                      {isLoading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                          <Loader2 className="h-4 w-5 sm:h-5 sm:w-5 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    <button className="px-4 sm:px-8 py-3 sm:py-4 bg-primary text-primary-foreground text-sm sm:text-base font-semibold hover:bg-primary/90 transition flex items-center justify-center gap-2 rounded-b-2xl sm:rounded-none">
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
            <OptimizedImage
              src={props.backgroundImage}
              alt=""
              width={1200}
              className="w-full h-full object-cover object-top"
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
                    onClick={() => {
                      setActiveTabIndex(idx);
                      const category = TAB_INDEX_TO_CATEGORY[idx] || "all";
                      setSelectedCategory(category);
                    }}
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
                      onFocus={() => {
                        if (suggestions.length > 0 && search.length >= 2) {
                          setIsAutocompleteOpen(true);
                        }
                      }}
                      placeholder={props.placeholder ? t(props.placeholder) : "Ville, département ..."}
                      className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-card text-foreground text-sm sm:text-base focus:outline-none rounded-t-2xl sm:rounded-l-full sm:rounded-r-none"
                    />
                    {isLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <Loader2 className="h-4 w-5 sm:h-5 sm:w-5 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  <button className="px-4 sm:px-8 py-3 sm:py-4 bg-primary text-primary-foreground text-sm sm:text-base font-semibold hover:bg-primary/90 transition flex items-center justify-center gap-2 rounded-b-2xl sm:rounded-r-full sm:rounded-l-none">
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
          <OptimizedImage
            src={props.backgroundImage}
            alt=""
            width={1200}
            className="w-full h-full object-cover object-top"
          />
        </div>
      )}
    </section>
  );
}
export default HeroTiersLieux;
