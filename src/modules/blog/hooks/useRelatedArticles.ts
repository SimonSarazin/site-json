import { useQuery } from "@tanstack/react-query";
import { useHydrated } from "@/hooks/useHydrated";
import { useCocolight } from "@/hooks/useCocolight";
import { buildSearchPayload } from "@/modules/search/lib/buildSearchPayload";
import { BLOG_QUERY_KEYS } from "../constants/queryKeys";
import type { ArticleData } from "./useArticle";

/** Résultat searchCostum → ArticleData (serverData sinon racine, repli id racine). */
function normArticle(r: unknown): ArticleData {
  const sd = (r as { serverData?: Record<string, unknown> })?.serverData;
  const base = (sd && typeof sd === "object" ? sd : (r as Record<string, unknown>)) as ArticleData;
  if (base.id != null) return base;
  const rootId = (r as { id?: unknown })?.id;
  return rootId != null ? { ...base, id: String(rootId) } : base;
}

/**
 * Articles LIÉS à un article : mêmes tags (`$in` = au moins un tag partagé), scopés au MÊME costum
 * (`source.key`), triés par date, en EXCLUANT l'article courant. Île client (`enabled: hydrated`) → ne
 * bloque pas le SSR du reader ; désactivé si l'article n'a pas de tags (sinon `{$in:[]}` = vide de toute façon).
 */
export function useRelatedArticles(article: ArticleData | null | undefined, limit = 4) {
  const hydrated = useHydrated();
  const { entity } = useCocolight();
  const tags = Array.isArray(article?.tags) ? article!.tags!.filter(Boolean) : [];
  const costumSlug = article?.source?.key ?? "";
  const currentId = article?.id ?? "";
  const enabled = hydrated && !!entity && !!costumSlug && tags.length > 0;

  const q = useQuery({
    queryKey: BLOG_QUERY_KEYS.RELATED(costumSlug, currentId, tags),
    enabled,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const payload = buildSearchPayload(
        {
          // Masquage des liés EN ATTENTE : posé automatiquement par applyValidationGate (costumSlug présent). Cf §16.
          defaultFilters: { type: "article", tags: { $in: tags } },
          defaultSortBy: { created: -1 },
          costumSlug,
          sourceKey: [costumSlug],
        } as never,
        { name: "", type: ["poi"], indexStep: limit + 4 },
      );
      const page = (await entity!.searchCostum(
        payload as unknown as Parameters<typeof entity.searchCostum>[0],
      )) as unknown as { results?: unknown[] };
      return page?.results ?? [];
    },
  });

  const articles = ((q.data as unknown[]) ?? [])
    .map(normArticle)
    .filter((a) => a.id && a.id !== currentId) // exclut l'article courant
    .slice(0, limit);
  return { articles, isLoading: q.isLoading };
}
