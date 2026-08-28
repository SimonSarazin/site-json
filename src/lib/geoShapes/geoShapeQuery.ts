import type { QueryKey } from "@tanstack/react-query";
import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import type {
  ZoneGetShapeData,
  ZoneGetZonirisData,
  ZoneShapeItem,
} from "@communecter/cocolight-api-client";

import type { GeoShapeSource } from "@/types/geo-shape-schema";

import { simplifyGeometry } from "./simplifyGeometry";

/**
 * Accès aux CONTOURS géographiques du legacy : clé de cache, appel, normalisation.
 *
 * Deux endpoints publics derrière trois `source` — `getZoneShape` (`zones`/`cities`) et
 * `getZoniris` (`zoniris`) — sont les seuls à renvoyer `geoShape`. Ils rendent des documents
 * COMPLETS et HÉTÉROGÈNES ; tout ce que la carte doit en savoir tient dans le FeatureCollection
 * produit ici. Le trio clé/fetcher/hook suit le motif maison de `useSearchZone` : la clé est
 * exportée pour que le préchauffage (`useGeoShapesWarmup`) et la lecture (`useGeoShapes`) tapent
 * exactement le même cache.
 */

/**
 * Vue minimale de l'entité — duck-typing, comme `fetchSearchZones` : accepte indifféremment une
 * `Organization`, un `Project`, ou l'entité rendue par `initApi`.
 */
export interface GeoShapeEntity {
  getZoneShape(data: ZoneGetShapeData): Promise<ZoneShapeItem[] | null>;
  getZoniris(data: ZoneGetZonirisData): Promise<ZoneShapeItem[]>;
}

/** Contours quasi immuables : on ne les redemande pas d'une vue à l'autre. */
export const GEO_SHAPES_STALE_TIME = 24 * 60 * 60 * 1000;
export const GEO_SHAPES_GC_TIME = 24 * 60 * 60 * 1000;

/**
 * Clé de cache. Volontairement bâtie sur ce qui change la DONNÉE (source, filtres, tolérance) et
 * pas sur `id` : deux couches déclarées avec les mêmes filtres partagent un seul appel réseau —
 * c'est le cas quand un site réutilise le même périmètre sous deux habillages.
 */
export function geoShapesQueryKey(source: GeoShapeSource): QueryKey {
  return ["geo-shapes", source.source, JSON.stringify(source.filters), source.simplify ?? 0] as const;
}

/**
 * Charge utile réseau. `source:"cities"` n'existe pas côté serveur : c'est `getshape` avec
 * `level:"cities"` — le détour est absorbé ici, la config ne le voit pas. `light` est une
 * PRÉSENCE côté PHP (toute valeur non vide, sauf "0") → on émet `"1"`.
 */
function buildZonePayload(source: Extract<GeoShapeSource, { source: "zones" | "cities" }>): ZoneGetShapeData {
  // Le ternaire est porté par `source.source` et non par un `filters` déjà déstructuré :
  // c'est ce qui laisse TypeScript restreindre l'union (seule la branche `zones` a un `level`).
  const payload: ZoneGetShapeData =
    source.source === "cities"
      ? { countryCode: source.filters.countryCode, level: "cities" }
      : { countryCode: source.filters.countryCode, level: source.filters.level };
  const filters = source.filters;
  if (filters.parentId) payload.parentId = filters.parentId;
  if (filters.parentLevel) payload.parentLevel = filters.parentLevel;
  if (filters.light) payload.light = "1";
  return payload;
}

/**
 * Coercition des coordonnées : la même base mélange `double` et `string` selon l'import. Toute
 * position non numérique invalide la GÉOMÉTRIE ENTIÈRE (`null`) — dessiner un contour à trous
 * silencieux serait pire que ne rien dessiner.
 */
