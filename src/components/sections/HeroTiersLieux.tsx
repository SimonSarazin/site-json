import { useLocalization } from "@/hooks/useLocalization";
import { useState, useRef, useEffect, useMemo } from "react";
import { Loader2, MapPin, Building2, Calendar, User, FolderOpen } from "lucide-react";

import { HeroTiersLieuxProps as SchemaHeroTiersLieuxProps } from "@/types/site-schema";
import { useAutocomplete } from "@/hooks/useAutocomplete";
import { SearchEntity } from "@/modules/search/schema";
import { cn } from "@/lib/utils";

const getEntityIcon = (entity: SearchEntity) => {
  const type = entity?.getEntityType?.() || "";

  switch (type) {
    case "poi":
      return <MapPin className="h-4 w-4 text-blue-500" />;
    case "organizations":
      return <Building2 className="h-4 w-4 text-purple-500" />;
    case "events":
      return <Calendar className="h-4 w-4 text-green-500" />;
    case "citoyens":
      return <User className="h-4 w-4 text-orange-500" />;
    case "projects":
      return <FolderOpen className="h-4 w-4 text-pink-500" />;
    default:
      return <MapPin className="h-4 w-4 text-gray-500" />;
  }
};

const getEntityTitle = (entity: SearchEntity): string => {
  if (typeof (entity as any).getName === 'function') {
    const name = (entity as any).getName();
    if (name) return String(name);
  }

  if ('serverData' in entity && (entity as any).serverData?.name) {
    return String((entity as any).serverData.name);
  }

  if ('name' in entity && entity.name) return String(entity.name);
  if ('title' in entity && entity.title) return String(entity.title);

  return "Sans titre";
};

const getEntityAddress = (entity: SearchEntity): string | null => {
  if ('address' in entity && entity.address) {
    const addr = entity.address as any;
    if (typeof addr === 'string') return addr;
    if (addr?.addressLocality) {
      const parts = [
        addr.postalCode,
        addr.addressLocality,
      ].filter(Boolean);
      return parts.join(" ");
    }
  }

  if ('serverData' in entity) {
    const serverData = (entity as any).serverData;
    if (serverData?.address) {
      const addr = serverData.address;
      if (typeof addr === 'string') return addr;
      if (addr?.addressLocality) {
        const parts = [
          addr.postalCode,
          addr.addressLocality,
        ].filter(Boolean);
        return parts.join(" ");
      }
    }
  }

  return null;
};

const getEntityId = (entity: SearchEntity, index: number): string => {
  if (typeof (entity as any).getId === 'function') {
    return (entity as any).getId();
  }
  if (typeof (entity as any).get === 'function') {
    const id = (entity as any).get('id');
    if (id) return String(id);
  }
  return `entity-${index}`;
};

interface HeroTiersLieuxProps {
  id?: string;
  props: SchemaHeroTiersLieuxProps;
}

export function HeroTiersLieux({ props }: HeroTiersLieuxProps) {
  const { t } = useLocalization();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const autocompleteOptions = useMemo(() => ({
    searchTypes: ["organizations", "events", "citoyens", "projects"],
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
      <section className="relative min-h-[450px] flex flex-col -mt-10">
        <div className="relative z-10 flex-1 flex items-center justify-center">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto">
              <div 
                className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl p-8 border border-white/20"
                style={{
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)'
                }}
              >
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
                  {t(props.headline)}
                </h1>

                <div className="relative">
                  <div className="flex gap-0 shadow-xl rounded-full overflow-hidden">
                    <div className="relative">
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="h-full pl-6 pr-10 bg-white text-gray-700 font-medium focus:outline-none appearance-none cursor-pointer border-r border-gray-200"
                        style={{ minWidth: '150px' }}
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
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                        placeholder={props.placeholder ? t(props.placeholder) : "Nom, ville, département, code postal ..."}
                        className="w-full px-6 py-4 bg-white text-gray-700 focus:outline-none"
                      />
                      {isLoading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                        </div>
                      )}
                    </div>

                    <button className="px-8 py-4 bg-teal-500 text-white font-semibold hover:bg-teal-600 transition flex items-center gap-2">
                      {props.searchButtonText ? t(props.searchButtonText) : "Rechercher"}
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

                  {/* Autocomplete dropdown */}
                  {isAutocompleteOpen && suggestions.length > 0 && (
                    <div
                      ref={dropdownRef}
                      className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 max-h-96 overflow-y-auto z-50"
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
                              "w-full px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-100 last:border-b-0",
                              highlightedIndex === index && "bg-gray-50"
                            )}
                          >
                            <div className="mt-1">{getEntityIcon(item)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 truncate">
                                {title}
                              </div>
                              {address && (
                                <div className="text-sm text-gray-500 truncate">
                                  {address}
                                </div>
                              )}
                            </div>
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
            <img
              src={props.backgroundImage}
              className="w-full h-full object-cover object-top"
              alt=""
            />
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="bg-white relative">
      <div className="container mx-auto px-6">
        <h1 className="text-5xl font-extrabold pt-6 text-center text-gray-900 mb-4">
          {t(props.headline)}
        </h1>

        {props.subhead && (
          <p className="text-center text-teal-500 font-light text-xl italic mb-5">
            {t(props.subhead)}
          </p>
        )}

        <div className="flex justify-center space-x-1 mb-8 text-sm flex-wrap">
          {props.ctaButtons?.map((btn, idx) => (
            <button
              key={idx}
              className={`px-6 py-3 font-semibold ${
                idx === 0
                  ? "border-b-4 border-teal-500 text-teal-500 bg-gray-50"
                  : "hover:bg-gray-50 transition"
              }`}
            >
              {t(btn.label)}
            </button>
          ))}
        </div>

        <div className="relative z-10 max-w-4xl mx-auto -mb-8">
          <div className="flex gap-0 shadow-xl rounded-full overflow-hidden">
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
                placeholder={props.placeholder ? t(props.placeholder) : "Ville, département, code postal ..."}
                className="w-full bg-white px-6 py-4 border-0 focus:outline-none text-gray-700"
              />
              {isLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              )}
            </div>
            <button className="px-10 py-4 bg-teal-500 text-white font-semibold hover:bg-blue-900 transition flex items-center gap-2">
              {props.searchButtonText ? t(props.searchButtonText) : "Rechercher"}
              <span className="text-lg">
                <svg
                  className="w-5 h-5"
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
              </span>
            </button>
          </div>

          {/* Autocomplete dropdown */}
          {isAutocompleteOpen && suggestions.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 max-h-96 overflow-y-auto z-50"
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
                      "w-full px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-100 last:border-b-0",
                      highlightedIndex === index && "bg-gray-50"
                    )}
                  >
                    <div className="mt-1">{getEntityIcon(item)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {title}
                      </div>
                      {address && (
                        <div className="text-sm text-gray-500 truncate">
                          {address}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {props.backgroundImage && (
          <div className="relative w-full h-48 -mx-6 lg:-mx-12 overflow-hidden">
            <img
              src={props.backgroundImage}
              className="absolute inset-0 w-full h-full object-cover object-center opacity-90"
              alt={t(props.headline)}
            />
          </div>
        )}
      </div>
    </section>
  );
}