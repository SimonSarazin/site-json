import type { GlobalAutocompleteCostumData } from "@communecter/cocolight-api-client";
import type { SearchType } from "../schema";

/**
 * Forme des `baseParams` acceptés par {@link buildSearchPayload}. Identique au
 * champ `baseParams` de `useSearchQuery` — c'est la même donnée de scope (issue
 * de la config `searchProStatic`). Les champs de scope `contextId`/`contextType`/
 * `costumSlug`/`costumEditMode`/`sourceKey` ne sont pas typés ici : ils sont lus
 * via un cast `Record<string, unknown>` (présents en config mais hors type strict).
 */
export interface SearchBaseParamsInput {
  fediverse?: boolean;
  indexStepList?: number;
  indexStepMap?: number;
  defaultTypes?: SearchType[];
  defaultTags?: string[];
  defaultFilters?: Record<string, unknown>;
  defaultFields?: string[];
  defaultSortBy?: Record<string, 1 | -1>;
  searchBy?: string | string[];
  notSourceKey?: boolean | number;
  /**
   * Opt-OUT du filtre de validation (cf. {@link applyValidationGate}). Miroir du param legacy
   * `showTobevaledated` (SearchNew::getQueries:783) : à `true`, les éléments EN ATTENTE ne sont
   * plus masqués. L'admin le pose (il gère la validation via son propre `statusFilter`).
   */
  showUnvalidated?: boolean;
  locality?: Record<string, {
    name?: string;
    active?: boolean;
    id: string;
    countryCode?: string;
    level?: string | number;
    type: string;
    key?: string;
  }>;
}

export interface BuildSearchPayloadOverrides {
  /** Texte recherché (`name`). */
  name: string;
  /** Tags à plat (filtres cochés). Écrasés par `defaultTags` si présents. */
  tags?: string[];
  /**
   * `searchType` à plat. Reproduit la condition exacte de `useSearchQuery` :
   * - tableau non vide → utilisé tel quel,
   * - `undefined` → on retombe sur `baseParams.defaultTypes`,
   * - `[]` (tableau vide) → ni l'un ni l'autre (comportement liste préservé).
   */
  type?: string[];
  mapUsed?: boolean;
  graphUsed?: boolean;
  /** Override explicite de l'`indexStep` (ex. autocomplete : petit nombre). */
  indexStep?: number;
  /**
   * Variant SDK (`admin` → `globalautocompleteadmin`). Transmis pour que {@link applyValidationGate}
   * ne s'applique JAMAIS en mode admin (l'admin doit voir les éléments en attente).
   */
  variant?: string;
}

/**
 * Collections « élément » où le flag de validation costum (`toBeValidated`) a un sens. Les news
 * (`scope`/`target`), `answers`/`proposals` (survey) ont un modèle de visibilité distinct → jamais gatées.
 * Inclut les sous-types d'organisation (NGO/LocalBusiness/…), qui sont des éléments à part entière.
 */
const VALIDATABLE_TYPES = new Set<string>([
  "poi", "organizations", "projects", "events", "citoyens",
  "NGO", "LocalBusiness", "Group", "GovernmentOrganization", "Cooperative",
]);

/** PHP-truthy sur `notSourceKey` (peut valoir 0/1, "0"/"1", ou bool). */
function isTruthy(v: unknown): boolean {
  return !!v && v !== "0" && v !== 0;
}

/**
 * Porte côté client le filtre de VALIDATION du legacy (SearchNew::getQueries:783-818), pour les
 * searches PUBLIQUES scopées costum : masque les éléments EN ATTENTE de validation via le **double
 * flag** `preferences.toBeValidated.<slug>` ET `source.toBeValidated.<slug>` (les deux voies legacy).
 *
 * Pourquoi côté client : le backend Node `buildQuery` est STATELESS (ne pose jamais `toBeValidated`),
 * et le legacy 5080 ne le pose que si le cache costum est chaud (non déterministe). Un filtre client
 * explicite rend le comportement déterministe sur les deux backends.
 *
 * ACTIF PAR DÉFAUT dès qu'un scope costum est présent ; NON appliqué si :
 *  - `showUnvalidated` (opt-out, miroir du `showTobevaledated` legacy),
 *  - `variant === 'admin'` (l'admin gère la validation par son `statusFilter`),
 *  - `notSourceKey` (réseau-wide : pas de costum de scope → pas de slug à indexer),
 *  - types explicitement hors collections « élément » (news/answers : visibilité par `scope`, route dédiée).
 *
 * Divergence ASSUMÉE vs legacy : PAS de branche `author-sees-own` (creator==me). Le client est
 * stateless (comme le backend Node) → un fil public montre les validés uniquement. Cf docs/module-articles-blog.md §16.
 */
