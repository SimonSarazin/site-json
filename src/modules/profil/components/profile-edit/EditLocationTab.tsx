import { type FieldValues, type UseFormReturn } from "react-hook-form";
import { useT } from "@/hooks/useT";
import { MapPin, Loader2, Trash2, ChevronsUpDown, Check } from "lucide-react";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useCocolight } from "@/hooks/useCocolight";
import { useDebounce } from "@/hooks/useDebounce";
import { CountryList, ISO_COUNTRIES_FR } from "@/constants/CountryList";
import { SelectObject } from "@/components/ui/select-objet";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
} from "@/components/ui/form";
import { TranslatedFormMessage } from "./fields/TranslatedFormMessage";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface BanFeature {
  properties: {
    id: string;
    name: string;
    /** Granularité BAN : `housenumber` | `street` | `locality` | `municipality`. */
    type?: string;
    /** Score de pertinence BAN (0–1), décroissant. */
    score?: number;
    postcode?: string;
    city?: string;
    context?: string;
  };
  geometry: { coordinates: [number, number] };
}

interface EditLocationTabProps {
  form: UseFormReturn<FieldValues>;
}

interface City {
  id: string;
  name: string;
  insee?: string;
  postalCodes: Array<{
    postalCode: string;
    name: string;
    geo: { "@type": "GeoCoordinates"; latitude: number; longitude: number };
    geoPosition: { type: "Point"; coordinates: [number, number] };
  }>;
  level1?: string;
  level1Name?: string;
  level2?: string;
  level2Name?: string;
  level3?: string;
  level3Name?: string;
  level4?: string;
  level4Name?: string;
  level5?: string;
  level5Name?: string;
  /**
   * Coordonnées de niveau VILLE (projection backend `geo` de la collection `cities`).
   * Disponibles dès la sélection, même quand la ville n'a aucun code postal.
   * `geoPosition` n'est pas toujours projeté → calculé depuis `geo` si absent.
   */
  geo?: { "@type"?: string; latitude: string | number; longitude: string | number };
  geoPosition?: { type: string; coordinates: [number | string, number | string] };
}

interface Street {
  streetAddress: string;
  geo?: [number, number]; // [lon, lat]
  id?: string;
  /** Granularité BAN du résultat retenu (`housenumber` = numéro précis, `street` = rue, `locality` = lieu-dit). */
  type?: string;
}

/**
 * Tab pour éditer la localisation avec autocomplétion complète
 *
 * Features:
 * - Sélecteur de pays
 * - Autocomplétion ville via API Cocolight
 * - Gestion codes postaux multiples
 * - Autocomplétion rue via API BAN (France uniquement)
 * - Fallback Input simple pour pays non-FR
 * - Mise à jour automatique coordonnées géo
 */
