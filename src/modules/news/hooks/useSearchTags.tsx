import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";

/**
 * Hook pour rechercher des tags pour l'autocomplete
 * @param query - Terme de recherche
 * @param enabled - Activer ou désactiver la requête
 */
export function useSearchTags(query: string, enabled: boolean = true) {
  const { api } = useCocolight();

  return useQuery({
    queryKey: ["search-tags", query],
    queryFn: async () => {
      if (!api || query.length < 2) {
        return [];
      }

      try {
        const response = await api.endpointApi.searchTags({
          pathParams: { q: query },
        });

        // L'API retourne un tableau d'objets avec un champ tag
        if (response && Array.isArray(response)) {
          return response
            .map((item: unknown) => {
              if (typeof item === 'object' && item !== null && 'tag' in item) {
                return (item as { tag: unknown }).tag;
              }
              return null;
            })
            .filter((tag: unknown): tag is string => typeof tag === "string" && tag.length > 0);
        }
      } catch (error) {
        console.error("[useSearchTags] Error searching tags:", error);
        return [];
      }
    },
    enabled: enabled && !!api && query.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}