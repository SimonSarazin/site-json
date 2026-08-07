import type { FormLocalityEntry, StoredLocality, PostalAddress, GeoCoordinates, GeoPosition } from "@/lib/location/types";

/**
 * Sérialisation ↔ désérialisation de la valeur d'un champ adresse (`formLocality`) de coform,
 * stockée telle quelle sous `answers[formId][key]`.
 *
 * Forme stockée (miroir `addressInDynform.php`) :
 *   { formLocality: FormLocalityEntry[], address, geo, geoPosition, addresses? }
 * où `address/geo/geoPosition` recopient l'adresse PRINCIPALE (`center`) pour la lecture/carte.
 *
 * Pur & testable. Tolère les anciennes valeurs (chaîne libre issue du bug « champ texte »,
 * ou objet legacy sans `formLocality`).
 */

function isEntry(v: unknown): v is FormLocalityEntry {
  return !!v && typeof v === "object" && "address" in (v as object);
}

/** Reconstruit une entrée à partir d'un objet legacy plat { address, geo, geoPosition }. */
function entryFromFlat(o: Record<string, unknown>): FormLocalityEntry | null {
  const address = o.address as PostalAddress | undefined;
  if (!address || typeof address !== "object") return null;
  return {
    address,
    geo: (o.geo as GeoCoordinates) ?? { "@type": "GeoCoordinates", latitude: "", longitude: "" },
    geoPosition: (o.geoPosition as GeoPosition) ?? { type: "Point", coordinates: [0, 0] },
    center: true,
  };
}

/** Valeur stockée (objet/chaîne/undefined) → tableau d'entrées éditables. */
export function parseStoredToEntries(stored: unknown): FormLocalityEntry[] {
  if (stored == null) return [];

  // Ancienne donnée : simple chaîne (bug « champ texte » historique). Non récupérable en géo
  // → tableau vide (l'utilisateur re-sélectionne une ville). On ne fabrique pas d'entrée invalide.
  if (typeof stored === "string") return [];

  if (Array.isArray(stored)) {
    return stored.filter(isEntry);
  }

  if (typeof stored === "object") {
    const o = stored as Record<string, unknown>;
    if (Array.isArray(o.formLocality)) {
      const list = (o.formLocality as unknown[]).filter(isEntry);
      if (list.length) return list;
    }
    // Objet legacy sans `formLocality` mais avec `address` à plat.
    const flat = entryFromFlat(o);
    if (flat) return [flat];
  }

  return [];
}

/** Garantit qu'EXACTEMENT une entrée porte `center` (la 1re marquée, sinon la 1re). */
function withSingleCenter(entries: FormLocalityEntry[]): FormLocalityEntry[] {
  if (!entries.length) return entries;
  const centerIdx = entries.findIndex((e) => e.center);
  const keep = centerIdx === -1 ? 0 : centerIdx;
  return entries.map((e, i) => ({ ...e, center: i === keep }));
}

/** Tableau d'entrées → valeur stockée (parité `addressInDynform.php`). */
export function entriesToStored(entries: FormLocalityEntry[]): StoredLocality | undefined {
  const clean = (entries ?? []).filter((e) => e?.address?.localityId);
  if (!clean.length) return undefined;

  const normalized = withSingleCenter(clean);
  const center = normalized.find((e) => e.center) ?? normalized[0];

  return {
    formLocality: normalized,
    address: center.address,
    geo: center.geo,
    geoPosition: center.geoPosition,
    addresses: normalized.filter((e) => e !== center),
  };
}