export function EditLocationTab({ form }: EditLocationTabProps) {
  const t = useT("modules/profil");
  const { entity } = useCocolight();

  const [cities, setCities] = useState<Array<{ id: string; label: string; value: City }>>([]);
  const [streetOptions, setStreetOptions] = useState<Array<{ id: string; label: string; value: Street }>>([]);
  const [selectedLocality, setSelectedLocality] = useState<City | null>(null);
  const [selectedStreet, setSelectedStreet] = useState<Street | null>(null);

  const initializedRef = useRef(false);
  // Dernière requête tapée dans le champ rue — sert à réinjecter un numéro de
  // voirie saisi (« 12 ») quand le repli retourne une rue/lieu-dit sans numéro.
  const lastStreetQueryRef = useRef("");

  // Watch form values
  const addressCountry = form.watch("addressCountry");
  const addressLocality = form.watch("addressLocality");
  const postalCode = form.watch("postalCode");
  const streetAddress = form.watch("streetAddress");
  const localityId = form.watch("localityId");

  const codeInsee = form.watch("codeInsee");

  const debouncedCityQuery = useDebounce(addressLocality || "", 500);
  const debouncedStreet = useDebounce(streetAddress || "", 500);

  // Fetch cities from Cocolight API
  const fetchCities = useCallback(async (query: string) => {
    if (!query || !addressCountry) return [];
    if (query.length < 3) return [];
    if (!entity?.endpointApi) return [];

    try {
      const list = await entity.endpointApi.cityAutocompleteByCountry({
        type: "locality",
        scopeValue: query,
        formInMap: true,
        countryCode: addressCountry,
      });

      return list.map((c: City) => ({
        id: c.id,
        label: c.name,
        value: c,
      }));
    } catch (error) {
      console.error("Error fetching cities:", error);
      return [];
    }
  }, [addressCountry, entity]);

  // Fetch streets from BAN API (France only)
  // Utilise citycode (INSEE) en priorité car plus précis que postcode
  // pour les villes à arrondissements (Paris, Marseille, Lyon).
  //
  // PAS de filtre `type=housenumber` : la BAN n'a pas toujours le numéro
  // géocodé (fréquent en outre-mer, ex. « 12 Allée des Aubépines, 97410
  // Saint-Pierre »). On récupère donc numéro + rue + lieu-dit, et on **remonte
  // les numéros en tête** (priorité à la précision) tout en laissant la rue /
  // l'allée sélectionnable en repli.
  const fetchStreets = useCallback(async (query: string) => {
    if (!query || !addressCountry || (!postalCode && !codeInsee)) return [];
    if (query.length < 3) return [];

    const isFR = ISO_COUNTRIES_FR.includes(addressCountry);
    if (!isFR) return [];

    lastStreetQueryRef.current = query;

    try {
      const baseUrl = "https://data.geopf.fr/geocodage";
      const params = new URLSearchParams({ q: query, limit: "8" });
      if (codeInsee) {
        params.set("citycode", codeInsee);
      } else if (postalCode) {
        params.set("postcode", postalCode);
      }
      const url = `${baseUrl}/search/?${params}`;
      const res = await fetch(url);
      const json = await res.json();

      // Granularités retenues, par ordre de priorité d'affichage. La commune
      // (`municipality`) est exclue : elle est déjà choisie dans le champ Ville.
      const rank: Record<string, number> = { housenumber: 0, street: 1, locality: 2 };
      const features: BanFeature[] = json?.features ?? [];

      return features
        .filter((f) => (rank[f.properties.type ?? ""] ?? 9) < 9)
        .sort((a, b) => {
          const ra = rank[a.properties.type ?? ""] ?? 9;
          const rb = rank[b.properties.type ?? ""] ?? 9;
          if (ra !== rb) return ra - rb; // numéro d'abord, puis rue, puis lieu-dit
          return (b.properties.score ?? 0) - (a.properties.score ?? 0); // à type égal : score BAN décroissant
        })
        .map((f) => {
          const { name, type, postcode: pc, city } = f.properties;
          const suffix = pc && city ? `, ${pc} ${city}` : "";
          return {
            id: f.properties.id,
            label: `${name}${suffix}`,
            value: {
              streetAddress: name,
              geo: f.geometry.coordinates,
              id: f.properties.id,
              type,
            },
          };
        });
    } catch (error) {
      console.error("Error fetching streets:", error);
      return [];
    }
  }, [addressCountry, postalCode, codeInsee]);

  // Debounced city fetch
  useEffect(() => {
    let active = true;
    if (debouncedCityQuery.length > 2) {
      fetchCities(debouncedCityQuery)
        .then((opts) => active && setCities(opts));
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets options when query is cleared
      setCities([]);
    }
    return () => {
      active = false;
    };
  }, [debouncedCityQuery, fetchCities]);

  // Debounced street fetch
  useEffect(() => {
    let active = true;
    if (debouncedStreet.length > 2 && ISO_COUNTRIES_FR.includes(addressCountry || "")) {
      fetchStreets(debouncedStreet)
        .then((opts) => active && setStreetOptions(opts));
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets options when query is cleared
      setStreetOptions([]);
    }
    return () => {
      active = false;
    };
  }, [debouncedStreet, fetchStreets, addressCountry]);

  // Initialize with existing data
  useEffect(() => {
    if (initializedRef.current) return;
    if (!localityId && !streetAddress) return;

    initializedRef.current = true;

    const init = async () => {
      // Load existing city
      if (localityId && addressLocality) {
        let matchedCity = cities.find((c) => c.id === localityId)?.value;

        if (!matchedCity) {
          try {
            const results = await fetchCities(addressLocality);
            matchedCity = results.find((c: { id: string; label: string; value: City }) => c.value.id === localityId)?.value;
            if (matchedCity) {
              setCities(results);
            }
          } catch (e) {
            console.warn("fetchCities init failed", e);
          }
        }

        if (matchedCity) {
          setSelectedLocality(matchedCity);
        }
      }

      // Load existing street
      if (streetAddress && streetAddress.length >= 3 && postalCode) {
        try {
          const results = await fetchStreets(streetAddress);
          const matchedStreet = results.find((opt: { id: string; label: string; value: Street }) => opt.value.streetAddress === streetAddress);

          if (matchedStreet) {
            setStreetOptions(results);
            setSelectedStreet(matchedStreet.value);
          } else {
            setSelectedStreet({ streetAddress });
          }
        } catch (e) {
          console.warn("fetchStreets init failed", e);
          setSelectedStreet({ streetAddress });
        }
      }
    };

    init();
  }, [localityId, addressLocality, streetAddress, postalCode, fetchCities, fetchStreets, cities]);

  // Reset initialization flag when address changes
  useEffect(() => {
    if (!localityId && !streetAddress) {
      initializedRef.current = false;
    }
  }, [localityId, streetAddress]);

  // Handle city selection
  const handleSelectCity = (value: unknown) => {
    const city = value as City | null;
    if (!city) {
      form.setValue("addressLocality", "");
      form.setValue("localityId", "");
      form.setValue("postalCode", "");
      form.setValue("level1", "");
      form.setValue("level1Name", "");
      form.setValue("level2", "");
      form.setValue("level2Name", "");
      form.setValue("level3", "");
      form.setValue("level3Name", "");
      form.setValue("level4", "");
      form.setValue("level4Name", "");
      form.setValue("level5", "");
      form.setValue("level5Name", "");
      form.setValue("codeInsee", "");
      setSelectedLocality(null);
      resetStreet();
      return;
    }

    setSelectedLocality(city);
    form.setValue("addressLocality", city.name);
    form.setValue("localityId", city.id);
    form.setValue("codeInsee", city.insee || "");

    // Pose TOUS les niveaux de la ville, vides inclus ("") : une ville sans level2
    // (ex. FR) ne doit pas hériter du niveau d'une sélection précédente ; les vides
    // sont omis du payload par buildAddressFromForm (parité legacy : niveaux épars).
    form.setValue("level1", city.level1 || "");
    form.setValue("level1Name", city.level1Name || "");
    form.setValue("level2", city.level2 || "");
    form.setValue("level2Name", city.level2Name || "");
    form.setValue("level3", city.level3 || "");
    form.setValue("level3Name", city.level3Name || "");
    form.setValue("level4", city.level4 || "");
    form.setValue("level4Name", city.level4Name || "");
    form.setValue("level5", city.level5 || "");
    form.setValue("level5Name", city.level5Name || "");

    // Coordonnées de niveau VILLE : disponibles DÈS la sélection, indépendamment du
    // code postal. C'est la donnée géo garantie (une ville sans code postal — ex.
    // Antsirabe/MG — porte quand même un `geo`). Le code postal / la rue ne font
    // qu'affiner ensuite. `geoPosition` est calculé depuis `geo` s'il n'est pas fourni.
    if (city.geo && city.geo.latitude != null && city.geo.longitude != null) {
      const lon = Number(city.geo.longitude);
      const lat = Number(city.geo.latitude);
      form.setValue("geo", {
        "@type": "GeoCoordinates",
        latitude: String(city.geo.latitude),
        longitude: String(city.geo.longitude),
      });
      form.setValue(
        "geoPosition",
        city.geoPosition && Array.isArray(city.geoPosition.coordinates)
          ? {
              type: "Point",
              coordinates: [Number(city.geoPosition.coordinates[0]), Number(city.geoPosition.coordinates[1])],
            }
          : { type: "Point", coordinates: [lon, lat] }
      );
    }

    // Si un seul code postal, le sélectionner automatiquement et AFFINER les coordonnées
    // (centroïde du code postal, plus précis que le centre-ville).
    if (city.postalCodes.length === 1) {
      const pc = city.postalCodes[0];
      form.setValue("postalCode", pc.postalCode);
      form.setValue("geo", pc.geo);
      form.setValue("geoPosition", pc.geoPosition);
    } else {
      form.setValue("postalCode", "");
    }

    resetStreet();
  };

  // Handle street selection
  const handleSelectStreet = (value: unknown) => {
    const street = value as Street | null;
    if (!street) {
      resetStreet();
      return;
    }

    // Repli rue/lieu-dit (la BAN n'a pas le numéro géocodé) : on réinjecte le
    // numéro de voirie saisi pour conserver « 12 Allée des Aubépines » plutôt
    // que « Allée des Aubépines » seule.
    let streetAddress = street.streetAddress;
    if (street.type !== "housenumber" && !/^\d/.test(streetAddress)) {
      const m = lastStreetQueryRef.current.match(/^(\d+(?:\s?(?:bis|ter|quater|[a-d]))?)\s+/i);
      if (m) streetAddress = `${m[1].trim()} ${streetAddress}`;
    }

    const resolved: Street = { ...street, streetAddress };
    setSelectedStreet(resolved);
    form.setValue("streetAddress", streetAddress);
    // Coordonnées (`street.geo` = [lon, lat]) : niveau numéro si `housenumber`,
    // sinon centre de la rue / du lieu-dit (moins précis, mais exploitable).
    if (street.geo) {
      const [lon, lat] = street.geo;
      form.setValue("geo", { "@type": "GeoCoordinates", latitude: lat, longitude: lon });
      form.setValue("geoPosition", { type: "Point", coordinates: [lon, lat] });
    }
  };

  // Reset street
  const resetStreet = () => {
    form.setValue("streetAddress", "");
    setSelectedStreet(null);
    setStreetOptions([]);
  };

  // Reset all address fields
  const resetAllAddress = () => {
    // Reset pays
    form.setValue("addressCountry", "");

    // Reset ville et ses métadonnées
    form.setValue("addressLocality", "");
    form.setValue("localityId", "");
    form.setValue("postalCode", "");
    form.setValue("codeInsee", "");
    form.setValue("level1", "");
    form.setValue("level1Name", "");
    form.setValue("level2", "");
    form.setValue("level2Name", "");
    form.setValue("level3", "");
    form.setValue("level3Name", "");
    form.setValue("level4", "");
    form.setValue("level4Name", "");

    // Reset rue
    form.setValue("streetAddress", "");

    // Reset coordonnées géo
    form.setValue("geo", undefined);
    form.setValue("geoPosition", undefined);

    // Reset states locaux
    setSelectedLocality(null);
    setSelectedStreet(null);
    setCities([]);
    setStreetOptions([]);
    initializedRef.current = false;
  };

  // Normalized values for SelectObject
  const normalizedCity = useMemo(
    () => (selectedLocality ? [selectedLocality] : []),
    [selectedLocality]
  );

  const normalizedStreet = useMemo(
    () => (selectedStreet ? [selectedStreet] : []),
    [selectedStreet]
  );

  const isFR = addressCountry && ISO_COUNTRIES_FR.includes(addressCountry);

  return (
    <div className="space-y-6">
      {/* Header avec bouton reset */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="w-4 h-4" />
          <span>{t("ProfileEdit.tabs.location.description")}</span>
        </div>

        {/* Bouton reset - visible seulement si au moins un champ est rempli */}
        {(addressCountry || addressLocality || streetAddress) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetAllAddress}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {t("ProfileEdit.tabs.location.resetAddress")}
          </Button>
        )}
      </div>

      {/* Country (combobox avec recherche) */}
      <FormField
        control={form.control}
        name="addressCountry"
        render={({ field }) => {
          const selected = CountryList.find((c) => c.code === field.value);
          return (
            <FormItem className="flex flex-col">
              <FormLabel>{t("ProfileEdit.fields.addressCountry.label")}</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full justify-between font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {selected
                        ? selected.nameFr
                        : t("ProfileEdit.fields.addressCountry.placeholder")}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                  <Command>
                    <CommandInput placeholder={t("ProfileEdit.fields.addressCountry.placeholder")} />
                    <CommandList>
                      <CommandEmpty>Aucun pays trouvé.</CommandEmpty>
                      <CommandGroup>
                        {CountryList.map((c) => (
                          <CommandItem
                            key={c.code}
                            value={`${c.nameFr} ${c.code}`}
                            onSelect={() => field.onChange(c.code)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                field.value === c.code ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {c.nameFr}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <TranslatedFormMessage />
            </FormItem>
          );
        }}
      />

      {/* City autocomplete */}
      {addressCountry && (
        <FormField
          control={form.control}
          name="addressLocality"
          render={() => (
            <FormItem>
              <FormLabel>{t("ProfileEdit.fields.addressLocality.label")}</FormLabel>
              <FormControl>
                <SelectObject
                  value={normalizedCity}
                  onChange={handleSelectCity}
                  options={cities}
                  onSearch={fetchCities}
                  placeholder={t("ProfileEdit.fields.addressLocality.placeholder")}
                  placeholderSearch={t("ProfileEdit.fields.addressLocality.searchPlaceholder")}
                  loadingIndicator={
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("ProfileEdit.loading")}
                    </div>
                  }
                />
              </FormControl>
              <TranslatedFormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Code postal : liste déroulante si la ville a plusieurs CP, sinon saisie libre
          (villes à 0 ou 1 code postal — dont beaucoup hors-FR). Toujours disponible dès
          qu'une ville est sélectionnée. */}
      {addressLocality &&
        (selectedLocality && selectedLocality.postalCodes.length > 1 ? (
          <FormField
            control={form.control}
            name="postalCode"
            render={({ field }) => {
              // Group by unique postal code to avoid duplicates
              const uniquePostalCodes = Array.from(
                new Map(
                  selectedLocality.postalCodes.map(p => [p.postalCode, p])
                ).values()
              );

              return (
                <FormItem>
                  <FormLabel>{t("ProfileEdit.fields.postalCode.label")}</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      // Coordonnées du code postal choisi (affine le centre-ville).
                      const pc = selectedLocality.postalCodes.find((p) => p.postalCode === value);
                      if (pc) {
                        form.setValue("geo", pc.geo);
                        form.setValue("geoPosition", pc.geoPosition);
                      }
                    }}
                    value={field.value || ""}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("ProfileEdit.fields.postalCode.placeholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {uniquePostalCodes.map((p) => (
                        <SelectItem key={p.postalCode} value={p.postalCode}>
                          {p.postalCode} - {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <TranslatedFormMessage />
                </FormItem>
              );
            }}
          />
        ) : (
          <FormField
            control={form.control}
            name="postalCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("ProfileEdit.fields.postalCode.label")}</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} placeholder={t("ProfileEdit.fields.postalCode.placeholder")} />
                </FormControl>
                <TranslatedFormMessage />
              </FormItem>
            )}
          />
        ))}

      {/* Adresse (rue) : toujours disponible dès qu'une ville est choisie.
          Autocomplétion BAN pour la France (code postal OU code INSEE) ; sinon saisie
          libre — y compris pour les villes sans code postal (ex. Antsirabe/MG). */}
      {addressLocality &&
        (isFR && (postalCode || codeInsee) ? (
          <FormField
            control={form.control}
            name="streetAddress"
            render={() => (
              <FormItem>
                <FormLabel>{t("ProfileEdit.fields.streetAddress.label")}</FormLabel>
                <FormControl>
                  <SelectObject
                    value={normalizedStreet}
                    onChange={handleSelectStreet}
                    options={streetOptions}
                    onSearch={fetchStreets}
                    placeholder={t("ProfileEdit.fields.streetAddress.placeholder")}
                    placeholderSearch={t("ProfileEdit.fields.streetAddress.searchPlaceholder")}
                    loadingIndicator={
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t("ProfileEdit.loading")}
                      </div>
                    }
                  />
                </FormControl>
                <TranslatedFormMessage />
              </FormItem>
            )}
          />
        ) : (
          <FormField
            control={form.control}
            name="streetAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("ProfileEdit.fields.streetAddress.label")}</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} placeholder={t("ProfileEdit.fields.streetAddress.placeholder")} />
                </FormControl>
                <TranslatedFormMessage />
              </FormItem>
            )}
          />
        ))}
    </div>
  );
}
