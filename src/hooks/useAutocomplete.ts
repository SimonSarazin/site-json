import { useState, useEffect, useCallback } from "react";
import { useCocolight } from "@/hooks/useCocolight";
import { useDebounce } from "@/hooks/useDebounce";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import type { GlobalAutocompleteCostumData } from "@communecter/cocolight-api-client";

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

  const { entity, helper } = useCocolight();
  const [suggestions, setSuggestions] = useState<SearchEntity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Utilisation du hook useDebounce au lieu d'un setTimeout manuel
  const debouncedQuery = useDebounce(query, debounceMs);

  const fetchSuggestions = useCallback(
    async (searchQuery: string) => {
      if (!entity || searchQuery.length < minChars) {
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
        };
        const result = await entity.searchCostum(param);

        // Les results sont un objet avec des IDs comme clés, pas un tableau
        const resultsObj = result?.results || {};
        const resultsArray = Object.values(resultsObj);

        // Transformer les entités JSON en entités Cocolight
        const transformedResults = resultsArray.flatMap((d: unknown) => {
          if (d && typeof d === 'object' && 'getEntityType' in d) return d as SearchEntity;
          return helper.fromEntityJSON(d, entity) as SearchEntity;
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
    [entity, helper, searchTypes, indexMax, minChars]
  );

  useEffect(() => {
    if (debouncedQuery.length >= minChars) {
      fetchSuggestions(debouncedQuery);
    } else {
      setSuggestions([]);
      setIsLoading(false);
    }
  }, [debouncedQuery, fetchSuggestions, minChars]);

  return { suggestions, isLoading, error };
}
