/**
 * Constantes du module observatoire.
 *
 * OBSERVATORY_QUERY_KEYS : préfixe de clé React Query (single source of truth).
 * PMR_FILTER_VALUES      : valeurs normalisées du filtre PMR (formulaire → logique).
 */

export const OBSERVATORY_QUERY_KEYS = {
  /** Préfixe utilisé par useObservatoryEquipmentsQuery. */
  EQUIPMENTS_PREFIX: "observatoire",
} as const;

export const PMR_FILTER_VALUES = {
  ACCESSIBLE: "accessible",
  NOT_ACCESSIBLE: "non-accessible",
} as const;

export type PmrFilterValue =
  (typeof PMR_FILTER_VALUES)[keyof typeof PMR_FILTER_VALUES];
