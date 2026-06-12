export { default as ObservatoryES974Section } from "./ObservatoryES974Section";

export type {
  Equipment,
  FilterValues,
  ObservatoryES974Section as ObservatoryES974SectionType,
  ObservatoryES974SectionProps,
} from "./schema";
export { EquipmentSchema, ObservatoryES974SectionSchema, EMPTY_FILTERS } from "./schema";

export { OBSERVATORY_QUERY_KEYS, PMR_FILTER_VALUES } from "./constants/queryKeys";
export type { PmrFilterValue } from "./constants/queryKeys";

export { useObservatoryEquipmentsQuery } from "./hooks/useObservatoryEquipmentsQuery";
export { useObservatoryFilters } from "./hooks/useObservatoryFilters";
