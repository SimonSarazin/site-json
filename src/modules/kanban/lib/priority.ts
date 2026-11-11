/**
 * Priorites : ordre, poids et valeurs de filtre — logique PURE et partagee.
 *
 * Sortie de `PriorityBadge.tsx` : un fichier de composant qui exporte des
 * constantes casse le Fast Refresh (`react-refresh/only-export-components`), et
 * cinq ecrans (tri de « mes cartes », menu de filtre, modale, vues Liste et
 * Table) lisaient ces tables. Une seule source, sinon deux listes ecrites a la
 * main finissent par diverger.
 *
 * Depuis le §11, une carte peut n'avoir AUCUNE priorite (`null`, cas majoritaire
 * des actions Communecter). Elle pese 0 : elle passe derriere `low`, comme dans
 * l'ordre canonique d'une colonne (D16).
 */
import type { Priority } from '@/modules/kanban/types';

/** Ordre decroissant d'urgence. */
export const PRIORITY_ORDER: readonly Priority[] = ['urgent', 'high', 'medium', 'low'];

/** Poids de tri : `urgent` remonte en tete. */
export const PRIORITY_WEIGHT: Readonly<Record<Priority, number>> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/** Poids d'une priorite eventuellement absente : « aucune » = 0, sous `low`. */
export function priorityWeight(priority: Priority | null | undefined): number {
  return priority ? PRIORITY_WEIGHT[priority] : 0;
}

/**
 * Valeur de filtre : une priorite, ou `none` pour « sans priorite ». Une chaine
 * plutot que `null` parce que le critere doit rester serialisable ET servir de
 * cle de liste (`key={value}`) dans le popover.
 */
export type PriorityFilterValue = Priority | 'none';

export const PRIORITY_FILTER_VALUES: readonly PriorityFilterValue[] = [...PRIORITY_ORDER, 'none'];

export function priorityFilterValue(priority: Priority | null | undefined): PriorityFilterValue {
  return priority ?? 'none';
}

/** Lit une valeur de `<select>` : '' = aucune, une priorite connue, sinon `undefined` (refus). */
export function parsePriorityInput(value: string): Priority | null | undefined {
  if (value === '') return null;
  return PRIORITY_ORDER.find((priority) => priority === value);
}
