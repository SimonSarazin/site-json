import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Loader2, ChevronsUpDown, Check } from "lucide-react";
import { useCocolight } from "@/hooks/useCocolight";
import { CountryList, ISO_COUNTRIES_FR } from "@/constants/CountryList";
import { SelectObject } from "@/components/ui/select-objet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { buildLocalityEntry } from "./buildLocalityEntry";
import type { City, Street, FormLocalityEntry } from "./types";

interface BanFeature {
  properties: { id: string; name: string; type?: string; score?: number; postcode?: string; city?: string };
  geometry: { coordinates: [number, number] };
}

interface AddressEditorProps {
  /** Adresse en cours d'édition (null = vierge). */
  value: FormLocalityEntry | null;
  /** Émis à CHAQUE modification (null si la ville est retirée). */
  onChange: (entry: FormLocalityEntry | null) => void;
  countries?: string[];
}

function cleanInsee(v: unknown): string {
  const s = v == null ? "" : String(v).trim();
  return !s || s === "undefined" || s === "null" ? "" : s;
}

/** City minimale reconstruite depuis une adresse déjà enregistrée (fallback si le refetch échoue). */
function syntheticCity(entry: FormLocalityEntry): City {
  const a = entry.address;
  return {
    id: a.localityId ?? "",
    name: a.addressLocality ?? "",
    insee: a.codeInsee,
    country: a.addressCountry,
    postalCodes: a.postalCode ? [{ postalCode: a.postalCode, geo: entry.geo, geoPosition: entry.geoPosition }] : [],
    level1: a.level1, level1Name: a.level1Name,
    level2: a.level2, level2Name: a.level2Name,
    level3: a.level3, level3Name: a.level3Name,
    level4: a.level4, level4Name: a.level4Name,
    level5: a.level5, level5Name: a.level5Name,
    geo: entry.geo,
    geoPosition: entry.geoPosition,
  };
}

/**
 * Éditeur d'adresse contrôlé (une adresse) — cœur partagé, parité dynForm `formLocality`.
 * Utilisé par le coform (`AddressPicker`, multi). Cible : les formulaires d'entités
 * (`EditLocationTab` duplique encore cette logique via un adaptateur champs-plats — non
 * migré à ce jour). Capture geo/geoPosition dès la sélection de la ville (même sans code
 * postal) ; Code postal et Adresse toujours saisissables.
 */
