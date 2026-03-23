import { LocalizedString } from './../types/locale-schema';
import { useEffect, useState } from "react";
import { useCocolight } from "./useCocolight";

interface FiltersByAnswersOptions {
    [key: string]: {
        id: string;
        label: LocalizedString;
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

    useEffect(() => {
        let isCancelled = false;

        const run = async () => {
            // Decale les mises a jour d'etat pour eviter les setState synchrones dans l'effet.
            await Promise.resolve();

            if (isCancelled) {
                return;
            }

            setIsLoading(true);
            setError(null);

            if (!entity) {
                setIsLoading(false);
                setError(new Error("API non initialisée - ni organization ni entity disponible"));
                return;
            }

            const params = {
                searchedData: options
            };

            try {
                const result = await entity.coformFiltersSearch(params);

                if (isCancelled) {
                    return;
                }

                // Transformer les donnees : garder les cles principales, sans distinctElements.
                const transformedData: Record<string, FilterAnswerType> = {};

                if (result && typeof result === "object") {
                    for (const [key, rawItem] of Object.entries(result as Record<string, unknown>)) {
                        const label = options[key]?.label || key;

                        if (!rawItem || typeof rawItem !== "object") {
                            continue;
                        }

                        const item = rawItem as { results?: unknown };
                        if (!item.results || typeof item.results !== "object") {
                            continue;
                        }

                        const filteredResults = Object.fromEntries(
                            Object.entries(item.results as Record<string, unknown>).filter(
                                ([resultKey]) => resultKey !== "distinctElements"
                            )
                        ) as FilterAnswerType["values"];

                        transformedData[key] = {
                            label,
                            values: filteredResults
                        };
                    }
                }

                setData(transformedData);
                setIsLoading(false);
            } catch (err) {
                if (isCancelled) {
                    return;
                }

                setIsLoading(false);
                setError(err as Error);
            }
        };

        void run();

        return () => {
            isCancelled = true;
        };
    }, [query, options, entity]);

    return {
        data,
        isLoading,
        error
    };
}