import { SearchZonesData, ZoneItemNormalized } from "@communecter/cocolight-api-client";
import { useCocolight } from "./useCocolight";
import { useEffect, useState } from "react";
interface SearchZoneOptions {
    countryCode: string[];
    level: string[];
    upperLevelId?: string;
    sortBy?: string;
}

interface SearchZoneResult {
    data: ZoneItemNormalized[];
    isLoading: boolean;
    error: Error | null;
}

export function useSearchZoneQuery(
    queryKey: string,
    options: SearchZoneOptions
): SearchZoneResult {
    const { entity } = useCocolight();
    const [data, setData] = useState<ZoneItemNormalized[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchZones = async () => {
        setIsLoading(true);
        setError(null);
        if (!entity) {
            setIsLoading(false);
            setError(new Error("API non initialisée - ni organization ni entity disponible"));
            return;
        }
        try {
            const results = await entity.searchZone(options as SearchZonesData);
            setData(results);
        } catch (err) {
            setError(err as Error);
        } finally {
            setIsLoading(false);
        }
    };
    useEffect(() => {
        fetchZones();
    }, [queryKey, options, entity]);

    return {
        data,
        isLoading,
        error
    }
}