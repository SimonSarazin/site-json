export { default as DataObservatorySection } from "./DataObservatorySection";

export type {
  ObservatoryItem,
  DataObservatorySection as DataObservatorySectionType,
  DataObservatorySectionProps,
  DimensionDef,
  DimensionsConfig,
  KpiDef,
  ChartDef,
  TableDef,
  FilterValues,
} from "./schema";
export { DataObservatorySectionSchema, EMPTY_FILTERS } from "./schema";

export { OBSERVATORY_QUERY_KEYS } from "./constants/queryKeys";
export {
  BOOL_FILTER_VALUES,
  dimensionBool,
  dimensionLabel,
  dimensionList,
  dimensionNumber,
  dimensionValue,
  fieldsFromDimensions,
} from "./dimensions";

export { useObservatoryItemsQuery, buildObservatoryBaseParams } from "./hooks/useObservatoryItemsQuery";
export { useObservatoryFilters } from "./hooks/useObservatoryFilters";
export { observatoryPrefetchParams } from "./prefetch";
