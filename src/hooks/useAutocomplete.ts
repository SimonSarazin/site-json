import { useState, useEffect, useCallback } from "react";
import { useCocolight } from "@/hooks/useCocolight";
import { SearchEntity } from "@/modules/search/schema";
import { GlobalAutocompleteCostumData } from "@communecter/cocolight-api-client";

interface UseAutocompleteOptions {
  searchTypes?: GlobalAutocompleteCostumData["searchType"];
  indexMax?: number;
  debounceMs?: number;
  minChars?: number;
}

interface UseAutocompleteResult {
  suggestions: SearchEntity[];
  isLoading: boolean;
  error: Error | null;
}

export function useAutocomplete(
  query: string,
  options: UseAutocompleteOptions = {}
): UseAutocompleteResult {
  const {
    searchTypes = ["NGO", "LocalBusiness", "citoyens", "projects", "poi"] as GlobalAutocompleteCostumData["searchType"],
    indexMax = 30,
    debounceMs = 300,
    minChars = 2,
  } = options;

  const { organization, helper } = useCocolight();
  const [suggestions, setSuggestions] = useState<SearchEntity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchSuggestions = useCallback(
    async (searchQuery: string) => {
      if (!organization || searchQuery.length < minChars) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const param: Partial<GlobalAutocompleteCostumData> = {
          name: searchQuery,
          searchType: searchTypes,
          indexMin: 0,
          indexStep: indexMax,
        }
        // Utilisation de organization.searchCostum avec paramètres minimaux
        const result = await organization.searchCostum(param);

        // Les results sont un objet avec des IDs comme clés, pas un tableau
        const resultsObj = result?.results || {};

        // Convertir l'objet en tableau de valeurs
        const resultsArray = Object.values(resultsObj);

        // Transformer les entités JSON en entités Cocolight
        const transformedResults = resultsArray.flatMap((d: any) => {
          if (d?.getEntityType) return d;
          return helper.fromEntityJSON(d, organization);
        });

        setSuggestions(transformedResults);
      } catch (err) {
        console.error("Error fetching autocomplete suggestions:", err);
        setError(err instanceof Error ? err : new Error("Unknown error"));
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    },
    [organization, helper, searchTypes, indexMax, minChars]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= minChars) {
        fetchSuggestions(query);
      } else {
        setSuggestions([]);
        setIsLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, fetchSuggestions, debounceMs, minChars]);

  return { suggestions, isLoading, error };
}
