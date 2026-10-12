export {
  fetchGeoShapes,
  geoShapeQueryOptions,
  geoShapesQueryKey,
  toFeatureCollection,
  type GeoShapeEntity,
} from "./geoShapeQuery";
export { simplifyGeometry, countPositions } from "./simplifyGeometry";
export {
  polygonLabelPoint,
  polygonArea,
  pickLabelledFeatures,
  type LabelledFeature,
} from "./labelPoint";
export { useGeoShapes, useGeoShapesWarmup, type GeoShapeLayer } from "./useGeoShapes";
export { resolveThemeColor, cssColorToken } from "./themeColor";
export {
  shapeHref,
  shapeValue,
  isLayerInteractive,
  isShapeTarget,
  type ShapeTarget,
  type ShapeValueFrom,
} from "./shapeTarget";
// `projectShapes` n'est VOLONTAIREMENT pas ré-exporté : il tire `d3-geo`, et ce barrel est importé
// par la carte MapLibre. Import par chemin direct depuis les seuls consommateurs SVG.
