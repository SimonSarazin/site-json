import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import {
  Pencil,
  Loader2,
  Search,
  X,
  Check,
  Trash2,
  Plus,
  ChevronDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/hooks/useT";
import { useProfileMutations } from "@/modules/profil/hooks/useProfileMutations";
import { useToast } from "@/hooks/use-toast";
import { useCocolight } from "@/hooks/useCocolight";
import { CountryList } from "@/lib/constant/CountryList";

const addressSchema = z.object({
  streetAddress: z.string().optional(),
});

type AddressFormData = z.infer<typeof addressSchema>;

interface CityResult {
  id: string;
  name: string;
  insee?: string;
  codeInsee?: string;
  level1?: string;
  level1Name?: string;
  level2?: string;
  level2Name?: string;
  level3?: string;
  level3Name?: string;
  level4?: string;
  level4Name?: string;
  geo?: {
    "@type"?: string;
    latitude: string | number;
    longitude: string | number;
  };
  geoPosition?: {
    type: string;
    coordinates: [number, number];
  };
  postalCodes?: Array<{
    postalCode: string;
    name?: string;
    geo?: {
      "@type"?: string;
      latitude: string | number;
      longitude: string | number;
    };
    geoPosition?: {
      type: string;
      coordinates: [number, number];
    };
  }>;
}

interface AddressData {
  "@type"?: "PostalAddress";
  addressCountry?: string;
  addressLocality?: string;
  localityId?: string;
  codeInsee?: string;
  level1?: string;
  level1Name?: string;
  level2?: string;
  level2Name?: string;
  level3?: string;
  level3Name?: string;
  level4?: string;
  level4Name?: string;
  postalCode?: string;
  streetAddress?: string;
  geo?: {
    "@type"?: string;
    latitude: string | number;
    longitude: string | number;
  };
  geoPosition?: {
    type: string;
    coordinates: [number, number];
  };
}

interface GeoData {
  "@type"?: string;
  latitude: string | number;
  longitude: string | number;
}

interface EditAddressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAddress?: AddressData | null;
  initialGeo?: GeoData | null;
}

