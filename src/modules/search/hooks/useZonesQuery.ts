import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import type { ZoneSelectorConfig } from "../schema";

interface ZoneTranslate {
  translates: Record<string, string>;
}

export interface Zone {
  id: string;
  _id: { _str: string } | { $id: string } | string;
  name: string;
  countryCode: string;
  level?: (string | number)[];
  geo?: {
    latitude: string | number;
    longitude: string | number;
  };
  translate?: ZoneTranslate;
}

export function getZoneId(zone: Zone): string {
  if (zone.id) return zone.id;
  if (typeof zone._id === "object") {
    if ("_str" in zone._id) return zone._id._str;
    if ("$id" in zone._id) return zone._id.$id;
  }
  if (typeof zone._id === "string") return zone._id;
  return "";
}

export function getZoneName(zone: Zone, locale: string): string {
  const localeCode = locale.toUpperCase();

  if (zone.translate?.translates?.[localeCode]) {
    return zone.translate.translates[localeCode];
  }

  return zone.name;
}

interface UseZonesQueryProps {
  zoneSelector?: ZoneSelectorConfig;
}

export function useZonesQuery({ zoneSelector }: UseZonesQueryProps) {
  const { apiClient } = useCocolight();

  const isEnabled = !!apiClient && !!zoneSelector?.show;

  const { data: zones, isLoading, error, refetch } = useQuery({
    queryKey: [
      "zones-selector",
      zoneSelector?.show,
      zoneSelector?.countryCode,
      zoneSelector?.level,
      zoneSelector?.sortBy,
      zoneSelector?.costumSlug,
      zoneSelector?.costumId,
      zoneSelector?.costumType,
    ],
    queryFn: async () => {

      if (!apiClient || !zoneSelector?.show) {
        return [];
      }

      const response = await apiClient.callEndpoint("SEARCH_GET_ZONE", {
        countryCode: zoneSelector.countryCode || ["RE"],
        level: zoneSelector.level || [1],
        sortBy: zoneSelector.sortBy || "name",
        ...(zoneSelector.costumSlug && { costumSlug: zoneSelector.costumSlug }),
        ...(zoneSelector.costumEditMode !== undefined && { costumEditMode: zoneSelector.costumEditMode }),
        ...(zoneSelector.costumId && { costumId: zoneSelector.costumId }),
        ...(zoneSelector.costumType && { costumType: zoneSelector.costumType }),
      });

      return response.data as Zone[];
    },
    enabled: isEnabled,
    staleTime: 5 * 60 * 1000, 
  });

  return {
    zones: zones || [],
    isLoading,
    error,
    refetch,
  };
}
