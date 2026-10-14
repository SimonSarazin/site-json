/**
 * Query keys du module search — centralisées (single source of truth).
 *
 * Producteurs : `useSearchQuery`, `prefetchSearchResults`
 * Consommateurs invalidants (tous par `RESULTS_PREFIX`) : `SearchProStatic` et
 *   `PreviewCoformAnswer` (écriture d'une answer CoForm — listes statiques ET listes
 *   gérées du compte, `MANAGED_ANSWERS_PREFIX`), `useAnswerCreated` (création depuis une
 *   liste), `addStandard` (création/édition d'entité), `PreviewPoiAmenities` (suppression
 *   de POI), `ManagedStructureItem` (créneau ajouté depuis l'onglet profil « Structures »).
 *   Sinon refetch via `refetch()` ou changement des params (qui change la
 *   queryKey naturellement).
 *
 * `variant` est inclus dans la clé pour isoler les caches de variants SDK
 * (`default` vs `navigator-tl`) — sans cette dimension, un consommateur
 * `navigator-tl` pourrait se voir servir un cache `default` aux champs
 * différents.
 *
 * Le `queryKeyPrefix` est passé par le call-site car le module search est
 * utilisé par plusieurs sections (annuaire, carte, graph, etc.) avec des
 * préfixes différents — il ne peut pas être figé comme pour `ampli`.
 */
/**
 * Préfixes des deux queries d'une section `searchProStatic` (liste / carte).
 * Partagés entre les queries elles-mêmes (`SearchProStatic`) et les
 * invalidations post-écriture d'answer (`SearchProStatic`,
 * `PreviewCoformAnswer`) — un littéral divergent invaliderait dans le vide.
 *
 * ⚠️ Les MÊMES littéraux vivent encore ailleurs (prefetch SSR `buildRoutes`,
 * `addStandard`, `PreviewPoiAmenities`) : les rallier ici est une dette ouverte,
 * hors périmètre de ce lot.
 */
export const SEARCH_STATIC_LIST_PREFIX = "searchCostumStatic";
export const SEARCH_STATIC_MAP_PREFIX = "searchCostumStaticMapAll";

/**
 * Préfixe de la recherche de DOUBLONS à la création d'une entité (slot `slot:entityDuplicates`
 * des formulaires costum). Producteur : `useEntityDuplicates` (module profil). Invalidation :
 * `invalidate:standard` via `mutation.invalidateFn.params.searchKeys` du formulaire — une entité
 * tout juste créée doit apparaître à la saisie suivante du même nom.
 */
export const SEARCH_DUPLICATES_PREFIX = "entityDuplicates";

export interface SearchQueryKeyParams {
  queryKeyPrefix: string;
  searchText: string;
  searchTags: Record<string, string[]>;
  searchType: Record<string, string[]> | null;
  mapUsed: boolean;
  graphUsed?: boolean;
  baseParams: Record<string, unknown>;
  /**
   * Variant SDK (`default` ou `navigator-tl`). Inclus dans la queryKey pour
   * éviter qu'un cache de variant `default` ne contamine un consommateur
   * `navigator-tl` (les résultats ont des champs différents).
   */
  variant?: string;
}

export const SEARCH_QUERY_KEYS = {
  /**
   * Résultats de recherche paginés.
   *
   * Producteurs : `useSearchQuery`, `prefetchSearchResults`
   * Consommateurs invalidants : `SearchProStatic` et `PreviewCoformAnswer` (création /
   *   édition d'une answer CoForm — ex. créneau), `addStandard`, `PreviewPoiAmenities`,
   *   `ManagedStructureItem` (`MANAGED_ANSWERS_PREFIX`, par utilisateur) — tous par `RESULTS_PREFIX`.
   */
  RESULTS: (params: SearchQueryKeyParams) =>
    [
      params.queryKeyPrefix,
      params.searchText,
      JSON.stringify(params.searchTags),
      JSON.stringify(params.searchType),
      params.mapUsed,
      params.graphUsed ?? false,
      JSON.stringify(params.baseParams),
      params.variant ?? "default",
    ] as const,
  /**
   * Préfixe minimal pour invalidation cross-recherche (toutes les variations
   * de filtres pour un préfixe donné).
   */
  RESULTS_PREFIX: (queryKeyPrefix: string) => [queryKeyPrefix] as const,
  /**
   * `queryKeyPrefix` des listes de réponses CoForm GÉRÉES par un compte (onglet profil « Structures » :
   * les créneaux de chaque structure qu'il administre, et ceux qu'il a déposés ailleurs). Une CHAÎNE,
   * partagée par toutes ces listes, qui se distinguent par leurs `baseParams` (dans la clé) :
   * l'invalidation compare la clé élément par élément, un préfixe par structure serait inatteignable
   * d'un seul appel. Le compte est DANS le préfixe : le serveur montre à chacun des réponses non
   * validées différentes. Défini ici et non dans profil pour que `PreviewCoformAnswer` l'invalide
   * après une modification sans importer profil (cf. `SEARCH_DUPLICATES_PREFIX`).
   * Producteur : `useManagedAnswers` (`ManagedStructureItem`, `SubmittedSlotsItem`).
   * Consommateurs invalidants (par `RESULTS_PREFIX`) : `PreviewCoformAnswer` (après une
   * modification), `ManagedStructureItem` (après un ajout depuis l'onglet), `useAnswerCreated`
   * (après un ajout depuis une liste, ex. /creneaux).
   */
  MANAGED_ANSWERS_PREFIX: (userId: string): string => `managed-answers:${userId}`,
  /**
   * Réservations CoForm d'une ressource (section réservations du preview
   * `poi-amenities`).
   *
   * Producteur : `useReservationsQuery`. Données PUBLIQUES (endpoint
   * answerslist public → pas de dimension userId). Invalidation : aucune —
   * staleTime + refetch au remontage suffisent.
   */
  RESERVATIONS: (formId: string, resourceId: string) =>
    ["search-reservations", formId, resourceId] as const,
  /**
   * Réservations d'une ORGANISATION : answers dont le finder `userOrga` pointe
   * ce club (section « équipements réservés » du preview `structure`).
   *
   * Producteur : `useOrgaReservationsQuery`. Clé distincte de `RESERVATIONS`
   * (qui part d'une RESSOURCE) : les deux interrogent le même formulaire par
   * des chemins de finder différents, leurs caches ne doivent pas se croiser.
   */
  ORGA_RESERVATIONS: (formId: string, orgaId: string) =>
    ["search-orga-reservations", formId, orgaId] as const,
  /**
   * Entité chargée par IDENTIFIANT pour ouvrir sa fiche depuis l'URL
   * (`list.previewFetch`), quand la liste affichée ne la porte pas.
   *
   * Producteur : `useEntityByIdQuery`. Données publiques (mêmes fiches que la
   * recherche) — pas d'invalidation, staleTime suffit.
   */
  ENTITY_BY_ID: (kind: string, id: string) =>
    ["search-entity-by-id", kind, id] as const,
} as const;

export type SearchQueryKeyType = ReturnType<
  (typeof SEARCH_QUERY_KEYS)[keyof typeof SEARCH_QUERY_KEYS]
>;
