import type { CommentableType } from "../types";

/**
 * Résolution d'une cible (type, id) en entité du SDK.
 *
 * `api` n'expose une méthode racine que pour **huit** des dix types commentables : `news` et
 * `actions` n'en ont pas, une actualité se chargeant depuis son entité porteuse et une action
 * depuis son projet. C'était le blocage B9, et il a fait tomber la 3ᵉ colonne du panneau au
 * premier essai au navigateur — un lien profond vers un fil d'action n'affichait rien.
 *
 * **B9 est levé** : le registre d'entités du SDK (`helper.createFromCollection`) couvre, lui,
 * les DOUZE collections. Mesuré : une action construite ainsi rend bien ses commentaires.
 * On garde toutefois la méthode racine quand elle existe, parce qu'elle rend une entité
 * CHARGÉE (avec ses données), là où le registre ne rend qu'une coquille portant l'identifiant
 * — suffisant pour lire le fil, pas pour afficher une fiche.
 *
 * Ordre de préférence, du moins coûteux au plus général :
 *   1. l'entité déjà chargée par la page (cas nominal, aucun appel) ;
 *   2. la méthode racine d'`api`, pour les huit types qui en ont une ;
 *   3. le registre d'entités, pour les deux autres.
 */
const METHOD_BY_TYPE = {
  citoyens: "user",
  organizations: "organization",
  projects: "project",
  events: "event",
  poi: "poi",
  answers: "answer",
  forms: "form",
  classifieds: "classified",
} as const satisfies Partial<Record<CommentableType, string>>;

export type ResolvableType = keyof typeof METHOD_BY_TYPE;

/** Les types qu'on sait charger depuis le seul couple (type, id). */
export function isResolvableType(type: CommentableType): type is ResolvableType {
  return type in METHOD_BY_TYPE;
}

/** Nom de la méthode d'`api` qui charge ce type, ou `null` s'il en faut une entité porteuse. */
export function apiMethodForType(type: CommentableType): string | null {
  return isResolvableType(type) ? METHOD_BY_TYPE[type] : null;
}

/** Types qui exigent une entité porteuse — utile pour un message d'erreur explicite. */
export const TYPES_REQUIRING_HOST: readonly CommentableType[] = ["news", "actions"];
