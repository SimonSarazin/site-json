/**
 * Blocs « listes » et « textes » du détail d'une ressource de tiers-lieu — UNE définition pour la fiche
 * du lieu (`ProfilTiersLieuxAbout`) et l'annuaire des ressources (`PreviewResourceDirectory`), pour que
 * les deux montrent les mêmes champs, dans le même ordre, sous les mêmes libellés.
 */

/** Listes à pastilles, dans l'ordre d'affichage. */
export const RESOURCE_TAG_KEYS = ["equipments", "catering", "services", "roomType"] as const;
/** Textes libres, dans l'ordre d'affichage. */
export const RESOURCE_NOTE_KEYS = ["moreInfo", "about", "tip"] as const;

export type ResourceDetailKey = (typeof RESOURCE_TAG_KEYS)[number] | (typeof RESOURCE_NOTE_KEYS)[number];

/**
 * Lit une valeur `checkboxNew` : le formulaire stocke un tableau de libellés, mais une saisie ancienne
 * peut avoir laissé une chaîne unique.
 */
export function readTagList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

/** Lit un champ texte/textarea en écartant les valeurs vides ou blanches. */
export function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export interface ResourceDetailBlocks {
  tags?: { label: string; values: string[] }[];
  notes?: { label: string; value: string }[];
}

/**
 * `pick(clé)` rend la valeur brute du champ (`undefined` si le champ n'est pas déclaré pour ce type de
 * ressource) ; `label(clé)` son libellé traduit. Un bloc vide est omis.
 */
export function buildResourceDetails(
  pick: (key: ResourceDetailKey) => unknown,
  label: (key: ResourceDetailKey) => string,
): ResourceDetailBlocks {
  const tags = RESOURCE_TAG_KEYS.map((key) => ({ label: label(key), values: readTagList(pick(key)) })).filter(
    (entry) => entry.values.length > 0,
  );
  const notes = RESOURCE_NOTE_KEYS.map((key) => ({ label: label(key), value: readText(pick(key)) })).filter(
    (entry) => entry.value !== "",
  );
  return {
    ...(tags.length ? { tags } : {}),
    ...(notes.length ? { notes } : {}),
  };
}
