import { describe, expect, test } from 'vitest';
import en from '@/modules/kanban/i18n/en.json';
import fr from '@/modules/kanban/i18n/fr.json';
import { hasTranslation } from '@/modules/kanban/__fixtures__/i18nLookup';
import { KANBAN_BOARD_TYPE_IDS, type KanbanConfig } from '@/modules/kanban/schema';
import { KANBAN_BOARD_TYPES, boardTypeOf, visibleBoardTypes } from './boardTypes';

const ids = (config: KanbanConfig | null | undefined) => visibleBoardTypes(config, 'projects').map((type) => type.id);

describe('registre des kanbans', () => {
  test('une entrée par identifiant de la config, chemins uniques', () => {
    expect(KANBAN_BOARD_TYPES.map((type) => type.id)).toEqual([...KANBAN_BOARD_TYPE_IDS]);
    expect(new Set(KANBAN_BOARD_TYPES.map((type) => type.path)).size).toBe(KANBAN_BOARD_TYPES.length);
  });

  test('chaque identifiant de la config a son entrée (les pages la lisent au chargement)', () => {
    for (const id of KANBAN_BOARD_TYPE_IDS) expect(boardTypeOf(id).id).toBe(id);
  });

  test('chaque tuile a son titre et sa description, fr et en', () => {
    for (const type of KANBAN_BOARD_TYPES) {
      for (const catalog of [fr, en]) {
        expect(hasTranslation(catalog, type.titleKey), type.titleKey).toBe(true);
        expect(hasTranslation(catalog, type.descriptionKey), type.descriptionKey).toBe(true);
      }
    }
  });
});

describe('visibleBoardTypes', () => {
  test('sans `boards` : tous, dans l ordre du registre', () => {
    expect(ids({})).toEqual(['actions', 'roles']);
    expect(ids(null)).toEqual(['actions', 'roles']);
  });

  test('`boards` restreint ET ordonne', () => {
    expect(ids({ boards: ['roles'] })).toEqual(['roles']);
    expect(ids({ boards: ['roles', 'actions'] })).toEqual(['roles', 'actions']);
  });

  test('config non revalidée : valeur inconnue ou répétée ignorée, sans casser', () => {
    const raw = JSON.parse('{"boards":["projets","roles","roles"]}') as KanbanConfig;
    expect(ids(raw)).toEqual(['roles']);
  });
});
