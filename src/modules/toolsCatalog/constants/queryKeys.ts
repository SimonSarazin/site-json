/**
 * Clés React Query du module toolsCatalog. Convention `constants/queryKeys.ts`
 * (cf. coform) : producteurs SCREAMING_SNAKE, tuples figés `as const`, `_PREFIX`
 * pour l'invalidation.
 */
export const TOOLS_CATALOG_QUERY_KEYS = {
  /**
   * Liste paginée (défilement infini).
   * Producteur : `useToolsCatalog`. `filters` hashé par React Query.
   * Invalidation : `LIST_PREFIX` (après une future édition d'enrichissement).
   */
  LIST: (
    formId: string | null,
    step: string | null,
    finderPath: string | null,
    search: string,
    filters: Record<string, unknown>,
  ) => ["toolsCatalog", "list", formId, step, finderPath, search, filters] as const,
  LIST_PREFIX: ["toolsCatalog", "list"] as const,

  /**
   * Détail lazy d'un outil (lieux qui l'utilisent).
   * Producteur : `useToolDetail`. `step`/`finderPath` font partie de la clé car ils
   * changent le périmètre résolu (2 sections même `formId` → pas de collision).
   * Invalidation : `TOOL_USERS_PREFIX`.
   */
  TOOL_USERS: (
    formId: string | null,
    step: string | null,
    finderPath: string | null,
    criteriaIds: string[],
    inputKeys: string[] = [],
  ) =>
    [
      "toolsCatalog",
      "users",
      formId,
      step,
      finderPath,
      [...criteriaIds].sort(),
      [...inputKeys].sort(),
    ] as const,
  TOOL_USERS_PREFIX: ["toolsCatalog", "users"] as const,

  /**
   * Fiche « commun » liée à un outil (contact/canal/tags/description + postes financiers).
   * Producteur : `useCommunInfo`. `formId` (verrou de périmètre) fait partie de la clé.
   */
  COMMUN_INFO: (communId: string | null, formId: string | null) =>
    ["toolsCatalog", "commun", communId, formId] as const,

  /**
   * Options du select de rattachement outil → commun (éditeur d'enrichissement).
   * Producteur : `useCommunList`. Quasi statique → `staleTime` long.
   */
  COMMUN_LIST: (formId: string | null) => ["toolsCatalog", "communList", formId] as const,
} as const;

export type ToolsCatalogQueryKey =
  | ReturnType<typeof TOOLS_CATALOG_QUERY_KEYS.LIST>
  | ReturnType<typeof TOOLS_CATALOG_QUERY_KEYS.TOOL_USERS>
  | ReturnType<typeof TOOLS_CATALOG_QUERY_KEYS.COMMUN_INFO>
  | ReturnType<typeof TOOLS_CATALOG_QUERY_KEYS.COMMUN_LIST>;
