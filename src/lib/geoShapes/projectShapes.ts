import { geoMercator, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry, Position } from "geojson";

import { GEO_SHAPE_MAX_LABELS } from "@/types/geo-shape-schema";

import { pickLabelledFeatures } from "./labelPoint";
import type { GeoShapeLayer } from "./useGeoShapes";

/**
 * Projection des contours pour un rendu SVG, HORS carte.
 *
 * Pendant de `MapShapeLayers` pour la section `map-shapes` : là où MapLibre projette lui-même en
 * WebGL, ici c'est à nous de le faire. Volontairement PUR et sans DOM — c'est ce qui rend le
 * résultat identique en SSR et au premier rendu client, et testable en `node`.
 *
 * ⚠️ **Ne pas ré-exporter depuis `./index.ts`** : ce barrel est importé par `SearchMap` /
 * `MapShapeLayers`, y exposer `d3-geo` l'embarquerait dans le chunk maplibre. Import par chemin
 * direct (`@/lib/geoShapes/projectShapes`).
 */

/**
 * Largeur du repère SVG. Le bloc est responsive par son `viewBox` — cette largeur n'est donc PAS
 * une taille à l'écran, mais l'unité dans laquelle sont exprimées les coordonnées projetées.
 * Mesurer le conteneur (ce que fait `FranceRegionsMap` avec `clientWidth`) interdirait le SSR et
 * imposerait un re-render à chaque resize.
 */
export const SHAPE_VIEW_WIDTH = 1000;

export interface ProjectedShape {
  /** Clé de rendu React : `${layerId}-${id du document}`. */
  key: string;
  layerId: string;
  /** Attribut `d` du `<path>`. */
  d: string;
  name: string | null;
  properties: GeoJsonProperties;
}

export interface ProjectedLabel {
  key: string;
  text: string;
  x: number;
  y: number;
}

export interface ProjectedShapes {
  shapes: ProjectedShape[];
  labels: ProjectedLabel[];
  /** Hauteur du `viewBox` pour une largeur de {@link SHAPE_VIEW_WIDTH}. `0` = rien à dessiner. */
  height: number;
}

const EMPTY: ProjectedShapes = { shapes: [], labels: [], height: 0 };

function featureKey(layerId: string, feature: Feature, index: number): string {
  return `${layerId}-${feature.id ?? index}`;
}

/** Aire algébrique (formule du lacet) : seul son SIGNE compte ici — il porte le sens de parcours. */
function signedRingArea(ring: Position[]): number {
  let total = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    total += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return total / 2;
}

/**
 * Remet un polygone dans le sens de parcours qu'attend `d3-geo` : anneau extérieur HORAIRE
 * (aire algébrique > 0), trous antihoraires. Rend `null` quand rien n'était à retourner — on garde
 * alors la géométrie d'origine plutôt que d'en recopier les milliers de points.
 */
function rewindRings(rings: Position[][]): Position[][] | null {
  let changed = false;
  const rewound = rings.map((ring, index) => {
    const area = signedRingArea(ring);
    const expected = index === 0 ? 1 : -1; // extérieur horaire, trous antihoraires
    if (area === 0 || Math.sign(area) === expected) return ring;
    changed = true;
    return ring.slice().reverse();
  });
  return changed ? rewound : null;
}

function rewindGeometry(geometry: Geometry | null): Geometry | null {
  if (!geometry) return geometry;
  if (geometry.type === "Polygon") {
    const rings = rewindRings(geometry.coordinates);
    return rings ? { type: "Polygon", coordinates: rings } : geometry;
  }
  if (geometry.type === "MultiPolygon") {
    let changed = false;
    const polygons = geometry.coordinates.map((rings) => {
      const rewound = rewindRings(rings);
      if (!rewound) return rings;
      changed = true;
      return rewound;
    });
    return changed ? { type: "MultiPolygon", coordinates: polygons } : geometry;
  }
  return geometry;
}

/**
 * Normalise le SENS DE PARCOURS des anneaux, sans jamais muter l'entrée (la donnée vient du cache
 * React Query, partagé avec la carte).
 *
 * `d3-geo` lit les polygones sur la SPHÈRE : un anneau extérieur parcouru à l'envers ne décrit pas
 * le contour mais TOUT LE GLOBE SAUF lui. Le `<path>` couvre alors le `viewBox` entier et, pire,
 * il emporte le cadrage — mesuré le 2026-08-28 sur la donnée réelle : les 7 bassins de vie de
 * Saint-Paul (`zoniris`) arrivent en antihoraire (convention RFC 7946) et remplissent chacun tout
 * le bloc, tandis que les 24 communes de La Réunion (`cities`) arrivent, elles, en horaire ; mêlées
 * dans la même section, les communes se réduisaient à un point de 1 px.
 *
 * MapLibre (`MapShapeLayers`) ne connaît pas ce piège — il triangule les anneaux tels quels — d'où
 * une correction qui n'a lieu d'être QUE pour le rendu SVG.
 */
function rewindFeature(feature: Feature): Feature {
  const geometry = rewindGeometry(feature.geometry);
  if (!geometry || geometry === feature.geometry) return feature;
  return { ...feature, geometry };
}

/**
 * Projette TOUTES les couches dans un repère COMMUN.
 *
 * Une projection par couche les décalerait les unes des autres : le contour régional et les
 * communes qu'il contient doivent se superposer, donc c'est l'union des contours qui cadre.
 */
export function projectShapes(
  layers: GeoShapeLayer[],
  options: { maxLabels?: number } = {},
): ProjectedShapes {
  // Un SEUL passage de normalisation, dont le résultat sert au cadrage, aux `d` et aux libellés :
  // cadrer sur une géométrie et peindre l'autre les décalerait.
  const normalised = layers.map((layer) => layer.data.features.map(rewindFeature));
  const all: FeatureCollection = { type: "FeatureCollection", features: normalised.flat() };
  if (all.features.length === 0) return EMPTY;

  // `fitWidth` = `fitExtent([[0, 0], [width, ∞]])` : l'origine du contenu est calée en (0, 0), le
  // `viewBox` peut donc partir de zéro sans translation supplémentaire.
  const projection = geoMercator().fitWidth(SHAPE_VIEW_WIDTH, all);
  const path = geoPath(projection);

  const [, [, bottom]] = path.bounds(all);
  if (!Number.isFinite(bottom)) return EMPTY;
  const height = Math.max(1, Math.ceil(bottom));

  const shapes: ProjectedShape[] = [];
  const labels: ProjectedLabel[] = [];
  const maxLabels = options.maxLabels ?? GEO_SHAPE_MAX_LABELS;

  layers.forEach((layer, layerIndex) => {
    const features = normalised[layerIndex];
    features.forEach((feature, index) => {
      const d = path(feature);
      if (!d) return;
      const name = feature.properties?.name;
      shapes.push({
        key: featureKey(layer.id, feature, index),
        layerId: layer.id,
        d,
        name: typeof name === "string" && name ? name : null,
        properties: feature.properties,
      });
    });

    if (!layer.showNames) return;
    for (const placed of pickLabelledFeatures(features, maxLabels)) {
      const point = projection(placed.point);
      if (!point || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) continue;
      labels.push({
        key: `${layer.id}-label-${placed.feature.id ?? placed.name}`,
        text: placed.name,
        x: point[0],
        y: point[1],
      });
    }
  });

  return { shapes, labels, height };
}
