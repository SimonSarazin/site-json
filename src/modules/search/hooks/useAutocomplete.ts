import { useState, useEffect, useCallback } from "react";
import { useCocolight } from "@/hooks/useCocolight";
import { useDebounce } from "@/hooks/useDebounce";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import type { GlobalAutocompleteCostumData } from "@communecter/cocolight-api-client";
import { buildSearchPayload, type SearchBaseParamsInput } from "../lib/buildSearchPayload";

interface UseAutocompleteOptions {
  searchTypes?: GlobalAutocompleteCostumData["searchType"];
  /** Scope réseau — mêmes `baseParams` que le `searchProStatic` de la page. */
  baseParams?: SearchBaseParamsInput;
  /** Variant SDK `searchCostum` (ex. `"navigator-tl"`) — comme la liste. */
  variant?: "default" | "navigator-tl";
  /** Tags de filtres actifs (catégorie/tab) — appliqués comme la liste. */
  tags?: string[];
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
    // Pas de default : par défaut les types viennent de `baseParams.defaultTypes`
    // (parité avec la liste). Un override explicite reste possible.
    searchTypes,
    baseParams,
    variant,
    tags,
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
        // Même construction de payload que la liste (`useSearchQuery`) → l'autocomplete
        // interroge le même périmètre réseau (costumSlug/contextId/sourceKey…).
        const param = buildSearchPayload(baseParams, {
          name: searchQuery,
          type: searchTypes as unknown as string[] | undefined,
          tags,
          indexStep: indexMax,
        });
        const result =
          variant && variant !== "default"
            ? await entity.searchCostum(param, { variant })
            : await entity.searchCostum(param);

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
    [entity, helper, searchTypes, baseParams, variant, tags, indexMax, minChars]
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
