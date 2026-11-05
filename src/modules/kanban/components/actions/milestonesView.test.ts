/**
 * Vue Jalons, reprise de co-kanban (`tests/unit/milestonesView.test.ts`) : la vue de Kanban
 * gestion qui range les actions par jalon ouvert, plus « Sans jalon », sans les actions terminées.
 */
import { describe, expect, test } from 'vitest';
import { MILESTONES, makeAction, makeLinkColumns, makeLinkSnapshot } from '@/modules/kanban/__fixtures__/snapshot';
import { NO_MILESTONE_COLUMN_ID, buildMilestoneBoard, milestoneColumnId, milestoneIdOfColumn, milestoneViewSnapshot, newCardStatusColumnId } from './milestonesView';

const [CLOSED, OPEN] = MILESTONES;
const copy = (milestone: (typeof MILESTONES)[number]) => ({ milestoneId: milestone.milestoneId, name: milestone.name, status: milestone.status });

function snapshot() {
  return makeLinkSnapshot({
    cards: [
      makeAction('a1', 'todo', { milestone: copy(OPEN) }),
      makeAction('a2', 'tracking'),
      makeAction('a3', 'done', { milestone: copy(OPEN) }),
      makeAction('a4', 'todo', { milestone: copy(CLOSED) }),
      makeAction('a5', 'next', { milestone: { milestoneId: 'disparu0000000000', name: 'Ancien', status: 'open' } }),
      makeAction('a6', 'done'),
    ],
  });
}

describe('identifiants des colonnes de jalon', () => {
  test('aller-retour, « Sans jalon » = null, colonne inconnue = undefined', () => {
    expect(milestoneIdOfColumn(milestoneColumnId(OPEN.milestoneId))).toBe(OPEN.milestoneId);
    expect(milestoneIdOfColumn(NO_MILESTONE_COLUMN_ID)).toBeNull();
    expect(milestoneIdOfColumn('todo')).toBeUndefined();
    expect(milestoneIdOfColumn('milestone:')).toBeUndefined();
  });
});

describe('buildMilestoneBoard', () => {
  const board = buildMilestoneBoard(snapshot(), 'Sans jalon');

  test('colonnes : « Sans jalon », puis les jalons OUVERTS dans l’ordre du projet', () => {
    expect(board.columns.map((column) => column.title)).toEqual(['Sans jalon', 'V1.2']);
    expect(board.columns.map((column) => column._id)).toEqual([NO_MILESTONE_COLUMN_ID, milestoneColumnId(OPEN.milestoneId)]);
    // Une colonne de vue n'est ni de fin, ni limitée, ni traduisible.
    expect(board.columns.every((column) => !column.isDoneColumn && column.wipLimit === null && column.titleKey === null)).toBe(true);
  });

  test('cartes : non terminées seulement, chacune dans la colonne de son jalon', () => {
    expect(board.cards.map((card) => card._id)).toEqual(['a1', 'a2']);
    expect(board.columnOf.get('a1')).toBe(milestoneColumnId(OPEN.milestoneId));
    expect(board.columnOf.get('a2')).toBe(NO_MILESTONE_COLUMN_ID);
  });

  test('les terminées sont COMPTÉES par colonne, pas affichées', () => {
    expect(board.meta.map((entry) => entry.doneCount)).toEqual([1, 1]);
  });

  test('jalon clos ou disparu du projet : la carte n’a pas de colonne, la vue le dit', () => {
    expect(board.hiddenClosedCount).toBe(2);
  });

  test('l’instantané de la vue ferme la gestion des COLONNES, garde les droits sur les cartes', () => {
    const view = milestoneViewSnapshot(snapshot(), board);
    expect(view.columns).toBe(board.columns);
    expect(view.cards).toBe(board.cards);
    expect(view.capabilities.canReorderColumns).toBe(false);
    expect(view.capabilities.canManageColumns).toBe(false);
    expect(view.capabilities.canEditCards).toBe(true);
  });
});

describe('création depuis la vue', () => {
  test('une carte créée dans un jalon part dans « À faire », comme dans gestion', () => {
    expect(newCardStatusColumnId(makeLinkColumns())).toBe('todo');
    expect(
      newCardStatusColumnId([
        { _id: 'done', isDoneColumn: true, rank: 1 },
        { _id: 'next', isDoneColumn: false, rank: 2 },
      ]),
    ).toBe('next');
    expect(newCardStatusColumnId([])).toBeUndefined();
  });
});
