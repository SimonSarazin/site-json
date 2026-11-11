/**
 * Colonnes masquees localement (DESIGN §6.3, §6.6) : une valeur de stockage
 * abimee ne doit jamais masquer tout un tableau, et chaque PORTEE (Tableau,
 * colonnes de role de la vue Roles — D34) a sa cle.
 */
import { describe, expect, test } from 'vitest';
import {
  HIDDEN_COLUMNS_SCOPES,
  hiddenColumnsStorageKey,
  parseHiddenColumns,
  pruneHiddenColumns,
  serializeHiddenColumns,
  toggleHiddenColumn,
  visibleColumnIds,
} from '@/modules/kanban/components/board/hiddenColumns';

describe('stockage', () => {
  test('une cle par tableau, prefixee comme les autres preferences ; le Tableau garde la cle d origine', () => {
    expect(hiddenColumnsStorageKey('board1')).toBe('kanban.hiddenColumns.board1');
    expect(hiddenColumnsStorageKey('board1', 'kanban')).toBe('kanban.hiddenColumns.board1');
  });

  test('la vue Roles a SA cle (suffixe de portee), distincte de celle du Tableau (D34)', () => {
    expect(hiddenColumnsStorageKey('board1', 'roles')).toBe('kanban.hiddenColumns.board1:roles');
    const keys = HIDDEN_COLUMNS_SCOPES.map((scope) => hiddenColumnsStorageKey('board1', scope));
    expect(new Set(keys).size).toBe(HIDDEN_COLUMNS_SCOPES.length);
    // Deux tableaux, meme portee : deux cles.
    expect(hiddenColumnsStorageKey('board2', 'roles')).not.toBe(hiddenColumnsStorageKey('board1', 'roles'));
  });

  test('aller-retour : trie et sans doublon', () => {
    const raw = serializeHiddenColumns(['next', 'discuter', 'next']);
    expect(raw).toBe('["discuter","next"]');
    expect(parseHiddenColumns(raw)).toEqual(['discuter', 'next']);
  });

  test('valeur absente, vide, illisible ou mal formee : rien de masque', () => {
    expect(parseHiddenColumns(null)).toEqual([]);
    expect(parseHiddenColumns('')).toEqual([]);
    expect(parseHiddenColumns('{oups')).toEqual([]);
    expect(parseHiddenColumns('"next"')).toEqual([]);
    expect(parseHiddenColumns('{"next":true}')).toEqual([]);
  });

  test('les entrees qui ne sont pas des chaines non vides sont ecartees', () => {
    expect(parseHiddenColumns('["next", 3, null, "", "next", "totest"]')).toEqual(['next', 'totest']);
  });
});

describe('manipulation', () => {
  test('bascule : masque puis reaffiche', () => {
    const hidden = toggleHiddenColumn([], 'next');
    expect(hidden).toEqual(['next']);
    expect(toggleHiddenColumn(hidden, 'next')).toEqual([]);
  });

  test('oublie les colonnes qui n existent plus', () => {
    expect(pruneHiddenColumns(['next', 'gone'], ['todo', 'next'])).toEqual(['next']);
  });

  test('colonnes visibles dans l ordre recu', () => {
    expect(visibleColumnIds(['todo', 'next', 'tracking', 'done'], ['next', 'done'])).toEqual([
      'todo',
      'tracking',
    ]);
    expect(visibleColumnIds(['todo', 'done'], [])).toEqual(['todo', 'done']);
  });
});
