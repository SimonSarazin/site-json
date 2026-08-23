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
    /**
     * Discrimine deux outils qui partagent des `criteriaIds` — le cas NORMAL, pas
     * l'exception : un `criteriaId` est une ligne de besoin commune à toutes les
     * réponses. Sans lui dans la clé, deux outils du même besoin partageraient le cache.
     */
    normalizedName: string | null = null,
  ) =>
    [
      "toolsCatalog",
      "users",
      formId,
      step,
      finderPath,
      [...criteriaIds].sort(),
      [...inputKeys].sort(),
      normalizedName,
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

  /**
   * Instance SDK `Form` partagée par les queryFn du module (`ensureQueryData`) :
   * `api.form({id})` télécharge le document Form COMPLET, on ne le fait qu'une
   * fois au lieu d'une fois par page de scroll / ouverture de détail. Instance
   * vivante (non sérialisable) — précédent : module notification.
   */
  FORM_INSTANCE: (formId: string | null) => ["toolsCatalog", "formInstance", formId] as const,
} as const;

export type ToolsCatalogQueryKey =
  | ReturnType<typeof TOOLS_CATALOG_QUERY_KEYS.LIST>
  | ReturnType<typeof TOOLS_CATALOG_QUERY_KEYS.TOOL_USERS>
  | ReturnType<typeof TOOLS_CATALOG_QUERY_KEYS.COMMUN_INFO>
  | ReturnType<typeof TOOLS_CATALOG_QUERY_KEYS.COMMUN_LIST>;
