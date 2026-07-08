import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { useEntityBySlugQuery } from "@/hooks/useEntityBySlugQuery";

/** Article normalisé (champs POI type=article utiles au reader). */
export interface ArticleData {
  id?: string;
  name?: string;
  description?: string;
  shortDescription?: string;
  profilImageUrl?: string;
  profilMediumImageUrl?: string;
  created?: number;
  updated?: number;
  tags?: string[];
  slug?: string;
  type?: string;
  parent?: Record<string, { type?: string; name?: string }>;
  source?: { originUrl?: string; key?: string };
  [k: string]: unknown;
}

/** Un article revifié peut être une instance (serverData) ou du JSON déshydraté → on lit serverData sinon l'objet. */
function toArticle(raw: unknown): ArticleData | null {
  if (!raw || typeof raw !== "object") return null;
  const sd = (raw as { serverData?: Record<string, unknown> }).serverData;
  return (sd && typeof sd === "object" ? sd : (raw as Record<string, unknown>)) as ArticleData;
}

/**
 * Charge UN article — par slug (entityBySlug, ~18% des articles) OU par id (api.poi({id}), les ~82% sans slug).
 * `slug` prioritaire s'il est fourni.
 */
export function useArticle({ slug, id }: { slug?: string; id?: string }) {
  const { api, loading } = useCocolight();
  const bySlug = useEntityBySlugQuery({ slug, options: { enabled: !!slug } });
  const byId = useQuery<unknown>({
    queryKey: ["blog:article:id", id],
    enabled: !slug && !!id && !loading && !!api,
    queryFn: async () => {
      if (!api) throw new Error("API non initialisée");
      return api.poi({ id: id! });
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
  const useSlug = !!slug;
  return {
    article: toArticle(useSlug ? bySlug.data : byId.data),
    isLoading: useSlug ? bySlug.isLoading : byId.isLoading,
    isError: useSlug ? bySlug.isError : byId.isError,
  };
}
