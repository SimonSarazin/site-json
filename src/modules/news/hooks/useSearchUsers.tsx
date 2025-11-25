import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";

export interface SearchedUser {
  id: string;
  slug: string;
  name: string;
  type: string;
  profilThumbImageUrl?: string;
}

/**
 * Hook pour rechercher des utilisateurs/organisations pour l'autocomplete de mentions
 * @param query - Terme de recherche
 * @param enabled - Activer ou désactiver la requête
 */
export function useSearchUsers(query: string, enabled: boolean = true) {
  const { api } = useCocolight();

  return useQuery({
    queryKey: ["search-users", query],
    queryFn: async () => {
      if (!api || query.length < 2) {
        return [];
      }

      try {
        const response = await api.endpointApi.searchMemberAutocomplete({
          search: query,
          searchMode: "personOnly",
        });

        // Transformer les résultats en format standardisé
        if (response && Array.isArray(response)) {
          return response.map((item: any) => ({
            id: item.id || item._id || "",
            slug: item.slug || "",
            name: item.name || "",
            type: item.type || "",
            profilThumbImageUrl: item.profilThumbImageUrl || item.profilImageUrl || "",
          })) as SearchedUser[];
        }

        return [];
      } catch (error) {
        console.error("[useSearchUsers] Error searching users:", error);
        return [];
      }
    },
    enabled: enabled && !!api && query.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}