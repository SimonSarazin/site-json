import type { Feature, Geometry, Position } from "geojson";

/**
 * Point d'ancrage d'un libellé POSÉ SUR un contour.
 *
 * Le centroïde ne convient pas : sur une forme concave — « Mafate et zone forestière » est un cirque,
 * la commune de Saint-Paul est en croissant — il tombe DEHORS, et le libellé se retrouve sur le
 * voisin. On cherche donc le « pôle d'inaccessibilité » : le point intérieur le plus éloigné du bord.
 *
 * Recherche par grille en deux passes (grossière puis affinée autour du meilleur candidat) plutôt
 * qu'un polylabel complet : quelques centaines de tests par contour, calculés une seule fois et
 * mémoïsés par la carte, pour un placement visuellement équivalent.
 */

const COARSE_STEPS = 14;
const REFINE_STEPS = 6;
const REFINE_PASSES = 3;

/** Aire algébrique (formule du lacet), en degrés² — sert à classer les anneaux, pas à mesurer. */
function ringArea(ring: Position[]): number {
  let total = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    total += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(total / 2);
}

/** Anneau EXTÉRIEUR le plus vaste : sur un MultiPolygon, le libellé va sur la pièce principale. */
function largestOuterRing(geometry: Geometry): Position[] | null {
  if (geometry.type === "Polygon") return geometry.coordinates[0] ?? null;
  if (geometry.type === "MultiPolygon") {
    let best: Position[] | null = null;
    let bestArea = -1;
    for (const polygon of geometry.coordinates) {
      const ring = polygon[0];
      if (!ring) continue;
      const area = ringArea(ring);
      if (area > bestArea) {
        bestArea = area;
        best = ring;
      }
    }
    return best;
  }
  return null;
}

function isInside(point: [number, number], ring: Position[]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Distance au bord, en degrés de latitude (les longitudes sont remises à l'échelle par `cosLat`). */
function distanceToRing(point: [number, number], ring: Position[], cosLat: number): number {
  let min = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ax = (ring[j][0] - point[0]) * cosLat;
    const ay = ring[j][1] - point[1];
    const bx = (ring[i][0] - point[0]) * cosLat;
    const by = ring[i][1] - point[1];
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared)) : 0;
    const px = ax + t * dx;
    const py = ay + t * dy;
    const distance = Math.sqrt(px * px + py * py);
    if (distance < min) min = distance;
  }
  return min;
}

/** Aire de la plus grande pièce — classe les contours quand il faut en libeller un sous-ensemble. */
export function polygonArea(geometry: Geometry): number {
  const ring = largestOuterRing(geometry);
  return ring ? ringArea(ring) : 0;
}

/**
 * Point où poser le libellé, GARANTI à l'intérieur du contour quand celui-ci a une surface.
 * Rend `null` pour une géométrie non surfacique (rien à libeller « dedans »).
 */
export function polygonLabelPoint(geometry: Geometry): [number, number] | null {
  const ring = largestOuterRing(geometry);
  if (!ring || ring.length < 4) return null;

  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [x, y] of ring) {
    if (x < west) west = x;
    if (x > east) east = x;
    if (y < south) south = y;
    if (y > north) north = y;
  }
  const cosLat = Math.cos((((south + north) / 2) * Math.PI) / 180);

  let best: [number, number] | null = null;
  let bestDistance = -Infinity;
  let [minX, maxX, minY, maxY] = [west, east, south, north];
  let steps = COARSE_STEPS;

  for (let pass = 0; pass <= REFINE_PASSES; pass++) {
    const stepX = (maxX - minX) / (steps + 1);
    const stepY = (maxY - minY) / (steps + 1);
    for (let i = 1; i <= steps; i++) {
      for (let j = 1; j <= steps; j++) {
        const candidate: [number, number] = [minX + i * stepX, minY + j * stepY];
        if (!isInside(candidate, ring)) continue;
        const distance = distanceToRing(candidate, ring, cosLat);
        if (distance > bestDistance) {
          bestDistance = distance;
          best = candidate;
        }
      }
    }
    if (!best) break; // aucun point intérieur trouvé : inutile d'affiner
    // Passe suivante : on resserre la fenêtre autour du meilleur candidat.
    minX = best[0] - stepX;
    maxX = best[0] + stepX;
    minY = best[1] - stepY;
    maxY = best[1] + stepY;
    steps = REFINE_STEPS;
  }

  // Contour trop fin pour que la grille tombe dedans : le milieu de la boîte reste préférable à rien.
  return best ?? [(west + east) / 2, (south + north) / 2];
}

/** Contour nommé + l'ancre où poser son libellé. */
export interface LabelledFeature {
  feature: Feature;
  name: string;
  point: [number, number];
}

/**
 * Contours à libeller dans une couche : ceux qui portent un `name`, plafonnés à `max`.
 *
 * Au-delà du plafond, les plus VASTES gagnent — ce sont ceux dont le libellé tient. Un libellé =
 * un nœud (marqueur HTML sur la carte, `<text>` en SVG) : en nommer 1 345 QPV serait illisible
 * autant qu'inutile.
 *
 * Partagé par la carte (`MapShapeNames`) et le rendu SVG (`projectShapes`) : la règle de sélection
 * doit rester la MÊME des deux côtés, sans quoi un même jeu de contours se nommerait différemment
 * selon la vue.
 */
export function pickLabelledFeatures(features: Feature[], max: number): LabelledFeature[] {
  const candidates: Array<{ feature: Feature; name: string; area: number }> = [];
  for (const feature of features) {
    const name = feature.properties?.name;
    if (typeof name !== "string" || !name) continue;
    candidates.push({ feature, name, area: polygonArea(feature.geometry) });
  }
  candidates.sort((a, b) => b.area - a.area);

  const placed: LabelledFeature[] = [];
  for (const { feature, name } of candidates.slice(0, max)) {
    const point = polygonLabelPoint(feature.geometry);
    if (!point) continue;
    placed.push({ feature, name, point });
  }
  return placed;
}
