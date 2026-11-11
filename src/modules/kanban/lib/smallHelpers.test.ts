/**
 * Petits helpers purs partages : priorites, ensembles, initiales, periodes.
 * Un helper pur extrait = un test (bonnes pratiques §9).
 */
import { describe, expect, test } from 'vitest';
import { interfaceLanguage } from '@/modules/kanban/lib/language';
import { dateRangeLabel } from '@/modules/kanban/lib/dates';
import { initialsOf } from '@/modules/kanban/lib/initials';
import { parsePriorityInput, PRIORITY_FILTER_VALUES, priorityFilterValue, priorityWeight } from '@/modules/kanban/lib/priority';
import { sameStringSet } from '@/modules/kanban/lib/sets';

describe('priorites', () => {
  test('« aucune » pese 0, sous « basse »', () => {
    expect(priorityWeight('urgent')).toBe(4);
    expect(priorityWeight('low')).toBe(1);
    expect(priorityWeight(null)).toBe(0);
    expect(priorityWeight(undefined)).toBe(0);
  });

  test('valeur de filtre et lecture d un select', () => {
    // Indexation et non `.at(-1)` : la lib cible est ES2020 (tsconfig.app.json).
    expect(PRIORITY_FILTER_VALUES[PRIORITY_FILTER_VALUES.length - 1]).toBe('none');
    expect(priorityFilterValue(null)).toBe('none');
    expect(priorityFilterValue('high')).toBe('high');
    expect(parsePriorityInput('')).toBeNull();
    expect(parsePriorityInput('urgent')).toBe('urgent');
    expect(parsePriorityInput('critique')).toBeUndefined();
  });
});

test('sameStringSet : l ordre ne compte pas, la longueur si', () => {
  expect(sameStringSet(['a', 'b'], ['b', 'a'])).toBe(true);
  expect(sameStringSet(['a'], ['a', 'a'])).toBe(false);
  expect(sameStringSet([], [])).toBe(true);
});

test('initialsOf : deux mots, majuscules, repli « ? »', () => {
  expect(initialsOf('Appli mobile La Fabrique')).toBe('AM');
  expect(initialsOf('  léa  hoarau ')).toBe('LH');
  expect(initialsOf('')).toBe('?');
});

describe('dateRangeLabel', () => {
  const translate = (key: string, values: Record<string, string>) => `${key}${JSON.stringify(values)}`;

  test('choisit la forme selon les bornes connues', () => {
    expect(dateRangeLabel(1_790_812_800, 1_791_417_600, 'fr', translate)).toBe(
      'boards.dateRange{"start":"1 oct. 2026","end":"8 oct. 2026"}',
    );
    expect(dateRangeLabel(1_790_812_800, null, 'fr', translate)).toBe('boards.dateFrom{"start":"1 oct. 2026"}');
    expect(dateRangeLabel(null, 1_791_417_600, 'en', translate)).toBe('boards.dateUntil{"end":"Oct 8, 2026"}');
    expect(dateRangeLabel(null, null, 'fr', translate)).toBe('boards.noDate{}');
  });
});

describe('interfaceLanguage', () => {
  test('ramene la langue i18next aux deux langues que le serveur connait', () => {
    expect(interfaceLanguage('fr')).toBe('fr');
    expect(interfaceLanguage('en')).toBe('en');
    expect(interfaceLanguage('en-US')).toBe('en');
    expect(interfaceLanguage('EN')).toBe('en');
    // Repli sur le francais, langue principale de Communecter.
    expect(interfaceLanguage('de')).toBe('fr');
    expect(interfaceLanguage(undefined)).toBe('fr');
  });
});
