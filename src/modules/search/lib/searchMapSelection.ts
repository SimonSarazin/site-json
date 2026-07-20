// ------------------------------------------------------------
// searchMapSelection.ts — accès typés aux champs d'une SearchEntity
// ------------------------------------------------------------
// `serverData` est typé large côté SDK : sans ces helpers, chaque site d'appel
// (SearchMap, SearchListView) casterait `as { id?… }` / `as { geoPosition?… }`.
// On CENTRALISE ici (un seul endroit, testé) la lecture de l'id, des coordonnées
// et du slug, + la recherche par id — réutilisé par la synchro liste↔carte.
// Fonctions PURES (testées sans rendu).

import type { SearchEntity } from "@communecter/cocolight-api-client";

type ServerDataLike = {
  id?: unknown;
  slug?: unknown;
  geoPosition?: { coordinates?: unknown };
  geo?: { latitude?: unknown; longitude?: unknown };
};

function serverDataOf(entry: SearchEntity | undefined): ServerDataLike | undefined {
  return entry?.serverData as ServerDataLike | undefined;
}

/** Vrai si `coords` est un tuple [lng, lat] dans les bornes géographiques. */
export function isValidGeoPoint(coords: unknown): coords is [number, number] {
  if (!Array.isArray(coords) || coords.length !== 2) return false;
  const [lng, lat] = coords;
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Coordonnée numérique tolérante : l'API Communecter renvoie souvent lat/lng en
 * STRING ("55.3"). On accepte number ou string numérique, sinon `null`.
 * Piège évité : `Number("")` / `Number(null)` valent 0 → on rejette les chaînes
 * vides/blanches (sinon un champ absent passerait pour l'équateur/méridien 0).
 */
function toFiniteCoord(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const s = v.trim();
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Id de l'entité en string (la synchro compare des ids string), ou `undefined`. */
export function getEntryId(entry: SearchEntity | undefined): string | undefined {
  // L'id canonique est le getter RACINE de l'entité SDK (`entry.id` →
  // `_draftData.id`), comme `getEntrySlug` privilégie `entry.slug`. Sur les
  // résultats de recherche, `serverData.id` n'est PAS toujours peuplé → s'en
  // tenir à `serverData.id` renvoyait `undefined` (cassait le recadrage carte :
  // la garde fitBounds `firstId === ref` sautait à vie). Repli sur serverData.
  const root = (entry as { id?: unknown } | undefined)?.id;
  if (root != null && root !== "") return String(root);
  const sd = serverDataOf(entry)?.id;
  return sd == null ? undefined : String(sd);
}

/**
 * Coordonnées [lng, lat] géolocalisées VALIDES de l'entité, ou `null`.
 *
 * Deux formes coexistent dans la donnée Communecter (cf. FranceRegionsMap et
 * PreviewPoiAmenities, qui lisent les MÊMES entités) :
 *   1. `geoPosition.coordinates` au format GeoJSON [lng, lat] ;
 *   2. repli `geo: { latitude, longitude }`.
 * Dans les deux cas les valeurs peuvent être des STRINGS → on coerce. Ne lire
 * que (1) en number strict (ancienne implémentation) laissait la carte VIDE pour
 * les jeux de données en string ou en `geo` seul (aucun marqueur, fitBounds KO).
 */
export function getEntryCoords(entry: SearchEntity | undefined): [number, number] | null {
  const sd = serverDataOf(entry);

  // 1) GeoJSON geoPosition.coordinates [lng, lat] (valeurs parfois en string).
  const raw = sd?.geoPosition?.coordinates;
  if (Array.isArray(raw) && raw.length >= 2) {
    const lng = toFiniteCoord(raw[0]);
    const lat = toFiniteCoord(raw[1]);
    if (lng !== null && lat !== null && isValidGeoPoint([lng, lat])) return [lng, lat];
  }

  // 2) Repli `geo: { latitude, longitude }` (souvent en string).
  const geo = sd?.geo;
  if (geo) {
    const lng = toFiniteCoord(geo.longitude);
    const lat = toFiniteCoord(geo.latitude);
    if (lng !== null && lat !== null && isValidGeoPoint([lng, lat])) return [lng, lat];
  }

  return null;
}

/** Slug de l'entité (racine ou serverData), ou `undefined`. */
export function getEntrySlug(entry: SearchEntity | undefined): string | undefined {
  const root = (entry as { slug?: unknown } | undefined)?.slug;
  const slug = typeof root === "string" && root ? root : serverDataOf(entry)?.slug;
  return typeof slug === "string" ? slug : undefined;
}

/** Première entité dont l'id matche `id` (comparaison string), ou `undefined`. */
export function findEntryById<T extends SearchEntity>(
  results: T[],
  id: string | null | undefined,
): T | undefined {
  if (id == null) return undefined;
  const target = String(id);
  return results.find((e) => getEntryId(e) === target);
}