function coerceCoordinates(value: unknown): unknown | null {
  if (!Array.isArray(value)) return null;
  if (value.length >= 2 && (typeof value[0] === "number" || typeof value[0] === "string")) {
    const lng = Number(value[0]);
    const lat = Number(value[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    return [lng, lat] as Position;
  }
  const children: unknown[] = [];
  for (const child of value) {
    const coerced = coerceCoordinates(child);
    if (coerced === null) return null;
    children.push(coerced);
  }
  return children;
}

const DRAWABLE_GEOMETRIES = new Set([
  "Polygon",
  "MultiPolygon",
  "LineString",
  "MultiLineString",
]);

/** Géométrie NUE du legacy (`{type, coordinates}`, jamais une Feature) → géométrie GeoJSON sûre. */
function toGeometry(raw: unknown): Geometry | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as { type?: unknown; coordinates?: unknown };
  if (typeof candidate.type !== "string" || !DRAWABLE_GEOMETRIES.has(candidate.type)) return null;
  const coordinates = coerceCoordinates(candidate.coordinates);
  if (coordinates === null) return null;
  return { type: candidate.type, coordinates } as Geometry;
}

/** `_id` hexadécimal du document : promu en `id` par le normaliseur du SDK, sinon lu dans `_id`. */
function documentId(item: ZoneShapeItem): string | null {
  if (typeof item.id === "string" && item.id) return item.id;
  const raw = item._id as { $id?: string; _str?: string } | undefined;
  return raw?.$id ?? raw?._str ?? null;
}

/**
 * Documents legacy → FeatureCollection.
 *
 * Trois filtrages, tous nécessaires et tous silencieux côté serveur :
 *  - documents SANS `geoShape` : très courants (1 981 zones sur 52 915 en portent un ; sur
 *    zoniris, un filtre `insee` ramène 54 documents pour 24 contours) ;
 *  - géométries non dessinables (`Point`, coordonnées cassées) ;
 *  - DOUBLONS d'`_id` : deux entrées de la config qui partagent un `id` de couche forment un OU
 *    (le legacy ANDe ses filtres et n'a pas d'opérateur OU), et leurs résultats se recouvrent.
 */
export function toFeatureCollection(items: ZoneShapeItem[], source: GeoShapeSource): FeatureCollection {
  const tolerance = source.simplify ?? 0;
  const seen = new Set<string>();
  const features: Feature[] = [];

  for (const item of items) {
    const id = documentId(item);
    if (!id || seen.has(id)) continue;
    const geometry = toGeometry(item.geoShape);
    if (!geometry) continue;
    seen.add(id);
    features.push({
      type: "Feature",
      id,
      geometry: simplifyGeometry(geometry, tolerance),
      properties: {
        layer: source.id,
        docId: id,
        name: typeof item.name === "string" ? item.name : null,
        // `zones` nomme le pays `countryCode`, `cities` le nomme `country` : on expose les deux
        // tels quels plutôt que d'inventer un champ commun que la donnée ne porte pas.
        countryCode: item.countryCode ?? item.country ?? null,
        insee: item.insee ?? null,
        level: item.level ?? null,
        collection: source.source,
      },
    });
  }

  return { type: "FeatureCollection", features };
}

/** Appel + normalisation. `getZoneShape` rend `null` quand `level` ne résout aucune branche. */
export async function fetchGeoShapes(
  entity: GeoShapeEntity,
  source: GeoShapeSource,
): Promise<FeatureCollection> {
  if (source.source === "zoniris") {
    const items = await entity.getZoniris(source.filters as ZoneGetZonirisData);
    return toFeatureCollection(items ?? [], source);
  }
  const items = await entity.getZoneShape(buildZonePayload(source));
  return toFeatureCollection(items ?? [], source);
}

/** Options PARTAGÉES lecture/préchauffage — même clé, même fetcher, même fraîcheur. */
export function geoShapeQueryOptions(entity: GeoShapeEntity | null, source: GeoShapeSource) {
  return {
    queryKey: geoShapesQueryKey(source),
    queryFn: () => {
      if (!entity) throw new Error("API non initialisée - entity manquante");
      return fetchGeoShapes(entity, source);
    },
    staleTime: GEO_SHAPES_STALE_TIME,
    gcTime: GEO_SHAPES_GC_TIME,
  };
}
