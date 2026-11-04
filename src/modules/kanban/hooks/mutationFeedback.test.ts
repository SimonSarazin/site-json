import { QueryClient } from '@tanstack/react-query';
import { describe, expect, test } from 'vitest';
import { boardMutationScope, rollbackBoardSnapshot, writeOptimisticSnapshot } from '@/modules/kanban/hooks/mutationFeedback';
import { patchCard } from '@/modules/kanban/lib/boardSync';
import { KANBAN_QUERY_KEYS } from '@/modules/kanban/constants/queryKeys';
import type { BoardSnapshot, RoleListResult } from '@/modules/kanban/types';
import { makeCard, makeColumn, makeSnapshot, NOW } from '../__fixtures__/snapshot';

/*
 * L'EFFET du rollback conditionnel (`decideRollback` est teste a part) : quatre
 * hooks le partagent desormais, une seule implementation a verrouiller.
 */
const KEY = KANBAN_QUERY_KEYS.BOARD('user1', 'board1');

/** Comme `onMutate` : le cache porte deja l'instantane, on y ecrit l'optimiste. */
function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const previous = makeSnapshot({ columns: [makeColumn('todo', 1000)], cards: [makeCard('c1', 'todo')] });
  queryClient.setQueryData<BoardSnapshot>(KEY, previous);
  const optimistic = writeOptimisticSnapshot(queryClient, KEY, patchCard(previous, 'c1', { title: 'Optimiste' }, NOW));
  return { queryClient, previous, optimistic };
}

describe('rollbackBoardSnapshot', () => {
  test('cache intact depuis onMutate : la photo d avant est reposee', () => {
    const { queryClient, previous, optimistic } = setup();
    expect(rollbackBoardSnapshot(queryClient, KEY, { previous, optimistic })).toBe('restore');
    // Partage structurel : une copie egale, pas forcement le meme objet.
    expect(queryClient.getQueryData(KEY)).toEqual(previous);
  });

  test('le temoin doit etre la reference STOCKEE : le cache garde une copie de l objet passe', () => {
    const queryClient = new QueryClient();
    const previous = makeSnapshot({ columns: [makeColumn('todo', 1000)], cards: [makeCard('c1', 'todo')] });
    queryClient.setQueryData<BoardSnapshot>(KEY, previous);
    const passed = patchCard(previous, 'c1', { title: 'Optimiste' }, NOW);
    queryClient.setQueryData<BoardSnapshot>(KEY, passed);
    // C'est pourquoi l'objet passe ne pouvait pas servir de temoin : le
    // rollback invalidait toujours, meme sans ecriture concurrente.
    expect(queryClient.getQueryData(KEY)).not.toBe(passed);
    expect(rollbackBoardSnapshot(queryClient, KEY, { previous, optimistic: passed })).toBe('invalidate');
  });

  test('une autre ecriture est passee : on invalide, la photo perimee n est PAS reposee', () => {
    const { queryClient, previous, optimistic } = setup();
    if (!optimistic) throw new Error('temoin absent');
    const later = patchCard(optimistic, 'c1', { title: 'Polling' }, NOW);
    queryClient.setQueryData<BoardSnapshot>(KEY, later);
    expect(rollbackBoardSnapshot(queryClient, KEY, { previous, optimistic })).toBe('invalidate');
    expect(queryClient.getQueryData(KEY)).toEqual(later);
    expect(queryClient.getQueryState(KEY)?.isInvalidated).toBe(true);
  });

  test('aucune ecriture optimiste : rien a defaire', () => {
    const { queryClient, optimistic } = setup();
    expect(rollbackBoardSnapshot(queryClient, KEY, undefined)).toBe('none');
    expect(queryClient.getQueryData(KEY)).toBe(optimistic);
  });
});

describe('generiques : un autre cache que l instantane (liste des roles, §12)', () => {
  const ROLES_KEY = KANBAN_QUERY_KEYS.ROLES('user1', 'board1');
  const previous: RoleListResult = { roles: [], members: [], canManageRoles: true, rev: 4 };

  test('writeOptimisticSnapshot rend la reference STOCKEE, et rollbackBoardSnapshot la reconnait', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData<RoleListResult>(ROLES_KEY, previous);
    const passed: RoleListResult = { ...previous, roles: [{ name: 'Accueil', declared: true, memberIds: [] }] };
    const optimistic = writeOptimisticSnapshot<RoleListResult>(queryClient, ROLES_KEY, passed);
    expect(optimistic).toEqual(passed);
    expect(optimistic).toBe(queryClient.getQueryData(ROLES_KEY));
    expect(rollbackBoardSnapshot<RoleListResult>(queryClient, ROLES_KEY, { previous, optimistic })).toBe('restore');
    expect(queryClient.getQueryData(ROLES_KEY)).toEqual(previous);
  });

  test('une relecture posee entre-temps : on invalide, la photo n est pas reposee', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData<RoleListResult>(ROLES_KEY, previous);
    const optimistic = writeOptimisticSnapshot<RoleListResult>(queryClient, ROLES_KEY, { ...previous, rev: 5 });
    const served: RoleListResult = { ...previous, rev: 6 };
    queryClient.setQueryData<RoleListResult>(ROLES_KEY, served);
    expect(rollbackBoardSnapshot<RoleListResult>(queryClient, ROLES_KEY, { previous, optimistic })).toBe('invalidate');
    expect(queryClient.getQueryData(ROLES_KEY)).toEqual(served);
  });
});

describe('boardMutationScope', () => {
  test('une file par tableau, la meme chaine pour tous les hooks', () => {
    expect(boardMutationScope('b1')).toEqual({ id: 'board-b1' });
    expect(boardMutationScope('b1')).toEqual(boardMutationScope('b1'));
    expect(boardMutationScope('b2')).not.toEqual(boardMutationScope('b1'));
  });
});
