import { useMemo } from "react";
import { useSearchQuery } from "@/modules/search/hooks/useSearchQuery";
import { usePageFiltersOptional } from "@/modules/search/contexts/pageFilters";
import { searchByFieldsToQuery } from "@/modules/search/lib/searchByFieldsToQuery";
import { mergeMongoFilters } from "@/modules/search/lib/mongoFilters";
import { BLOG_QUERY_KEYS } from "../constants/queryKeys";
import { articleFields } from "../constants/fields";

/**
 * Fil d'articles d'un costum (POI type=article, scope source.key) — paginé, trié par date décroissante.
 * Réutilise `useSearchQuery` (searchCostum) : searchType poi + defaultFilters type=article + scope costum.
 *
 * **Piloté par le `PageFilters` partagé de la page** (exactement comme `SearchProStatic`) : un `heroSearch`
 * ou un `searchHeader` de la MÊME page écrit le texte + les filtres → le fil re-requête automatiquement
 * (la queryKey de useSearchQuery inclut searchText/searchTags/baseParams). Le filtrage est donc
 * CONFIG-DRIVEN et agnostique au champ :
 *  - filtres SANS `field` (types/tags) → `searchTags` ($all) ;
 *  - filtres AVEC `field` (ex. un champ `list` ajouté au costum form article) → `{ <field>: { $in } }`
 *    fusionné dans `defaultFilters` (via `searchByFieldsToQuery`, comme la liste search).
 * Hors provider PageFilters, tout est vide → fil de base (comportement P0).
 */
export interface UseArticleFeedParams {
  costumSlug: string;
  pageSize?: number;
  filters?: Record<string, unknown>;
  /** Tri serveur (défaut `{created:-1}`). Doit être IDENTIQUE entre fil et épinglée. */
  sortBy?: Record<string, 1 | -1>;
  /** Champs projetés EN PLUS du contrat d'article du module (cf. ARTICLE_FIELDS). */
  defaultFields?: readonly string[];
}

export function useArticleFeed({ costumSlug, pageSize = 12, filters, sortBy, defaultFields }: UseArticleFeedParams) {
  const cf = usePageFiltersOptional();
  const searchText = cf?.searchQuery ?? "";
  const filterNames = cf?.filterNames;
  const searchByFields = cf?.searchByFields;

  // Filtres sans `field` (types/tags cochés) → searchTags ($all). Clé canonique `tags` (comme
  // SearchProStatic) — buildSearchPayload aplatit de toute façon les valeurs, mais on garde la convention.
  const searchTags = useMemo(
    (): Record<string, string[]> => (filterNames && filterNames.length ? { tags: [...filterNames] } : {}),
    [filterNames],
  );
  // Filtres avec `field` (ex. champ `list` du costum) → filtres Mongo `{ field: { $in } }`
  // (locality/sourceKeys ignorés : le fil est scopé au costum, pas de scopeList — cf. doc §14).
  const fieldFilters = useMemo(
    () => searchByFieldsToQuery(searchByFields ?? {}).filters,
    [searchByFields],
  );

  return useSearchQuery({
    queryKeyPrefix: BLOG_QUERY_KEYS.FEED_PREFIX(costumSlug),
    searchText,
    searchTags,
    // ⚠ searchType explicite obligatoire (buildSearchPayload n'applique defaultTypes que si type===undefined).
    searchType: { type: ["poi"] },
    mapUsed: false,
    baseParams: {
      indexStepList: pageSize,
      // fieldFilters fusionnés comme `canonicalSearchProStaticBaseParams` (dans defaultFilters).
      // NB : le masquage des articles EN ATTENTE de validation (double flag toBeValidated) est posé
      // AUTOMATIQUEMENT par buildSearchPayload (applyValidationGate) dès qu'un costumSlug est présent.
      // Cf doc/19-visibility-system.md (Visibilité des données) + doc/32-module-articles-blog.md.
      // `type: "article"` en DERNIER = garantie d'immuabilité (un filtre field:"type" ne peut pas l'écraser).
      defaultFilters: { ...mergeMongoFilters(filters ?? {}, fieldFilters), type: "article" },
      defaultSortBy: sortBy ?? { created: -1 },
      // Projection EXPLICITE : sans elle le legacy réduit le POI et retire `publicationDate`
      // (la date éditoriale affichée par les cartes) et `category`. Cf. constants/fields.ts.
      defaultFields: articleFields(defaultFields),
      // scope costum : lus par buildSearchPayload via cast (présents en config, hors type strict).
      costumSlug,
      sourceKey: [costumSlug],
    } as never,
  });
}

/**
 * L'article ÉPINGLÉ du scope (mode `featured:"flag"`) : micro-requête serveur `{featured:true}`,
 * 1 résultat, même tri que le fil (la plus récente des épinglées si un double-flag résiduel
 * traîne — rien ne disparaît, le fil liste tout). `enabled` : ne fetch qu'en mode flag.
 * Requête SERVEUR délibérément (pas un scan de la fenêtre chargée) : l'épinglée peut être
 * ancienne et vivre hors des pages chargées — la leçon du finding review MR 44.
 */
export function usePinnedArticle({ costumSlug, filters, sortBy, defaultFields, enabled }: {
  costumSlug: string;
  filters?: Record<string, unknown>;
  sortBy?: Record<string, 1 | -1>;
  defaultFields?: readonly string[];
  enabled: boolean;
}) {
  return useSearchQuery({
    queryKeyPrefix: BLOG_QUERY_KEYS.FEED_PREFIX(costumSlug),
    searchText: "",
    searchTags: {},
    searchType: { type: ["poi"] },
    mapUsed: false,
    enabled,
    baseParams: {
      indexStepList: 1,
      // `featured` puis `type` en DERNIER : un filtre de config ne peut écraser ni l'un ni l'autre.
      defaultFilters: { ...(filters ?? {}), featured: true, type: "article" },
      defaultSortBy: sortBy ?? { created: -1 },
      defaultFields: articleFields(defaultFields),
      costumSlug,
      sourceKey: [costumSlug],
    } as never,
  });
}
