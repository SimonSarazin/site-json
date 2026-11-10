/**
 * Identifiant de base MongoDB : 24 caractères hexadécimaux, majuscules admises. À vérifier avant
 * d'envoyer une liste d'identifiants au backend (`_id: {$in}`, `$nin`) : un identifiant de démo, saisi
 * à la main ou abîmé ferait échouer TOUTE la requête, pas seulement sa ligne.
 *
 * NB dette : d'autres modules gardent leur copie privée, avec ou sans majuscules admises (search
 * `coformAnswer`, comment `filKey`, coform `addToLinks`, aac `aacQueryParams`, ampli `isHexId` et
 * `isAnswerId`). Celle-ci sert la mesure d'usage et les filtres du bandeau ; elle ne les remplace pas
 * d'office, l'option de casse changerait leur comportement.
 */
const OBJECT_ID = /^[0-9a-f]{24}$/i;

export function isObjectId(value: unknown): value is string {
  return typeof value === "string" && OBJECT_ID.test(value);
}