export function EditAddressModal({
  open,
  onOpenChange,
  initialAddress,
  initialGeo,
}: EditAddressModalProps) {
  const t = useT("modules/profil");
  const { toast } = useToast();
  const { updateLocality } = useProfileMutations();
  const { entity } = useCocolight();

  const [hasAddress, setHasAddress] = useState(!!initialAddress);
  const [selectedCountry, setSelectedCountry] = useState(initialAddress?.addressCountry || "");
  const [citySearch, setCitySearch] = useState(initialAddress?.addressLocality || "");
  const [debouncedCitySearch, setDebouncedCitySearch] = useState("");
  const [selectedCity, setSelectedCity] = useState<CityResult | null>(null);
  const [selectedPostalCode, setSelectedPostalCode] = useState(initialAddress?.postalCode || "");
  const [showCityResults, setShowCityResults] = useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [addressData, setAddressData] = useState<AddressData | null>(initialAddress || null);

  const cityInputRef = useRef<HTMLInputElement>(null);
  const countryDropdownRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
  } = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      streetAddress: initialAddress?.streetAddress || "",
    },
  });

  const streetAddress = watch("streetAddress");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCitySearch(citySearch);
    }, 500);
    return () => clearTimeout(timer);
  }, [citySearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
        setShowCountryDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setHasAddress(!!initialAddress);
      setSelectedCountry(initialAddress?.addressCountry || "");
      setCitySearch(initialAddress?.addressLocality || "");
      setSelectedPostalCode(initialAddress?.postalCode || "");
      setAddressData(initialAddress || null);
      setValue("streetAddress", initialAddress?.streetAddress || "");

      if (initialAddress?.localityId) {
        setSelectedCity({
          id: initialAddress.localityId,
          name: initialAddress.addressLocality || "",
          level1: initialAddress.level1,
          level1Name: initialAddress.level1Name,
          level3: initialAddress.level3,
          level3Name: initialAddress.level3Name,
          geo: initialAddress.geo || initialGeo || undefined,
        });
      } else {
        setSelectedCity(null);
      }
    }
  }, [open, initialAddress, initialGeo, setValue]);

  const { data: cityResults, isLoading: isLoadingCities } = useQuery({
    queryKey: ["city-autocomplete", selectedCountry, debouncedCitySearch],
    queryFn: async () => {
      if (!entity?.endpointApi) return [];
      const response = await entity.endpointApi.cityAutocompleteByCountry({
        type: "locality",
        scopeValue: debouncedCitySearch,
        formInMap: true,
        countryCode: selectedCountry,
      });
      console.log("City autocomplete response:", response);
      return (response?.cities || response?.results || response || []) as CityResult[];
    },
    enabled: !!selectedCountry && debouncedCitySearch.length > 2 && showCityResults,
    staleTime: 1000 * 60 * 5,
  });

  const handleCountrySelect = (countryCode: string) => {
    setSelectedCountry(countryCode);
    setShowCountryDropdown(false);
    setCitySearch("");
    setSelectedCity(null);
    setSelectedPostalCode("");
    setValue("streetAddress", "");

    const newAddress: AddressData = {
      "@type": "PostalAddress",
      addressCountry: countryCode,
    };
    setAddressData(newAddress);
  };

  const handleCitySelect = (city: CityResult) => {
    console.log("Selected city:", city);
    setSelectedCity(city);
    setCitySearch(city.name);
    setShowCityResults(false);
    setSelectedPostalCode("");

    const codeInsee = city.insee || city.codeInsee || city.id;

    const newAddress: AddressData = {
      "@type": "PostalAddress",
      addressCountry: selectedCountry,
      addressLocality: city.name,
      localityId: city.id,
      codeInsee: codeInsee,
      level1: city.level1 || "",
      level1Name: city.level1Name || "",
      level2: city.level2,
      level2Name: city.level2Name,
      level3: city.level3,
      level3Name: city.level3Name,
      level4: city.level4,
      level4Name: city.level4Name,
    };

    if (city.postalCodes && city.postalCodes.length === 1) {
      const pc = city.postalCodes[0];
      newAddress.postalCode = pc.postalCode;
      if (pc.geo) newAddress.geo = pc.geo;
      if (pc.geoPosition) newAddress.geoPosition = pc.geoPosition;
      setSelectedPostalCode(pc.postalCode);
    } else if (city.geo) {
      newAddress.geo = city.geo;
    }
    if (city.geoPosition) {
      newAddress.geoPosition = city.geoPosition;
    }

    console.log(newAddress);
    setAddressData(newAddress);
  };

  const handlePostalCodeSelect = (postalCode: string) => {
    setSelectedPostalCode(postalCode);

    if (selectedCity?.postalCodes) {
      const pc = selectedCity.postalCodes.find(p => p.postalCode === postalCode);
      if (pc && addressData) {
        const newAddress = { ...addressData, postalCode };
        if (pc.geo) newAddress.geo = pc.geo;
        if (pc.geoPosition) newAddress.geoPosition = pc.geoPosition;
        setAddressData(newAddress);
      }
    }
  };

  const handleStreetAddressChange = (value: string) => {
    if (addressData) {
      setAddressData({ ...addressData, streetAddress: value });
    }
  };

  const handleRemoveAddress = () => {
    setHasAddress(false);
    setSelectedCountry("");
    setCitySearch("");
    setSelectedCity(null);
    setSelectedPostalCode("");
    setValue("streetAddress", "");
    setAddressData(null);
  };

  const handleClearCity = () => {
    setCitySearch("");
    setSelectedCity(null);
    setSelectedPostalCode("");
    setValue("streetAddress", "");
    setShowCityResults(true);

    if (addressData) {
      setAddressData({
        "@type": "PostalAddress",
        addressCountry: selectedCountry,
      });
    }

    setTimeout(() => cityInputRef.current?.focus(), 100);
  };

  const onSubmit = async () => {
    try {
      if (!hasAddress || !addressData) {
        console.log("Removing address (sending empty string)");
        await updateLocality.mutateAsync({
          address: "",
        });

        toast({
          title: String(t("EditAbout.success")),
          description: String(t("EditAbout.addressRemoved")),
        });

        onOpenChange(false);
        return;
      }

      const { geo: addrGeo, geoPosition: addrGeoPos, ...addressWithoutGeo } = addressData;

      if (!addressWithoutGeo.addressLocality || !addressWithoutGeo.localityId) {
        toast({
          title: String(t("EditAbout.error")),
          description: String(t("EditAbout.selectCityFirst")),
          variant: "destructive",
        });
        return;
      }

      const finalAddress = {
        "@type": "PostalAddress" as const,
        addressCountry: addressWithoutGeo.addressCountry || "",
        addressLocality: addressWithoutGeo.addressLocality,
        localityId: addressWithoutGeo.localityId,
        codeInsee: addressWithoutGeo.codeInsee || addressWithoutGeo.localityId, // Fallback to localityId if no codeInsee
        level1: addressWithoutGeo.level1 || "",
        level1Name: addressWithoutGeo.level1Name || "",
        ...(addressWithoutGeo.level3 ? { level3: addressWithoutGeo.level3 } : {}),
        ...(addressWithoutGeo.level3Name ? { level3Name: addressWithoutGeo.level3Name } : {}),
        ...(addressWithoutGeo.level4 ? { level4: addressWithoutGeo.level4 } : {}),
        ...(addressWithoutGeo.level4Name ? { level4Name: addressWithoutGeo.level4Name } : {}),
        ...(addressWithoutGeo.postalCode ? { postalCode: addressWithoutGeo.postalCode } : {}),
        ...(streetAddress ? { streetAddress } : {}),
      };

      const geoData = addrGeo ? {
        "@type": "GeoCoordinates" as const,
        latitude: addrGeo.latitude,
        longitude: addrGeo.longitude,
      } : undefined;

      const geoPositionData = addrGeoPos ? {
        type: "Point" as const,
        coordinates: addrGeoPos.coordinates,
        float: true as const,
      } : undefined;

      console.log("Submitting address:", {
        address: finalAddress,
        geo: geoData,
        geoPosition: geoPositionData
      });

      await updateLocality.mutateAsync({
        address: finalAddress,
        geo: geoData,
        geoPosition: geoPositionData,
      });

      toast({
        title: String(t("EditAbout.success")),
        description: String(t("EditAbout.addressUpdated")),
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error updating address:", error);
      toast({
        title: String(t("EditAbout.error")),
        description: String(t("EditAbout.updateFailed")),
        variant: "destructive",
      });
    }
  };

  const selectedCountryName = CountryList.find(c => c.code === selectedCountry)?.name || "";
  const hasMultiplePostalCodes = selectedCity?.postalCodes && selectedCity.postalCodes.length > 1;
  const currentGeo = addressData?.geo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            {t("EditAbout.editAddress")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex justify-center">
            {!hasAddress ? (
              <Button
                type="button"
                onClick={() => setHasAddress(true)}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t("EditAbout.addAddress")}
              </Button>
            ) : (
              <Button
                type="button"
                variant="destructive"
                onClick={handleRemoveAddress}
                className="w-full"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t("EditAbout.deleteAddress")}
              </Button>
            )}
          </div>

          {hasAddress && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("EditAbout.country")}</Label>
                <div className="relative" ref={countryDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm border border-input rounded-md bg-background hover:bg-accent"
                  >
                    <span className={selectedCountry ? "text-foreground" : "text-muted-foreground"}>
                      {selectedCountryName || t("EditAbout.selectCountry")}
                    </span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </button>

                  {showCountryDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {CountryList.map((country) => (
                        <button
                          key={country.code}
                          type="button"
                          onClick={() => handleCountrySelect(country.code)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center justify-between"
                        >
                          {country.name}
                          {selectedCountry === country.code && (
                            <Check className="w-4 h-4 text-primary" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {selectedCountry && (
                <div className="space-y-2">
                  <Label>{t("EditAbout.city")}</Label>
                  <div className="relative">
                    {selectedCity ? (
                      <div
                        onClick={handleClearCity}
                        className="flex items-center gap-3 p-3 border border-primary rounded-md bg-primary/10 cursor-pointer hover:bg-primary/20 transition-colors"
                      >
                        <Check className="w-5 h-5 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {[
                              selectedCity.name,
                              selectedCity.level3Name,
                              selectedCity.level1Name,
                            ].filter(Boolean).join(" / ")}
                          </p>
                        </div>
                        <X className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            ref={cityInputRef}
                            value={citySearch}
                            onChange={(e) => {
                              setCitySearch(e.target.value);
                              setShowCityResults(true);
                            }}
                            onFocus={() => setShowCityResults(true)}
                            placeholder={String(t("EditAbout.searchCity"))}
                            className="pl-9"
                          />
                          {isLoadingCities && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                          )}
                        </div>

                        {showCityResults && debouncedCitySearch.length > 2 && (
                          <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                            <div className="px-3 py-2 text-xs text-muted-foreground bg-muted border-b border-border flex items-center justify-between">
                              <span>
                                {isLoadingCities
                                  ? t("EditAbout.loading")
                                  : cityResults?.length
                                    ? `${cityResults.length} ${t("EditAbout.resultsFound")}`
                                    : t("EditAbout.noResults")}
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowCityResults(false)}
                                className="p-1 hover:bg-accent rounded"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>

                            {cityResults?.map((city) => (
                              <button
                                key={city.id}
                                type="button"
                                onClick={() => handleCitySelect(city)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-accent border-b border-border last:border-0"
                              >
                                <p className="font-medium">
                                  {[
                                    city.name,
                                    city.level4Name,
                                    city.level3Name,
                                    city.level1Name,
                                  ].filter(Boolean).join(" / ")}
                                </p>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {selectedCity && hasMultiplePostalCodes && (
                <div className="space-y-2">
                  <Label>{t("EditAbout.postalCode")}</Label>
                  <select
                    value={selectedPostalCode}
                    onChange={(e) => handlePostalCodeSelect(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background"
                  >
                    <option value="">{t("EditAbout.selectPostalCode")}</option>
                    {selectedCity.postalCodes?.map((pc) => (
                      <option key={pc.postalCode} value={pc.postalCode}>
                        {pc.postalCode} {pc.name ? `- ${pc.name}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedCity && (!hasMultiplePostalCodes || selectedPostalCode) && (
                <div className="space-y-2">
                  <Label>{t("EditAbout.streetAddress")}</Label>
                  <Input
                    {...register("streetAddress")}
                    onChange={(e) => {
                      register("streetAddress").onChange(e);
                      handleStreetAddressChange(e.target.value);
                    }}
                    placeholder={String(t("EditAbout.streetAddressPlaceholder"))}
                  />
                </div>
              )}

              {currentGeo && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">{t("EditAbout.locationPreview")}</Label>
                  <div className="w-full h-48 rounded-lg overflow-hidden border border-border shadow-sm">
                    <iframe
                      title="Location preview"
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(currentGeo.longitude) - 0.01}%2C${Number(currentGeo.latitude) - 0.01}%2C${Number(currentGeo.longitude) + 0.01}%2C${Number(currentGeo.latitude) + 0.01}&layer=mapnik&marker=${currentGeo.latitude}%2C${currentGeo.longitude}`}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 space-x-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("EditAbout.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={updateLocality.isPending}
            >
              {updateLocality.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {t("EditAbout.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
