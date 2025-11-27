import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { User } from "@communecter/cocolight-api-client";

/**
 * Hook pour rechercher des utilisateurs/organisations pour l'autocomplete de mentions
 * Utilisable dans tous les modules (news, profil, etc.)
 * @param query - Terme de recherche
 * @param enabled - Activer ou désactiver la requête
 */
export function useSearchUsers(query: string, enabled: boolean = true) {
  const { entity } = useCocolight();

  return useQuery({
    queryKey: ["search-users", query],
    queryFn: async () => {
      if (!entity || query.length < 2) {
        return [];
      }

      try {
        const response = await entity.searchMembers({
          search: query,
          searchMode: "personOnly",
        });

        // Transformer les résultats en format standardisé
        if (response && Array.isArray(response)) {
          return response as User[];
        }

        return [];
      } catch (error) {
        console.error("[useSearchUsers] Error searching users:", error);
        return [];
      }
    },
    enabled: enabled && !!entity && query.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}