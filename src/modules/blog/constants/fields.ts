/**
 * Projection des surfaces du module blog (`fields` de `searchCostum`).
 *
 * POURQUOI une projection EXPLICITE : sans `fields`, le legacy RÉDUIT le document POI et retire
 * justement les champs costum — `publicationDate`, `publicationStatus`, `category`, `featured`
 * (constat byte-vérifié, cf. le commentaire de `AdminResourceTable.tsx` sur la même réduction).
 * Les surfaces du module lisaient donc `created` faute de mieux, et tout affichage de
 * `publicationDate` serait retombé SILENCIEUSEMENT sur le repli. Demander une projection
 * explicite court-circuite la réduction — mais elle doit alors être COMPLÈTE : le legacy ne
 * simplifie que sur `fields` vide (et ajoute d'office son socle name/address/geo/links).
 *
 * Contrat d'article du module (ce qu'`ArticleCard`, `ArticleReader`, le flux RSS et le JSON-LD
 * lisent réellement), pas une liste propre à un site : un `articleFeed` posé sur n'importe quel
 * costum du parc reçoit les mêmes champs. Un site qui a besoin de plus l'ajoute via
 * `articleFeed.props.defaultFields`, fusionné avec cette base.
 *
 * ⚠️ JAMAIS `"preferences"` ici : champ interdit du legacy (`SearchNew::checkFields`), retiré par
 * `unset()` — le trou d'index rend le tableau PHP non séquentiel et CASSE toute la projection
 * Mongo dès qu'il n'est pas en dernière position.
 */
export const ARTICLE_FIELDS: readonly string[] = [
  // Socle cœur (identité, rendu de carte, liens)
  "name",
  "slug",
  "type",
  "collection",
  "source",
  "shortDescription",
  "description",
  "tags",
  "created",
  "updated",
  "profilImageUrl",
  "profilMediumImageUrl",
  "profilThumbImageUrl",
  // Contrat costum « article » : la date ÉDITORIALE (tri + étiquette), l'état de publication
  // (filtre des surfaces publiques) et l'épinglage (micro-requête de la une).
  "publicationDate",
  "publicationStatus",
  "category",
  "featured",
];

/** Base du module ∪ champs demandés par la config (dédupliqués, ordre stable). */
export function articleFields(extra?: readonly string[]): string[] {
  return [...new Set([...ARTICLE_FIELDS, ...(extra ?? [])])];
}
