import type { QueryClient } from "@tanstack/react-query";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { getBaseUrl } from "@/lib/constant/common";
import { initApi } from "@/lib/apiClient";
import { QUERY_KEYS } from "../constants/queryKeys";

/**
 * Pré-charge les données d'un profil pour le SSR
 *
 * @param queryClient - Instance de QueryClient pour le cache
 * @param slug - Le slug de l'entité à charger
 * @returns L'entité chargée
 *
 * @example
 * // Dans un loader React Router
 * const entity = await prefetchProfileQuery(queryClient, slug);
 *
 * @example
 * // Pour pré-charger sans attendre
 * queryClient.prefetchQuery({
 *   queryKey: QUERY_KEYS.ELEMENT_ABOUT(slug),
 *   queryFn: () => prefetchProfileQuery(queryClient, slug),
 * });
 */
export async function prefetchProfileQuery(
  queryClient: QueryClient,
  slug: string
): Promise<SearchEntity> {
  return queryClient.ensureQueryData({
    queryKey: QUERY_KEYS.ELEMENT_ABOUT(slug),
    queryFn: async () => {
      const { entity } = await initApi({
        baseURL: getBaseUrl()
      });
      if (!entity) {
        throw new Error("API non initialisée");
      }
      return entity.entityBySlug(slug);
    }
  });
}
