/**
 * Barre de filtres du tableau — logique PURE (DESIGN §6.2).
 *
 * Chaque popover de la barre (Assignés, Priorité, Étiquettes, Échéance,
 * Statut, Jalon) edite UNE facette du critere partage (`BoardFilterCriteria`,
 * moteur `lib/boardFilter.ts`). Ce module traduit « cocher telle valeur de
 * telle facette » en un nouveau critere, sans rien savoir de React : c'est ce
 * qui permet de tester les regles qui comptent (`tests/unit/filterBar.test.ts`)
 * — une liste qui se vide doit DISPARAITRE du critere, sans quoi
 * `countActiveFilters` compterait un filtre que plus rien n'active.
 */
import { DUE_WINDOW_FILTERS, isFilterActive, NO_MILESTONE_FILTER, type BoardFilterCriteria, type DueWindowFilter } from '@/modules/kanban/lib/boardFilter';
import { PRIORITY_FILTER_VALUES, type PriorityFilterValue } from '@/modules/kanban/lib/priority';
import { CARD_STATUSES, type BoardSource, type CardStatus } from '@/modules/kanban/types';

/** Les facettes de la barre, dans l'ordre de la maquette (+ le jalon d'un board-lien). */
export type FilterFacet = 'assignees' | 'priorities' | 'labelIds' | 'dueWindows' | 'statuses' | 'milestoneIds';

export const FILTER_FACETS: readonly FilterFacet[] = [
  'assignees',
  'priorities',
  'labelIds',
  'dueWindows',
  'statuses',
  'milestoneIds',
];

/**
 * Valeur « non assignee » du popover Assignés. Le moteur la porte dans un
 * booleen a part (`unassigned`) ; la barre la presente comme un choix parmi
 * les personnes, d'ou cette sentinelle qu'aucun identifiant ne peut valoir.
 */
export const UNASSIGNED_FILTER = '__unassigned__';

/** Valeurs cochees d'une facette, telles que le popover les affiche. */
export function facetValues(criteria: BoardFilterCriteria, facet: FilterFacet): string[] {
  switch (facet) {
    case 'assignees':
      return [...(criteria.unassigned === true ? [UNASSIGNED_FILTER] : []), ...(criteria.assignees ?? [])];
    case 'priorities':
      return [...(criteria.priorities ?? [])];
    case 'labelIds':
      return [...(criteria.labelIds ?? [])];
    case 'dueWindows':
      return [...(criteria.dueWindows ?? [])];
    case 'statuses':
      return [...(criteria.statuses ?? [])];
    case 'milestoneIds':
      return [...(criteria.milestoneIds ?? [])];
  }
}

/** Nombre de valeurs cochees : la pastille du declencheur. */
export function facetCount(criteria: BoardFilterCriteria, facet: FilterFacet): number {
  return facetValues(criteria, facet).length;
}

function toggled<T extends string>(list: readonly T[] | undefined, value: T): T[] | undefined {
  const current = list ?? [];
  const next = current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];
  return next.length > 0 ? next : undefined;
}

/** Remplace (ou retire) une cle du critere sans jamais laisser de cle `undefined`. */
function withKey<K extends keyof BoardFilterCriteria>(
  criteria: BoardFilterCriteria,
  key: K,
  value: BoardFilterCriteria[K] | undefined,
): BoardFilterCriteria {
  const next: BoardFilterCriteria = { ...criteria };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}

/*
 * Les valeurs arrivent des popovers sous forme de CHAINES : ces gardes les
 * ramenent au type de leur facette au lieu d'un `as`, en relisant les listes
 * de reference du moteur (une seule source). Une valeur inconnue est ignoree :
 * elle ne peut venir que d'un bug d'affichage, pas d'un choix.
 */
function isPriorityValue(value: string): value is PriorityFilterValue {
  return PRIORITY_FILTER_VALUES.some((entry) => entry === value);
}

function isDueWindow(value: string): value is DueWindowFilter {
  return DUE_WINDOW_FILTERS.some((entry) => entry === value);
}