export function AddressEditor({ value, onChange, countries }: AddressEditorProps) {
  const { entity } = useCocolight();

  const [country, setCountry] = useState(value?.address.addressCountry ?? "");
  const [selectedCity, setSelectedCity] = useState<City | null>(value ? syntheticCity(value) : null);
  const [postalCode, setPostalCode] = useState(value?.address.postalCode ?? "");
  const [street, setStreet] = useState<Street | null>(value?.address.streetAddress ? { streetAddress: value.address.streetAddress } : null);

  const hydratedRef = useRef(false);
  const lastStreetQueryRef = useRef("");

  const isFR = Boolean(country && ISO_COUNTRIES_FR.includes(country));
  const codeInsee = cleanInsee(selectedCity?.insee);

  const allowedCountries = useMemo(
    () => (countries && countries.length ? CountryList.filter((c) => countries.includes(c.code)) : CountryList),
    [countries]
  );

  const fetchCitiesFor = useCallback(
    async (countryCode: string, query: string) => {
      if (!query || query.length < 3 || !countryCode || !entity?.endpointApi) return [];
      try {
        const list = await entity.endpointApi.cityAutocompleteByCountry({ type: "locality", scopeValue: query, formInMap: true, countryCode });
        const arr: City[] = Array.isArray(list) ? list : [];
        return arr.map((c) => ({ id: c.id, label: c.level1Name ? `${c.name} (${c.level1Name})` : c.name, value: c }));
      } catch (e) {
        console.error("cityAutocompleteByCountry failed", e);
        return [];
      }
    },
    [entity]
  );

  const fetchStreets = useCallback(
    async (query: string) => {
      if (!query || query.length < 3 || !isFR || (!postalCode && !codeInsee)) return [];
      lastStreetQueryRef.current = query;
      try {
        const params = new URLSearchParams({ q: query, limit: "8" });
        if (codeInsee) params.set("citycode", codeInsee);
        else if (postalCode) params.set("postcode", postalCode);
        const res = await fetch(`https://data.geopf.fr/geocodage/search/?${params}`);
        const json = await res.json();
        const rank: Record<string, number> = { housenumber: 0, street: 1, locality: 2 };
        const features: BanFeature[] = json?.features ?? [];
        return features
          .filter((f) => (rank[f.properties.type ?? ""] ?? 9) < 9)
          .sort((a, b) => {
            const ra = rank[a.properties.type ?? ""] ?? 9;
            const rb = rank[b.properties.type ?? ""] ?? 9;
            if (ra !== rb) return ra - rb;
            return (b.properties.score ?? 0) - (a.properties.score ?? 0);
          })
          .map((f) => {
            const { name, type, postcode: pc, city } = f.properties;
            const suffix = pc && city ? `, ${pc} ${city}` : "";
            return { id: f.properties.id, label: `${name}${suffix}`, value: { streetAddress: name, geo: f.geometry.coordinates, id: f.properties.id, type } as Street };
          });
      } catch (e) {
        console.error("BAN street search failed", e);
        return [];
      }
    },
    [isFR, postalCode, codeInsee]
  );

  // `onSearch` STABLE (SelectObject a un effet [debSearch, onSearch] : une fonction inline
  // recréée à chaque render déclencherait une boucle de rendu). SelectObject gère lui-même
  // ses options à partir du résultat de `onSearch` — on ne stocke pas d'état d'options ici.
  const searchCities = useCallback((q: string) => fetchCitiesFor(country, q), [fetchCitiesFor, country]);

  // Valeurs mémoïsées (SelectObject reçoit un tableau ; identité stable = pas de travail inutile).
  const normalizedCity = useMemo(
    () => (selectedCity ? [{ id: selectedCity.id, label: selectedCity.name, value: selectedCity }] : []),
    [selectedCity]
  );
  const normalizedStreet = useMemo(
    () => (street ? [{ id: street.id ?? street.streetAddress, label: street.streetAddress, value: street }] : []),
    [street]
  );

  // Hydratation : reconstruit la City complète (postalCodes/niveaux) depuis la valeur existante,
  // SANS émettre (préserve les champs déjà en place côté hôte).
  useEffect(() => {
    if (hydratedRef.current || !value?.address.localityId || !value.address.addressLocality) return;
    hydratedRef.current = true;
    let active = true;
    (async () => {
      const opts = await fetchCitiesFor(value.address.addressCountry ?? "", value.address.addressLocality ?? "");
      if (!active) return;
      const match = opts.find((o) => o.value.id === value.address.localityId)?.value;
      if (match) setSelectedCity(match);
    })();
    return () => {
      active = false;
    };
  }, [value, fetchCitiesFor]);

  /** Construit l'entrée depuis l'état courant (+ surcharges) et l'émet. */
  const emit = (over: { country?: string; city?: City | null; postalCode?: string; street?: Street | null }) => {
    const c = over.country ?? country;
    const city = "city" in over ? over.city : selectedCity;
    const pc = "postalCode" in over ? over.postalCode : postalCode;
    const st = "street" in over ? over.street : street;
    if (!city?.id) {
      onChange(null);
      return;
    }
    onChange(buildLocalityEntry({ addressCountry: c, city, postalCode: pc || undefined, street: st, center: value?.center ?? true }));
  };

  const handleSelectCity = (v: unknown) => {
    const city = v as City | null;
    setSelectedCity(city);
    setStreet(null);
    const autoPc = city && city.postalCodes?.length === 1 ? city.postalCodes[0].postalCode : "";
    setPostalCode(autoPc);
    emit({ city, postalCode: autoPc, street: null });
  };

  const handleSelectPostalCode = (pc: string) => {
    setPostalCode(pc);
    emit({ postalCode: pc });
  };

  const handleSelectStreet = (v: unknown) => {
    const s = v as Street | null;
    if (!s) {
      setStreet(null);
      emit({ street: null });
      return;
    }
    // Repli rue/lieu-dit sans numéro : réinjecte le numéro de voirie saisi.
    let streetAddress = s.streetAddress;
    if (s.type !== "housenumber" && !/^\d/.test(streetAddress)) {
      const m = lastStreetQueryRef.current.match(/^(\d+(?:\s?(?:bis|ter|quater|[a-d]))?)\s+/i);
      if (m) streetAddress = `${m[1].trim()} ${streetAddress}`;
    }
    const resolved: Street = { ...s, streetAddress };
    setStreet(resolved);
    emit({ street: resolved });
  };

  return (
    <div className="space-y-3">
      {/* Pays */}
      <div className="space-y-1">
        <label className="text-sm font-medium">Pays</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" role="combobox" className={cn("w-full justify-between font-normal", !country && "text-muted-foreground")}>
              {allowedCountries.find((c) => c.code === country)?.nameFr ?? "Sélectionner un pays"}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
            <Command>
              <CommandInput placeholder="Rechercher un pays…" />
              <CommandList>
                <CommandEmpty>Aucun pays trouvé.</CommandEmpty>
                <CommandGroup>
                  {allowedCountries.map((c) => (
                    <CommandItem
                      key={c.code}
                      value={`${c.nameFr} ${c.code}`}
                      onSelect={() => {
                        setCountry(c.code);
                        setSelectedCity(null);
                        setPostalCode("");
                        setStreet(null);
                        onChange(null);
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", country === c.code ? "opacity-100" : "opacity-0")} />
                      {c.nameFr}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Ville */}
      {country && (
        <div className="space-y-1">
          <label className="text-sm font-medium">Ville</label>
          <SelectObject
            value={normalizedCity}
            onChange={handleSelectCity}
            onSearch={searchCities}
            placeholder="Rechercher une ville / un code postal"
            placeholderSearch="Rechercher une ville…"
            loadingIndicator={<div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Recherche…</div>}
          />
        </div>
      )}

      {/* Code postal : liste si plusieurs, sinon saisie libre — toujours dispo après une ville */}
      {selectedCity && (
        <div className="space-y-1">
          <label className="text-sm font-medium">Code postal</label>
          {selectedCity.postalCodes.length > 1 ? (
            <Select value={postalCode} onValueChange={handleSelectPostalCode}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sélectionner…" />
              </SelectTrigger>
              <SelectContent>
                {Array.from(new Map(selectedCity.postalCodes.map((p) => [p.postalCode, p])).values()).map((p) => (
                  <SelectItem key={p.postalCode} value={p.postalCode}>
                    {p.postalCode}{p.name ? ` - ${p.name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input value={postalCode} onChange={(e) => handleSelectPostalCode(e.target.value)} placeholder="Code postal" />
          )}
        </div>
      )}

      {/* Adresse (rue) : autocomplétion BAN (FR + CP/INSEE), sinon saisie libre — toujours dispo */}
      {selectedCity && (
        <div className="space-y-1">
          <label className="text-sm font-medium">Adresse</label>
          {isFR && (postalCode || codeInsee) ? (
            <SelectObject
              value={normalizedStreet}
              onChange={handleSelectStreet}
              onSearch={fetchStreets}
              placeholder="N° et rue"
              placeholderSearch="Rechercher une adresse…"
              loadingIndicator={<div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Recherche…</div>}
            />
          ) : (
            <Input
              value={street?.streetAddress ?? ""}
              onChange={(e) => handleSelectStreet(e.target.value ? { streetAddress: e.target.value } : null)}
              placeholder="N° et rue"
            />
          )}
        </div>
      )}
    </div>
  );
}

export default AddressEditor;