function applyValidationGate(
  filters: Record<string, unknown> | undefined,
  opts: { costumSlug?: unknown; notSourceKey?: unknown; types?: string[]; showUnvalidated?: boolean; variant?: string },
): Record<string, unknown> | undefined {
  const { costumSlug, notSourceKey, types, showUnvalidated, variant } = opts;
  if (showUnvalidated || variant === "admin") return filters;
  if (typeof costumSlug !== "string" || !costumSlug) return filters;
  if (isTruthy(notSourceKey)) return filters;
  if (types && types.length > 0 && !types.every((t) => VALIDATABLE_TYPES.has(t))) return filters;
  return {
    ...(filters ?? {}),
    [`preferences.toBeValidated.${costumSlug}`]: { $exists: false },
    [`source.toBeValidated.${costumSlug}`]: { $exists: false },
  };
}

/**
 * Source unique de la transformation `baseParams → payload searchCostum`.
 *
 * Réutilisé par :
 *  - `useSearchQuery` (liste paginée `searchProStatic`/`searchPro`),
 *  - `useAutocomplete` (suggestions du hero), pour interroger **le même périmètre**
 *    réseau que la liste (mêmes `costumSlug`/`contextId`/`sourceKey`/`searchType`…).
 *
 * NE construit PAS la donnée de scope : celle-ci vient des `baseParams` (cf.
 * `canonicalSearchProStaticBaseParams` qui les normalise en amont). Le `variant`
 * SDK (2e argument de `searchCostum`) est géré par l'appelant.
 */
export function buildSearchPayload(
  baseParams: SearchBaseParamsInput = {},
  overrides: BuildSearchPayloadOverrides,
): Partial<GlobalAutocompleteCostumData> {
  const {
    fediverse = false,
    indexStepList = 10,
    // Carte : pages de 500 enchaînées par le paginator SDK (chargement
    // PROGRESSIF — cf. useSearchAllResults). `indexStepMap: 0` en config
    // restaure l'ancien tout-en-1-appel. Sondé : indexMin manuel est ignoré
    // par le backend, seul `page.next()` pagine ; le paginator fonctionne
    // avec `mapUsed: true` (recouvrement 0).
    indexStepMap = 500,
    defaultTypes,
    defaultTags,
    defaultFilters,
    defaultFields,
    defaultSortBy,
    searchBy,
    notSourceKey,
    showUnvalidated,
    locality,
  } = baseParams;
  const extra = baseParams as Record<string, unknown>;
  const { name, tags = [], type, mapUsed = false, graphUsed = false, indexStep, variant } = overrides;

  // Types effectifs (mêmes règles que `param.searchType` plus bas) → garde collection du filtre validation.
  const effectiveTypes = type && type.length > 0 ? type : (defaultTypes as string[] | undefined);
  // Filtre de validation costum posé PAR DÉFAUT (double flag), sauf opt-out/admin/réseau-wide/non-élément.
  const gatedFilters = applyValidationGate(defaultFilters, {
    costumSlug: extra.costumSlug,
    notSourceKey,
    types: effectiveTypes,
    showUnvalidated,
    variant,
  });

  const indexing =
    indexStep !== undefined
      ? { indexMin: 0, indexStep }
      : graphUsed
        ? { indexMin: 0, indexStep: 0 }
        : mapUsed
          ? { mapUsed: true, indexMin: 0, indexStep: indexStepMap }
          : { indexMin: 0, indexStep: indexStepList };

  const param: Partial<GlobalAutocompleteCostumData> = {
    name,
    fediverse,
    ...indexing,
    ...(tags.length > 0 && {
      searchTags: tags,
      options: { tags: { verb: "$all" } },
    }),
    ...(gatedFilters && Object.keys(gatedFilters).length > 0 && {
      filters: gatedFilters,
    }),
    ...(defaultFields && defaultFields.length > 0 && {
      fields: defaultFields,
    }),
    ...(defaultSortBy && Object.keys(defaultSortBy).length > 0 && {
      sortBy: defaultSortBy,
    }),
    ...(locality && Object.keys(locality).length > 0 && { locality: locality as GlobalAutocompleteCostumData["locality"] }),
    ...(searchBy !== undefined && {
      searchBy: searchBy as GlobalAutocompleteCostumData["searchBy"],
    }),
    ...(notSourceKey ? { notSourceKey: true } : {}),
    ...(extra.contextId ? { contextId: extra.contextId as string } : {}),
    ...(extra.contextType ? { contextType: extra.contextType as GlobalAutocompleteCostumData["contextType"] } : {}),
    ...(extra.costumSlug ? { costumSlug: extra.costumSlug as string } : {}),
    ...(extra.costumEditMode !== undefined ? { costumEditMode: extra.costumEditMode as boolean } : {}),
    ...(extra.sourceKey ? { sourceKey: extra.sourceKey as string[] } : {}),
  } as Partial<GlobalAutocompleteCostumData>;

  if (type && type.length > 0) {
    param.searchType = type as unknown as GlobalAutocompleteCostumData["searchType"];
  } else if (!type && defaultTypes) {
    param.searchType = defaultTypes as unknown as GlobalAutocompleteCostumData["searchType"];
  }
  if (defaultTags && defaultTags.length > 0) {
    param.searchTags = defaultTags;
  }

  return param;
}
