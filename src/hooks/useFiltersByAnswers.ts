import { LocalizedString } from './../types/locale-schema';
import { useEffect, useState } from "react";
import { useCocolight } from "./useCocolight";

interface FiltersByAnswersOptions {
    [key: string]: {
        id: string;
        label: string;
        type?: string;
        forms?: string;
        path?: string;
        finderPath?: string;
        value?: {
            [key: string]: {
                id: string;
                finder: string;
            };
        }
    }
}

export interface FilterAnswerType {
    label: LocalizedString;
    values: Record<string, {
        image: string;
        name: string;
        orgaNameArray: string[];
    }>
}

interface FiltersByAnswersResult {
    data: Record<string, FilterAnswerType>;
    isLoading: boolean;
    error: Error | null;
}

export function useFiltersByAnswersQuery(
    query: string,
    options: FiltersByAnswersOptions = {}
): FiltersByAnswersResult {
    const { entity } = useCocolight();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [data, setData] = useState<Record<string, FilterAnswerType>>({});

    const fetchFilters = async () => {
        const params = {
            searchedData: options
        };
        setIsLoading(true);
        setError(null);

        if (!entity) {
            setIsLoading(false);
            setError(new Error("API non initialisée - ni organization ni entity disponible"));
            return null;
        }
        try {
            const result = await entity.coformFiltersSearch(params);

            // Transformer les données : garder les clés principales, mais extraire results sans distinctElements
            const transformedData: Record<string, any> = {};

            if (result && typeof result === 'object') {
                Object.keys(result).forEach(key => {
                    const item = result[key];
                    const label = options[key]?.label || key;
                    if (item?.results) {
                        const { distinctElements, ...filteredResults } = item.results;
                        transformedData[key] = {
                            label,
                            values: filteredResults
                        };
                    }
                });
            }
            setIsLoading(false);
            setData(transformedData);
            return transformedData;
        } catch (err) {
            setIsLoading(false);
            setError(err as Error);
            return null;
        }
    }

    useEffect(() => {
        fetchFilters();
    }, [query, options, entity]);

    return {
        data,
        isLoading,
        error
    };
}