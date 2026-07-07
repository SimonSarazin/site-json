/**
 * Constantes du module observatoire.
 *
 * OBSERVATORY_QUERY_KEYS : préfixe de clé React Query (single source of truth).
 * (Les valeurs de filtres booléens vivent dans dimensions.ts —
 *  BOOL_FILTER_VALUES, sérialisées en URL.)
 */

export const OBSERVATORY_QUERY_KEYS = {
  /** Préfixe utilisé par useObservatoryItemsQuery. */
  ITEMS_PREFIX: "observatoire",
  /**
   * POI d'une installation (modal dashboard) — préfixe pour
   * `useSearchAllResults` (la clé complète, dérivée par SEARCH_QUERY_KEYS,
   * inclut les baseParams → la valeur de regroupement isole le cache).
   */
  INSTALLATION_POIS_PREFIX: "observatoire-installation-pois",
  /**
   * Answers (créneaux) des équipements d'une installation. `poiIds` TRIÉS
   * pour une clé stable quel que soit l'ordre de la requête POI. Données
   * publiques (pas de dimension userId).
   */
  INSTALLATION_ANSWERS: (form: string, poiIds: readonly string[]) =>
    ["observatoire-installation-answers", form, [...poiIds].sort().join(",")] as const,
} as const;
