/**
 * Query keys du module admin — centralisées (single source of truth, même pattern que
 * `modules/search/constants/queryKeys.ts`).
 *
 * Producteurs : DashboardSection, AdminModerationSection, AdminResourceTable,
 *   AdminReferenceSection (ces deux derniers via `useSearchQuery` : seul le PREFIX est
 *   fourni ici, le reste de la clé est composé par SEARCH_QUERY_KEYS.RESULTS).
 * Consommateurs invalidants : AdminModerationSection (vote → MODERATION), à terme le
 *   dashboard après mutation (STATS/MODERATION_COUNT).
 */
export const ADMIN_QUERY_KEYS = {
  /** File de modération (news + comments signalés). Invalidée après un vote. */
  MODERATION: ["admin-moderation"] as const,
  /** Détail consolidé des signalements d'un item. */
  MODERATION_DETAIL: (ctx: "news" | "comments" | undefined, id: string | undefined) =>
    ["admin-moderation-detail", ctx, id] as const,
  /** Tuiles du tableau de bord (counts par resource). */
  DASHBOARD_STATS: (costumSlug: string, entityTypes: string[]) =>
    ["admin-dashboard-stats", costumSlug, entityTypes.join(",")] as const,
  /** Tuile modération du tableau de bord (taille de la file). */
  DASHBOARD_MODERATION: ["admin-dashboard-moderation"] as const,
  /** `costum.import.mapping` du carrier (GET_COSTUM_JSON) — pilote la traduction en-têtes d'import. */
  IMPORT_MAPPING: (costumSlug: string) => ["admin-import-mapping", costumSlug] as const,
  /** Formulaire costum dérivé EN LIVE (describeForm → JsonFormConfig) pour un costum sans config.costumForms. */
  COSTUM_FORM_LIVE: (slug: string, collection: string) => ["admin-costum-form-live", slug, collection] as const,

  // ── Préfixes useSearchQuery (le module search compose le reste de la clé) ─────────────
  /** Table de contenu d'une resource. */
  RESOURCE_PREFIX: (entityType: string) => `admin-${entityType}`,
  /** Périmètre d'un KPI `searchCount` du dashboard (l'index de config disambiguïse deux KPIs
   *  sur le même entityType avec des filtres différents). */
  KPI_SEARCH_PREFIX: (index: number, entityType: string) => `admin-kpi-${index}-${entityType}`,
  /** Référencement : recherche globale « à référencer ». */
  REFERENCE_SEARCH_PREFIX: (entityType: string) => `admin-ref-search-${entityType}`,
  /** Référencement : liste des référencés. */
  REFERENCE_LISTED_PREFIX: (entityType: string) => `admin-ref-listed-${entityType}`,
} as const;
