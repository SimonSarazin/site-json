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

/** Marqueur d'absence du recensement des équipements sportifs (« Donnée(s) non renseignée(s) »). */
const NON_RENSEIGNE = /^donn[ée]es? non renseign[ée]es?$/i;

/**
 * Champ costum texte réellement renseigné : ni vide, ni le marqueur d'absence du recensement — que
 * l'import écrit en toutes lettres là où un identifiant manque (781 `inst_siret`, 2 334 `inst_uai`).
 */
export const isProvided = (value: string | undefined): boolean => {
  const v = value?.trim() ?? "";
  return v !== "" && !NON_RENSEIGNE.test(v);
};
