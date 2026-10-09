import { useQuery } from "@tanstack/react-query";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import { useEntityBySlugQuery } from "@/hooks/useEntityBySlugQuery";
import { BLOG_QUERY_KEYS } from "../constants/queryKeys";

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
  /** Territoires couverts (ex. parent62 : `costumForms.parent62-article`) — absent sur un site qui ne
   *  déclare pas ce champ, cf. `ArticleTaxonomy`. */
  territoires?: string[];
  /** Publics visés (même origine que `territoires`). */
  publics?: string[];
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
  // Typé sur l'instance SDK : c'est ce que `ArticleAdminActions` (permissions, édition, suppression)
  // consomme — un `unknown` ici forçait un `as never` à l'appel, qui désactivait tout contrôle.
  const byId = useQuery<EntityTypes>({
    queryKey: BLOG_QUERY_KEYS.ARTICLE_BY_ID(id ?? ""),
    enabled: !slug && !!id && !loading && !!api,
    queryFn: async () => {
      if (!api) throw new Error("API non initialisée");
      return api.poi({ id: id! });
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
  const useSlug = !!slug;
  const brut = useSlug ? bySlug.data : byId.data;
  const entity: EntityTypes | null = brut ?? null;
  return {
    article: toArticle(brut),
    // L'ENTITÉ SDK, à côté des données aplaties : `toArticle` n'en garde que `serverData`, or éditer
    // ou supprimer exige l'instance elle-même (`delete()`, et le contrat qu'attend `DynamicEditModal`).
    // Exposée telle quelle, sans cast : l'appelant décide de ce qu'il en fait.
    entity,
    isLoading: useSlug ? bySlug.isLoading : byId.isLoading,
    isError: useSlug ? bySlug.isError : byId.isError,
  };
}