function isCardStatus(value: string): value is CardStatus {
  return CARD_STATUSES.some((entry) => entry === value);
}

/** Coche ou decoche `value` dans la facette ; renvoie un NOUVEAU critere. */
export function toggleFacetValue(
  criteria: BoardFilterCriteria,
  facet: FilterFacet,
  value: string,
): BoardFilterCriteria {
  switch (facet) {
    case 'assignees':
      if (value === UNASSIGNED_FILTER) {
        return withKey(criteria, 'unassigned', criteria.unassigned === true ? undefined : true);
      }
      return withKey(criteria, 'assignees', toggled(criteria.assignees, value));
    case 'priorities':
      return isPriorityValue(value) ? withKey(criteria, 'priorities', toggled(criteria.priorities, value)) : criteria;
    case 'labelIds':
      return withKey(criteria, 'labelIds', toggled(criteria.labelIds, value));
    case 'dueWindows':
      return isDueWindow(value) ? withKey(criteria, 'dueWindows', toggled(criteria.dueWindows, value)) : criteria;
    case 'statuses':
      return isCardStatus(value) ? withKey(criteria, 'statuses', toggled(criteria.statuses, value)) : criteria;
    case 'milestoneIds':
      return withKey(criteria, 'milestoneIds', toggled(criteria.milestoneIds, value));
  }
}

/** Vide une facette (bouton « Effacer » de son popover), les autres restent. */
export function clearFacet(criteria: BoardFilterCriteria, facet: FilterFacet): BoardFilterCriteria {
  if (facet === 'assignees') return withKey(withKey(criteria, 'assignees', undefined), 'unassigned', undefined);
  return withKey(criteria, facet, undefined);
}

/**
 * Quelque chose restreint-il les cartes affichees ? Un filtre coche OU une
 * recherche non blanche (`countActiveFilters` ne compte pas la recherche, qui
 * a son propre champ). C'est ce qui distingue « colonne vide » de « rien ne
 * passe le filtre », et ce qui choisit la phrase annoncee apres un filtrage.
 */
export function hasActiveCriteria(criteria: BoardFilterCriteria): boolean {
  return isFilterActive(criteria) || (criteria.text ?? '').trim() !== '';
}

/**
 * Empreinte d'un critere, independante de l'ordre des cles et des valeurs.
 *
 * Le contexte de recherche recree son critere a chaque changement d'etat —
 * « Grouper », « Trier », une espace de plus dans la recherche — sans que la
 * selection change. Comparer les empreintes evite d'annoncer un filtrage qui
 * n'a pas eu lieu.
 */
export function criteriaSignature(criteria: BoardFilterCriteria): string {
  const entries = Object.entries(criteria)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      if (Array.isArray(value)) return [key, [...value].map(String).sort()] as const;
      if (key === 'text' && typeof value === 'string') return [key, value.trim()] as const;
      return [key, value] as const;
    })
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return JSON.stringify(entries);
}

/**
 * Phrase de la region vivante apres un filtrage (WCAG 4.1.3) : combien de
 * cartes passent, sur combien — ou le total quand plus rien ne filtre.
 */
export function filterResultAnnouncement(
  matched: number,
  total: number,
  active: boolean,
): { key: 'filterBar.resultCount' | 'filterBar.resultAll'; values: { count: number; total: number } } {
  return active
    ? { key: 'filterBar.resultCount', values: { count: matched, total } }
    : { key: 'filterBar.resultAll', values: { count: total, total } };
}

/**
 * Jalon à donner à une carte créée dans le tableau d'un projet filtré sur UN jalon : sans lui,
 * la carte naissait sans jalon et disparaissait aussitôt de la vue filtrée, comme si rien
 * n'avait été créé. `undefined` sinon. Repris de co-kanban (`pages/board/milestonesView.ts`).
 */
export function composerMilestoneId(criteria: BoardFilterCriteria, source: BoardSource): string | undefined {
  if (source !== 'communecter') return undefined;
  const ids = criteria.milestoneIds ?? [];
  return ids.length === 1 && ids[0] !== NO_MILESTONE_FILTER ? ids[0] : undefined;
}
