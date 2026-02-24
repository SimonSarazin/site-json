import { type FieldValues, type UseFormReturn } from "react-hook-form";
import { useT } from "@/hooks/useT";
import { MapPin, Loader2, Trash2 } from "lucide-react";
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

interface BanFeature {
  properties: { id: string; name: string };
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
}

interface Street {
  streetAddress: string;
  geo?: [number, number]; // [lon, lat]
  id?: string;
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

  // Watch form values
  const addressCountry = form.watch("addressCountry");
  const addressLocality = form.watch("addressLocality");
  const postalCode = form.watch("postalCode");
  const streetAddress = form.watch("streetAddress");
  const localityId = form.watch("localityId");

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
  const fetchStreets = useCallback(async (query: string) => {
    if (!query || !addressCountry || !postalCode) return [];
    if (query.length < 3) return [];

    const isFR = ISO_COUNTRIES_FR.includes(addressCountry);
    if (!isFR) return [];

    try {
      const baseUrl = "https://data.geopf.fr/geocodage";
      const url = `${baseUrl}/search/?q=${encodeURIComponent(query)}&type=housenumber&postcode=${postalCode}`;
      const res = await fetch(url);
      const json = await res.json();

      return json?.features?.length
        ? json.features.map((f: BanFeature) => ({
            id: f.properties.id,
            label: f.properties.name,
            value: {
              streetAddress: f.properties.name,
              geo: f.geometry.coordinates,
              id: f.properties.id,
            },
          }))
        : [];
    } catch (error) {
      console.error("Error fetching streets:", error);
      return [];
    }
  }, [addressCountry, postalCode]);

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
      form.setValue("codeInsee", "");
      setSelectedLocality(null);
      resetStreet();
      return;
    }

    setSelectedLocality(city);
    form.setValue("addressLocality", city.name);
    form.setValue("localityId", city.id);
    form.setValue("codeInsee", city.insee || "");

    if (city.level1) {
      form.setValue("level1", city.level1);
      form.setValue("level1Name", city.level1Name || "");
    }
    if (city.level2) {
      form.setValue("level2", city.level2);
      form.setValue("level2Name", city.level2Name || "");
    }
    if (city.level3) {
      form.setValue("level3", city.level3);
      form.setValue("level3Name", city.level3Name || "");
    }
    if (city.level4) {
      form.setValue("level4", city.level4);
      form.setValue("level4Name", city.level4Name || "");
    }

    // If only one postal code, select it automatically
    if (city.postalCodes.length === 1) {
      const pc = city.postalCodes[0];
      form.setValue("postalCode", pc.postalCode);
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

    setSelectedStreet(street);
    form.setValue("streetAddress", street.streetAddress);
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

      {/* Country */}
      <FormField
        control={form.control}
        name="addressCountry"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("ProfileEdit.fields.addressCountry.label")}</FormLabel>
            <Select onValueChange={field.onChange} value={field.value || ""}>
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("ProfileEdit.fields.addressCountry.placeholder")} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {CountryList.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.nameFr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <TranslatedFormMessage />
          </FormItem>
        )}
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

      {/* Postal code (multiple choice if needed) */}
      {selectedLocality && selectedLocality.postalCodes.length > 1 && (
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
                <Select onValueChange={field.onChange} value={field.value || ""}>
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
      )}

      {/* Street - Autocomplete for FR, Input for others */}
      {isFR && postalCode ? (
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
        !isFR &&
        postalCode && (
          <FormField
            control={form.control}
            name="streetAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("ProfileEdit.fields.streetAddress.label")}</FormLabel>
                <FormControl>
                  <Input {...field} placeholder={t("ProfileEdit.fields.streetAddress.placeholder")} />
                </FormControl>
                <TranslatedFormMessage />
              </FormItem>
            )}
          />
        )
      )}
    </div>
  );
}
