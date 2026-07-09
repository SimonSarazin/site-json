import type { QueryClient } from "@tanstack/react-query";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { getBaseUrl } from "@/lib/constant/common";
import { initApi } from "@/lib/apiClient";
import { PROFIL_QUERY_KEYS } from "@/modules/profil/constants/queryKeys";
import { BLOG_QUERY_KEYS } from "../constants/queryKeys";

/**
 * Prefetch SSR d'un article par slug — même clé de cache que `useEntityBySlugQuery`
 * (PROFIL_QUERY_KEYS.ELEMENT_ABOUT) → le reader lit le cache dehydraté (HTML complet côté serveur, SEO).
 */
export async function prefetchArticleBySlug(queryClient: QueryClient, slug: string): Promise<SearchEntity> {
  return queryClient.ensureQueryData({
    queryKey: PROFIL_QUERY_KEYS.ELEMENT_ABOUT(slug),
    queryFn: async () => {
      const { entity } = await initApi({ baseURL: getBaseUrl() });
      if (!entity) throw new Error("API non initialisée");
      return entity.entityBySlug(slug);
    },
  });
}

/**
 * Prefetch SSR d'un article par id (les ~82% d'articles slugless) — MÊME clé que la branche `byId`
 * de `useArticle` (`["blog:article:id", id]`) → le reader lit le cache déshydraté et rend le SEO côté serveur.
 */
export async function prefetchArticleById(queryClient: QueryClient, id: string): Promise<unknown> {
  return queryClient.ensureQueryData({
    queryKey: BLOG_QUERY_KEYS.ARTICLE_BY_ID(id),
    queryFn: async () => {
      const { api } = await initApi({ baseURL: getBaseUrl() });
      if (!api) throw new Error("API non initialisée");
      return api.poi({ id });
    },
  });
}
