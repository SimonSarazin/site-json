/**
 * Repli d'un texte pour COMPARAISON : deux saisies qu'un humain lit comme le même nom doivent
 * donner la même chaîne — « La Plume à Loup », « la plume a loup » et « La  Plume-à-Loup ».
 *
 * Accents retirés, minuscules, apostrophes et ponctuation ramenées à l'espace, espaces repliés.
 * Sert à comparer, jamais à afficher, stocker ni CHERCHER : envoyé tel quel au serveur, le repli
 * perd des fiches (« archipel l » ne retrouve pas « Archipel (L') »).
 *
 * La plage des diacritiques est écrite en échappements `\u` : des caractères combinants bruts,
 * qu'un éditeur normalise en NFC, feraient disparaître la classe en silence.
 *
 * NB dette : le dépôt porte une dizaine de replis écrits en ligne (aac/filterCommuns `foldForSearch`,
 * search/dropdownFilters `normalizeFilterValue`, search/reservations `foldLabel`…), chacun avec sa
 * nuance métier. Celui-ci est le repli « nom propre » ; il ne les remplace pas d'office.
 */
export function foldText(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // marques diacritiques combinantes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ") // ponctuation, apostrophes, tirets : espace
    .trim();
}
