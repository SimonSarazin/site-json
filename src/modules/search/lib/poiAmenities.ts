/**
 * Helpers PARTAGÉS des vues « équipements sportifs / accessibilité » (card + preview `poi-amenities`).
 * NB : `Feature` (chip d'aménité) et `getPoiImage` (placeholder SVG) restent LOCAUX à chaque composant —
 * variantes visuelles VOULUES (card compacte/cercle 112 vs preview large/carré 160), non fusionnées.
 */

/** Champ costum booléen stocké en `"1"`/`"oui"`/`true`/`1` → booléen (aménités POI : `inst_*`/`equip_*`). */
export const isTrue = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const n = value.trim().toLowerCase();
    return n === "true" || n === "1" || n === "oui" || n === "yes";
  }
  return false;
};
