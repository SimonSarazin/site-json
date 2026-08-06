import type { City, Street, FormLocalityEntry, GeoCoordinates, GeoPosition, PostalAddress } from "./types";

const LEVEL_KEYS = [
  ["level1", "level1Name"],
  ["level2", "level2Name"],
  ["level3", "level3Name"],
  ["level4", "level4Name"],
  ["level5", "level5Name"],
] as const;

function isFiniteNum(v: unknown): boolean {
  return Number.isFinite(typeof v === "string" ? Number(v) : (v as number));
}

/** `codeInsee` legacy peut valoir le littéral "undefined" → on l'omet. */
function cleanInsee(v: unknown): string | undefined {
  const s = v == null ? "" : String(v).trim();
  if (!s || s === "undefined" || s === "null") return undefined;
  return s;
}

function buildGeo(latitude: string | number, longitude: string | number): GeoCoordinates {
  return { "@type": "GeoCoordinates", latitude: String(latitude), longitude: String(longitude) };
}

function buildGeoPosition(
  latitude: string | number,
  longitude: string | number,
  existing?: { type?: string; coordinates: [number | string, number | string] },
): GeoPosition {
  if (existing && Array.isArray(existing.coordinates) && existing.coordinates.length >= 2) {
    return { type: "Point", coordinates: [Number(existing.coordinates[0]), Number(existing.coordinates[1])] };
  }
  // GeoJSON = [lng, lat]
  return { type: "Point", coordinates: [Number(longitude), Number(latitude)] };
}

/**
 * Sélectionne les coordonnées les plus précises disponibles, par ordre de priorité :
 *   rue (numéro/rue) > code postal choisi > centre-ville (`city.geo`).
 * La donnée de niveau VILLE (`city.geo`) est le socle GARANTI : elle existe même quand
 * la ville n'a aucun code postal (contrairement au bug historique d'EditLocationTab qui
 * ne lisait la géo que depuis `postalCodes[].geo`).
 */
function pickCoords(input: {
  city: City;
  postalCode?: string;
  street?: Street | null;
}): { geo: GeoCoordinates; geoPosition: GeoPosition } | undefined {
  const { city, postalCode, street } = input;

  // 1) Rue (BAN) : geo = [lon, lat]
  if (street?.geo && isFiniteNum(street.geo[0]) && isFiniteNum(street.geo[1])) {
    const [lon, lat] = street.geo;
    return { geo: buildGeo(lat, lon), geoPosition: buildGeoPosition(lat, lon) };
  }

  // 2) Code postal choisi (ou l'unique CP de la ville)
  const pc =
    (postalCode && city.postalCodes?.find((p) => p.postalCode === postalCode)) ||
    (city.postalCodes?.length === 1 ? city.postalCodes[0] : undefined);
  if (pc?.geo && pc.geo.latitude != null && pc.geo.longitude != null) {
    return {
      geo: buildGeo(pc.geo.latitude, pc.geo.longitude),
      geoPosition: buildGeoPosition(pc.geo.latitude, pc.geo.longitude, pc.geoPosition),
    };
  }

  // 3) Centre-ville (garanti, même sans code postal)
  if (city.geo && city.geo.latitude != null && city.geo.longitude != null) {
    return {
      geo: buildGeo(city.geo.latitude, city.geo.longitude),
      geoPosition: buildGeoPosition(city.geo.latitude, city.geo.longitude, city.geoPosition),
    };
  }

  return undefined;
}

/**
 * Construit une entrée d'adresse complète à partir d'une ville sélectionnée (+ code postal
 * et rue optionnels). Fonction PURE (testable). Ne recopie QUE les niveaux administratifs
 * réellement présents (épars selon le pays) ; `codeInsee` est omis s'il est vide/"undefined".
 */
export function buildLocalityEntry(input: {
  addressCountry: string;
  city: City;
  postalCode?: string;
  street?: Street | null;
  center?: boolean;
}): FormLocalityEntry {
  const { addressCountry, city, postalCode, street, center } = input;

  const address: PostalAddress = {
    "@type": "PostalAddress",
    addressCountry,
    addressLocality: city.name,
    localityId: city.id,
  };

  const insee = cleanInsee(city.insee);
  if (insee) address.codeInsee = insee;
  if (postalCode) address.postalCode = postalCode;
  if (street?.streetAddress) address.streetAddress = street.streetAddress;

  // Niveaux administratifs : uniquement ceux présents (épars).
  for (const [key, nameKey] of LEVEL_KEYS) {
    const val = city[key];
    if (val != null && String(val) !== "" && String(val) !== "undefined") {
      address[key] = String(val);
      const name = city[nameKey];
      if (name != null && String(name) !== "") address[nameKey] = String(name);
    }
  }

  const coords = pickCoords({ city, postalCode, street });
  const geo: GeoCoordinates = coords?.geo ?? { "@type": "GeoCoordinates", latitude: "", longitude: "" };
  const geoPosition: GeoPosition = coords?.geoPosition ?? { type: "Point", coordinates: [0, 0] };

  const entry: FormLocalityEntry = { address, geo, geoPosition };
  if (center) entry.center = true;
  return entry;
}
