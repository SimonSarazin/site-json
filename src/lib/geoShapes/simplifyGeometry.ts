import type { Geometry, Position } from "geojson";

/**
 * Simplification de géométrie (Douglas-Peucker), tolérance EN MÈTRES.
 *
 * POURQUOI. Les contours du legacy sont sur-échantillonnés : les 7 bassins de vie de Saint-Paul
 * pèsent 389 Ko pour 10 779 points à 13 décimales (~0,1 mm de précision). À 10 m de tolérance,
 * c'est 37 Ko et 1 757 points — une différence invisible à l'échelle d'une commune.
 *
 * CE QUE ÇA N'ÉCONOMISE PAS : le téléchargement. La réponse arrive entière (le legacy n'a aucune
 * option de simplification côté serveur) ; on allège le rendu WebGL et la mémoire, pas le réseau.
 */

// Approximation locale suffisante à l'échelle d'une commune (l'erreur d'une équirectangulaire
// reste très en deçà de la tolérance qu'on applique).
const METERS_PER_DEGREE_LAT = 110_540;
const METERS_PER_DEGREE_LON = 111_320;

/** Décimales conservées après simplification (5 ≈ 1 m). */
const PRECISION = 5;

/** Carré de la distance perpendiculaire de `p` au segment `[a,b]`, en mètres². */
function perpendicularDistanceSquared(p: Position, a: Position, b: Position, cosLat: number): number {
  const px = (p[0] - a[0]) * METERS_PER_DEGREE_LON * cosLat;
  const py = (p[1] - a[1]) * METERS_PER_DEGREE_LAT;
  const bx = (b[0] - a[0]) * METERS_PER_DEGREE_LON * cosLat;
  const by = (b[1] - a[1]) * METERS_PER_DEGREE_LAT;
  const lengthSquared = bx * bx + by * by;
  const t = lengthSquared > 0 ? Math.max(0, Math.min(1, (px * bx + py * by) / lengthSquared)) : 0;
  const dx = px - t * bx;
  const dy = py - t * by;
  return dx * dx + dy * dy;
}

/**
 * Douglas-Peucker à pile EXPLICITE (pas de récursion : un anneau du legacy monte à ~3 900 points,
 * et le pire cas de DP est une récursion aussi profonde que l'anneau).
 *
 * Un anneau simplifié sous 4 points ne serait plus un polygone fermé valide : on rend l'anneau
 * d'origine plutôt que de produire une géométrie que MapLibre refuserait.
 */
function simplifyRing(ring: Position[], toleranceMeters: number, cosLat: number): Position[] {
  if (ring.length <= 4) return ring;

  const keep = new Uint8Array(ring.length);
  keep[0] = 1;
  keep[ring.length - 1] = 1;

  const toleranceSquared = toleranceMeters * toleranceMeters;
  const stack: Array<[number, number]> = [[0, ring.length - 1]];

  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    let farthest = -1;
    let maxDistance = 0;
    for (let i = first + 1; i < last; i++) {
      const distance = perpendicularDistanceSquared(ring[i], ring[first], ring[last], cosLat);
      if (distance > maxDistance) {
        maxDistance = distance;
        farthest = i;
      }
    }
    if (maxDistance > toleranceSquared && farthest > 0) {
      keep[farthest] = 1;
      stack.push([first, farthest], [farthest, last]);
    }
  }

  const simplified = ring.filter((_, i) => keep[i] === 1);
  return simplified.length >= 4 ? simplified : ring;
}

function round(position: Position): Position {
  const factor = 10 ** PRECISION;
  return [Math.round(position[0] * factor) / factor, Math.round(position[1] * factor) / factor];
}

/** Latitude de référence du jeu de coordonnées — le cosinus corrige l'écrasement des longitudes. */
function referenceCosLat(coordinates: unknown): number {
  const first = firstPosition(coordinates);
  return first ? Math.cos((first[1] * Math.PI) / 180) : 1;
}

function firstPosition(coordinates: unknown): Position | null {
  if (!Array.isArray(coordinates)) return null;
  if (typeof coordinates[0] === "number" && typeof coordinates[1] === "number") {
    return coordinates as Position;
  }
  for (const child of coordinates) {
    const found = firstPosition(child);
    if (found) return found;
  }
  return null;
}

function simplifyLine(line: Position[], toleranceMeters: number, cosLat: number): Position[] {
  return simplifyRing(line, toleranceMeters, cosLat).map(round);
}

/**
 * Simplifie une géométrie GeoJSON NUE (`{type, coordinates}`) — la forme exacte que renvoie le
 * legacy. `toleranceMeters <= 0` rend la géométrie INCHANGÉE (le défaut est le contour brut).
 * Les types ponctuels sont rendus tels quels : il n'y a rien à simplifier.
 */
export function simplifyGeometry(geometry: Geometry, toleranceMeters: number): Geometry {
  if (!(toleranceMeters > 0)) return geometry;

  const cosLat = referenceCosLat((geometry as { coordinates?: unknown }).coordinates);

  switch (geometry.type) {
    case "Polygon":
      return {
        type: "Polygon",
        coordinates: geometry.coordinates.map((ring) => simplifyLine(ring, toleranceMeters, cosLat)),
      };
    case "MultiPolygon":
      return {
        type: "MultiPolygon",
        coordinates: geometry.coordinates.map((polygon) =>
          polygon.map((ring) => simplifyLine(ring, toleranceMeters, cosLat)),
        ),
      };
    case "LineString":
      return { type: "LineString", coordinates: simplifyLine(geometry.coordinates, toleranceMeters, cosLat) };
    case "MultiLineString":
      return {
        type: "MultiLineString",
        coordinates: geometry.coordinates.map((line) => simplifyLine(line, toleranceMeters, cosLat)),
      };
    default:
      return geometry;
  }
}

/** Nombre de positions d'une géométrie — sert aux tests et aux traces de dev. */
export function countPositions(geometry: Geometry): number {
  const walk = (value: unknown): number => {
    if (!Array.isArray(value)) return 0;
    if (typeof value[0] === "number") return 1;
    return value.reduce<number>((total, child) => total + walk(child), 0);
  };
  return walk((geometry as { coordinates?: unknown }).coordinates);
}
