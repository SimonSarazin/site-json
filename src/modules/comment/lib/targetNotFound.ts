import type { CommentTarget } from "../types";

/**
 * La cible existe comme ADRESSE, mais plus comme document.
 *
 * Ce n'est pas un échec de chargement, et c'est ce qui la rendait invisible : mesuré le 24/09
 * sur `/co2/element/about`, le backend ne refuse pas un identifiant inconnu — il rend un
 * substitut `{name: "Unknown (deleted)", slug: "unknown"}` **sans `_id`**. L'appel réussit
 * donc, `getComments()` rend une liste vide, et l'écran affirmait « Aucun message pour
 * l'instant » : le fil n'est pas vide, il n'existe pas. C'est le cas le plus fréquent en
 * exploitation — le lien partagé dont l'élément a été supprimé depuis.
 */
export class TargetNotFoundError extends Error {
  constructor(readonly target: CommentTarget) {
    super(`La cible « ${target.type}:${target.id} » n'existe plus.`);
    this.name = "TargetNotFoundError";
  }
}

/**
 * Le document rendu est-il ce substitut ?
 *
 * Le critère est STRUCTUREL — l'absence d'identifiant de document — et non le libellé
 * « Unknown (deleted) », chaîne anglaise du legacy qui peut bouger sans prévenir.
 *
 * Il ne vaut que pour les entités obtenues par une méthode racine d'`api`, les seules qui
 * doivent arriver CHARGÉES : la coquille délibérée de `createFromCollection` (`news`,
 * `actions`) n'a jamais de données, ce qui est normal et ne dit rien de l'existence du fil.
 *
 * En cas de doute il rend `false` : un fil vide à tort est un moindre mal devant un
 * « supprimé » à tort, qui découragerait d'écrire là où c'est possible.
 */
export function isMissingDocument(host: unknown): boolean {
  const data = (host as { serverData?: unknown } | null)?.serverData;
  if (!data || typeof data !== "object") return false;
  const doc = data as Record<string, unknown>;
  // Aucune donnée du tout n'est pas un substitut : c'est une entité qu'on n'a pas chargée.
  if (Object.keys(doc).length === 0) return false;
  return doc._id === undefined && doc.id === undefined;
}
