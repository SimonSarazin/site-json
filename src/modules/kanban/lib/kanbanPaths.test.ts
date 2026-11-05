import { describe, expect, test } from 'vitest';
import { actionCardPath, actionsChildRoutes, actionsViewPath, ACTIONS_VIEW_IDS, CARD_ROUTE_SEGMENT, KANBAN_ACTIONS_PATH, parseActionsPath } from './kanbanPaths';

describe('actionsViewPath', () => {
  test('le Tableau est l’index, les autres vues ont leur segment', () => {
    expect(actionsViewPath()).toBe(KANBAN_ACTIONS_PATH);
    expect(actionsViewPath('kanban')).toBe(KANBAN_ACTIONS_PATH);
    expect(actionsViewPath('list')).toBe(`${KANBAN_ACTIONS_PATH}/liste`);
    expect(actionsViewPath('milestones')).toBe(`${KANBAN_ACTIONS_PATH}/jalons`);
  });
});

describe('actionCardPath', () => {
  test('la fiche est une route fille de la vue qui l’ouvre (le Tableau par défaut)', () => {
    expect(actionCardPath('66aa0007')).toBe(`${KANBAN_ACTIONS_PATH}/${CARD_ROUTE_SEGMENT}/66aa0007`);
    expect(actionCardPath('66aa0007', 'table')).toBe(`${KANBAN_ACTIONS_PATH}/table/${CARD_ROUTE_SEGMENT}/66aa0007`);
  });

  test('un identifiant inattendu ne sort pas de son segment', () => {
    expect(actionCardPath('a/b?c')).toBe(`${KANBAN_ACTIONS_PATH}/${CARD_ROUTE_SEGMENT}/a%2Fb%3Fc`);
  });
});

describe('parseActionsPath', () => {
  test('aller-retour : chaque vue, avec ou sans carte', () => {
    for (const view of ACTIONS_VIEW_IDS) {
      const rest = (path: string) => path.slice(KANBAN_ACTIONS_PATH.length + 1);
      expect(parseActionsPath(rest(actionsViewPath(view)))).toEqual({ view, cardId: null });
      if (view !== 'overview') expect(parseActionsPath(rest(actionCardPath('a/1', view)))).toEqual({ view, cardId: 'a/1' });
    }
  });

  test('`carte/:id` à la racine est la fiche ouverte depuis le Tableau', () => {
    expect(parseActionsPath('carte/a1')).toEqual({ view: 'kanban', cardId: 'a1' });
    expect(parseActionsPath(undefined)).toEqual({ view: 'kanban', cardId: null });
  });

  test('la vue d’ensemble n’ouvre pas de carte ; un `%` invalide n’en ouvre pas non plus', () => {
    expect(parseActionsPath('vue-ensemble/carte/a1')).toEqual({ view: 'overview', cardId: null });
    expect(parseActionsPath('liste/carte/%E0%A4%A')).toEqual({ view: 'list', cardId: null });
  });
});

describe('actionsChildRoutes', () => {
  test('une route par vue, la fiche sous chaque vue qui montre des cartes, le même élément pour les deux', () => {
    const routes = actionsChildRoutes((view) => view);
    expect(routes.map((route) => (route.index ? '(index)' : route.path))).toEqual([
      'vue-ensemble',
      '(index)',
      'carte/:cardId',
      'jalons',
      'jalons/carte/:cardId',
      'liste',
      'liste/carte/:cardId',
      'table',
      'table/carte/:cardId',
      'chronologie',
      'chronologie/carte/:cardId',
    ]);
    expect(routes.find((route) => route.path === 'liste/carte/:cardId')?.element).toBe('list');
  });
});
