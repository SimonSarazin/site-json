/**
 * Comparaison « jeton » des filtres déroulants — pour les champs MULTI-VALEURS stockés en chaîne
 * (« Etablissement scolaire, Complexe sportif »). Opt-in par filtre : `dropdownFilters[].match: "token"`.
 *
 * Sans elle, un filtre compare À L'IDENTIQUE (`$in`) : « Clubs sportifs » ne trouvait qu'UN
 * équipement à Saint-Paul quand 241 portent cette valeur parmi d'autres (mesuré le 15/10/2026 sur
 * `equip_utilisateur` ; même défaut sur `equip_loc_type` et `inst_part_type`).
 *
 * Le motif retient la valeur comme élément ENTIER de la liste (bornée par le début, la fin ou une
 * virgule), jamais comme sous-chaîne : « Piscine » ne trouve pas « Piscine olympique ». Il est
 * SENSIBLE à la casse, comme `$in` : toute fiche trouvée à l'identique l'est encore — sur-ensemble
 * strict, vérifié sur 81 options des trois sites équipements (0 fiche perdue).
 *
 * Transport : `$regex` Mongo natif, posé sous `$or: { $and: [...] }` — la forme que le backend
 * legacy recopie BRUTE jusqu'à Mongo (cf. `mongoFilters.ts`). La forme tableau `{ champ: [v] }`
 * n'est PAS utilisable : `SearchNew::searchFilters` y entoure la valeur de `.*` SANS l'échapper,
 * si bien que « Individuel(s) » ou « Aérodrome/aéroport » y produisent une regex fausse ou invalide.
 */
export const TOKEN_MATCH_TYPE = "token";

/** Échappe une valeur pour qu'elle soit lue littéralement dans une regex. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Motif `$regex` : l'une des `values` est un élément entier d'une liste « a, b, c » (ou toute la
 * valeur). Plusieurs valeurs = alternatives (OU), comme plusieurs options cochées d'un même filtre.
 * Ne pas appeler avec une liste vide : le motif reconnaîtrait un élément vide.
 */
export function tokenMatchPattern(values: readonly string[]): string {
  return `(?:^|,)\\s*(?:${values.map(escapeRegex).join("|")})\\s*(?:,|$)`;
}
