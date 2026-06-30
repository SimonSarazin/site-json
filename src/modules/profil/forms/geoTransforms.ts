/**
 * Transforms WRITE PARTAGÉS pour `geo` (GeoCoordinates) / `geoPosition` (GeoJSON Point), UNIFORMES pour
 * toutes les entités montant le composant d'adresse (`EditLocationTab`) : tiers-lieu, POI, profil.
 *
 * `EditLocationTab` pose `geo`/`geoPosition` EN MÊME TEMPS que l'adresse. Ces champs sont `writeOnly`
 * (jamais relus du serveur au READ). Leur émission est LIÉE à `localityId` (l'identité de l'adresse) :
 *  - `localityId` présent + geo POSÉ        → émis. lat/lng forcés en STRING (DataValidator.geoValid) ;
 *                                              coords en number (geoPositionValid attend des floats).
 *  - `localityId` présent + geo NON posé     → `undefined` → OMIS (writeOnly : édition sans toucher
 *                                              l'adresse → geo serveur préservé).
 *  - `localityId` ABSENT (adresse effacée)   → `""` → EFFACE geo/geoPosition AVEC l'adresse
 *                                              (parité du bloc `localities` legacy qui $unset le geo).
 * cf. doc/refactor-field-treatment.md (S6 geo).
 */
import { registerTransform } from "@/modules/formEngine/engine/transforms";

/** geo (GeoCoordinates) → objet (lat/lng STRING pour geoValid) ; `""` si pas de localityId (clear) ;
 *  `undefined` si geo non posé (omis/préservé). Pur — réutilisable hors pipeline (ex. transformFormDataWithAddress). */
export function normalizeGeoWrite(all: Record<string, unknown>): { "@type": "GeoCoordinates"; latitude: string; longitude: string } | "" | undefined {
  if (!all.localityId) return ""; // adresse effacée/absente → efface geo
  const g = all.geo as { latitude?: unknown; longitude?: unknown } | undefined;
  if (!g || (g.latitude == null && g.longitude == null)) return undefined; // non posé → omis (préservé)
  return { "@type": "GeoCoordinates", latitude: String(g.latitude ?? ""), longitude: String(g.longitude ?? "") };
}

/** geoPosition (GeoJSON Point) → objet (coords NUMBER pour geoPositionValid) ; `""`/`undefined` idem geo. */
export function normalizeGeoPositionWrite(all: Record<string, unknown>): { type: "Point"; coordinates: number[] } | "" | undefined {
  if (!all.localityId) return "";
  const gp = all.geoPosition as { coordinates?: unknown[] } | undefined;
  if (!gp || !Array.isArray(gp.coordinates) || gp.coordinates.length < 2) return undefined;
  return { type: "Point", coordinates: [Number(gp.coordinates[0]), Number(gp.coordinates[1])] };
}

registerTransform("geo:write", (_v, all) => normalizeGeoWrite((all ?? {}) as Record<string, unknown>));
registerTransform("geoPosition:write", (_v, all) => normalizeGeoPositionWrite((all ?? {}) as Record<string, unknown>));
