/**
 * Registre des vues du tableau des actions, repris de co-kanban (`tests/unit/boardViews.test.ts`)
 * sans la vue Rôles ni les tableaux autonomes.
 */
import { describe, expect, test } from 'vitest';
import en from '@/modules/kanban/i18n/en.json';
import fr from '@/modules/kanban/i18n/fr.json';
import { hasTranslation } from '@/modules/kanban/__fixtures__/i18nLookup';
import { ACTIONS_VIEW_IDS } from '@/modules/kanban/lib/kanbanPaths';
import { ACTIONS_VIEWS, actionsViewById, isViewAvailable, menuViews, segmentViews } from './actionsViews';

const ids = (views: readonly { id: string }[]) => views.map((view) => view.id);

describe('registre', () => {
  test('une entrée par vue routée, dans l’ordre des routes', () => {
    expect(ids(ACTIONS_VIEWS)).toEqual(ACTIONS_VIEW_IDS);
  });

  test('chaque libellé et chaque raison d’indisponibilité est traduit, fr et en', () => {
    const keys = ACTIONS_VIEWS.flatMap((view) => [view.labelKey, ...Object.values(view.unavailable)]);
    expect(keys.filter((key) => !hasTranslation(fr, key) || !hasTranslation(en, key))).toEqual([]);
  });
});

describe('sélecteur et menu', () => {
  test('le sélecteur porte Tableau et Liste, comme la maquette', () => {
    expect(ids(segmentViews('kanban'))).toEqual(['kanban', 'list']);
    expect(ids(segmentViews('list'))).toEqual(['kanban', 'list']);
  });

  test('une vue ouverte depuis le menu s’ajoute au sélecteur, pour qu’on sache où l’on est', () => {
    expect(ids(segmentViews('table'))).toEqual(['kanban', 'list', 'table']);
  });

  test('le menu propose les vues absentes du sélecteur ; la vue Jalons sur un projet seulement', () => {
    expect(ids(menuViews('projects'))).toEqual(['overview', 'milestones', 'table', 'timeline']);
    expect(ids(menuViews('organizations'))).toEqual(['overview', 'table', 'timeline']);
    // Type inconnu (tableau pas encore chargé) : jamais une vue qui dirait « indisponible ici ».
    expect(ids(menuViews(undefined))).toEqual(['overview', 'table', 'timeline']);
    // Lien antérieur aux organisations, sans `parentType` : un projet.
    expect(isViewAvailable(actionsViewById('milestones'), null)).toBe(true);
  });
});

describe('commandes par vue', () => {
  test('la Liste accepte tout, la Table se trie sans se grouper, la vue d’ensemble ne se filtre pas', () => {
    expect(actionsViewById('list').unavailable).toEqual({});
    expect(Object.keys(actionsViewById('table').unavailable)).toEqual(['group']);
    expect(actionsViewById('overview').unavailable.filter).toBe('boardViews.unavailable.overviewFilter');
  });

  test('seul le Tableau masque des colonnes', () => {
    expect(ACTIONS_VIEWS.filter((view) => view.hidesColumns).map((view) => view.id)).toEqual(['kanban']);
  });
});
