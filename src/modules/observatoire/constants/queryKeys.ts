/**
 * Constantes du module observatoire.
 *
 * OBSERVATORY_QUERY_KEYS : préfixe de clé React Query (single source of truth).
 * (Les valeurs de filtres booléens vivent dans dimensions.ts —
 *  BOOL_FILTER_VALUES, sérialisées en URL.)
 */

export const OBSERVATORY_QUERY_KEYS = {
  /** Préfixe utilisé par useObservatoryEquipmentsQuery. */
  EQUIPMENTS_PREFIX: "observatoire",
} as const;
