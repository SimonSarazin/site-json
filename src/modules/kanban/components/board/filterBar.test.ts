/**
 * Facettes de la barre de filtres (DESIGN §6.2) : une liste qui se vide doit
 * disparaitre du critere, sinon `countActiveFilters` compte un filtre fantome.
 */
import { describe, expect, test } from 'vitest';
import {
  FILTER_FACETS,
  UNASSIGNED_FILTER,
  clearFacet,
  criteriaSignature,
  facetCount,
  facetValues,
  filterResultAnnouncement,
  hasActiveCriteria,
  toggleFacetValue,
  composerMilestoneId,
} from '@/modules/kanban/components/board/filterBar';
import { countActiveFilters, EMPTY_FILTER, NO_MILESTONE_FILTER } from '@/modules/kanban/lib/boardFilter';

describe('toggleFacetValue', () => {
  test('cocher puis decocher : la cle disparait, aucun filtre ne reste compte', () => {
    const once = toggleFacetValue(EMPTY_FILTER, 'priorities', 'urgent');
    expect(once).toEqual({ priorities: ['urgent'] });
    expect(countActiveFilters(once)).toBe(1);
    const twice = toggleFacetValue(once, 'priorities', 'urgent');
    expect(twice).toEqual({});
    expect(countActiveFilters(twice)).toBe(0);
  });

  test('les autres facettes ne sont pas touchees', () => {
    const criteria = { statuses: ['complete' as const], text: 'web' };
    expect(toggleFacetValue(criteria, 'labelIds', 'tag:web')).toEqual({
      statuses: ['complete'],
      text: 'web',
      labelIds: ['tag:web'],
    });
  });

  test('« non assignee » passe par le booleen du moteur', () => {
    const criteria = toggleFacetValue(EMPTY_FILTER, 'assignees', UNASSIGNED_FILTER);
    expect(criteria).toEqual({ unassigned: true });
    expect(toggleFacetValue(criteria, 'assignees', 'u1')).toEqual({ unassigned: true, assignees: ['u1'] });
    expect(toggleFacetValue(criteria, 'assignees', UNASSIGNED_FILTER)).toEqual({});
  });

  test('echeances, statuts et jalons', () => {
    expect(toggleFacetValue(EMPTY_FILTER, 'dueWindows', 'overdue')).toEqual({ dueWindows: ['overdue'] });
    expect(toggleFacetValue(EMPTY_FILTER, 'statuses', 'on_track')).toEqual({ statuses: ['on_track'] });
    expect(toggleFacetValue(EMPTY_FILTER, 'milestoneIds', NO_MILESTONE_FILTER)).toEqual({
      milestoneIds: [NO_MILESTONE_FILTER],
    });
  });

  test('une valeur etrangere a la facette est ignoree (meme reference)', () => {
    const criteria = { priorities: ['low' as const] };
    expect(toggleFacetValue(criteria, 'priorities', 'enorme')).toBe(criteria);
    expect(toggleFacetValue(criteria, 'dueWindows', 'demain')).toBe(criteria);
    expect(toggleFacetValue(criteria, 'statuses', 'archived')).toBe(criteria);
  });

  test('la priorite « aucune » est une valeur de filtre', () => {
    expect(toggleFacetValue(EMPTY_FILTER, 'priorities', 'none')).toEqual({ priorities: ['none'] });
  });
});

describe('lecture et remise a zero', () => {
  const criteria = {
    unassigned: true,
    assignees: ['u1', 'u2'],
    priorities: ['high' as const],
    milestoneIds: ['m1'],
  };

  test('valeurs et compteurs par facette', () => {
    expect(facetValues(criteria, 'assignees')).toEqual([UNASSIGNED_FILTER, 'u1', 'u2']);
    expect(facetCount(criteria, 'assignees')).toBe(3);
    expect(facetCount(criteria, 'priorities')).toBe(1);
    expect(facetCount(criteria, 'labelIds')).toBe(0);
    expect(facetCount(criteria, 'milestoneIds')).toBe(1);
  });

  test('effacer une facette laisse les autres', () => {
    expect(clearFacet(criteria, 'assignees')).toEqual({ priorities: ['high'], milestoneIds: ['m1'] });
    expect(clearFacet(criteria, 'priorities')).toEqual({
      unassigned: true,
      assignees: ['u1', 'u2'],
      milestoneIds: ['m1'],
    });
  });

  test('les six facettes de la barre, dans l ordre de la maquette', () => {
    expect(FILTER_FACETS).toEqual(['assignees', 'priorities', 'labelIds', 'dueWindows', 'statuses', 'milestoneIds']);
  });
});

describe('hasActiveCriteria', () => {
  test('un filtre coche ou une recherche non blanche restreignent les cartes', () => {
    expect(hasActiveCriteria(EMPTY_FILTER)).toBe(false);
    expect(hasActiveCriteria({ text: '   ' })).toBe(false);
    expect(hasActiveCriteria({ text: 'web' })).toBe(true);
    expect(hasActiveCriteria({ priorities: ['urgent'] })).toBe(true);
  });
});

/*
 * Constat #104 : seul un changement de SELECTION est annonce. Le contexte
 * recree son critere pour « Grouper », « Trier » ou une espace de plus.
 */
describe('criteriaSignature', () => {
  test('meme selection, cles et valeurs dans un autre ordre : meme empreinte', () => {
    expect(criteriaSignature({ priorities: ['urgent', 'high'], text: 'web' })).toBe(
      criteriaSignature({ text: ' web ', priorities: ['high', 'urgent'] }),
    );
  });

  test('une valeur de plus : empreinte differente', () => {
    expect(criteriaSignature({ priorities: ['urgent'] })).not.toBe(criteriaSignature({ priorities: ['urgent', 'high'] }));
    expect(criteriaSignature(EMPTY_FILTER)).not.toBe(criteriaSignature({ text: 'w' }));
  });
});

describe('filterResultAnnouncement', () => {
  test('quelque chose filtre : combien passent, sur combien', () => {
    expect(filterResultAnnouncement(2, 40, true)).toEqual({ key: 'filterBar.resultCount', values: { count: 2, total: 40 } });
  });

  test('plus rien ne filtre : le total', () => {
    expect(filterResultAnnouncement(40, 40, false)).toEqual({ key: 'filterBar.resultAll', values: { count: 40, total: 40 } });
  });
});

describe('composerMilestoneId (repris de milestonesView.test.ts)', () => {
  test('tableau d’un projet filtré sur UN jalon : la carte créée y est rattachée', () => {
    expect(composerMilestoneId({ milestoneIds: ['m1'] }, 'communecter')).toBe('m1');
    expect(composerMilestoneId({ milestoneIds: ['m1', 'm2'] }, 'communecter')).toBeUndefined();
    expect(composerMilestoneId({ milestoneIds: [NO_MILESTONE_FILTER] }, 'communecter')).toBeUndefined();
    expect(composerMilestoneId({ milestoneIds: ['m1'] }, 'kanban')).toBeUndefined();
    expect(composerMilestoneId({}, 'communecter')).toBeUndefined();
  });
});
