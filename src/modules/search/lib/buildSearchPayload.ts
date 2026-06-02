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
    indexStepMap = 0,
    defaultTypes,
    defaultTags,
    defaultFilters,
    defaultFields,
    defaultSortBy,
    searchBy,
    notSourceKey,
    locality,
  } = baseParams;
  const extra = baseParams as Record<string, unknown>;
  const { name, tags = [], type, mapUsed = false, graphUsed = false, indexStep } = overrides;

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
    ...(defaultFilters && Object.keys(defaultFilters).length > 0 && {
      filters: defaultFilters,
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
