// @vitest-environment jsdom
/**
 * Checklist OPTIMISTE de `updateCard`, selon la carte du cache.
 *
 * Carte TRONQUEE par le budget de `board/get` (§11.9 E29) : sa checklist n'est
 * pas dans l'instantane, l'optimiste ne fusionne rien contre la liste vide et
 * ne recompte pas la pastille. Les autres champs restent optimistes ; la
 * checklist attend la reponse du serveur, qui porte la carte complete.
 *
 * Carte d'un BOARD KANBAN : la liste part sans base (pas de fusion a trois),
 * elle EST la nouvelle liste — posee aussitot, compteurs recalcules.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { useBoard } from '@/modules/kanban/hooks/useBoard';
import { useBoardMutations } from '@/modules/kanban/hooks/useBoardMutations';
import { KANBAN_QUERY_KEYS } from '@/modules/kanban/constants/queryKeys';
import type { BoardSnapshot, Card } from '@/modules/kanban/types';
import {
  deferred,
  hookWrapper,
  ok,
  resetHarness,
  signIn,
  stubKanbanFetch,
  testQueryClient,
  type FakeResponse,
} from '../__fixtures__/hookHarness';
import { makeAction, makeCard, makeColumn, makeLinkSnapshot, makeSnapshot } from '../__fixtures__/snapshot';

const CHECKLIST = [
  { id: 't1', label: 'Maquette', done: true },
  { id: 't2', label: 'Recette', done: false },
];
const TRUNCATED = makeAction('c1', 'todo', { checklist: [], checklistDone: 1, checklistTotal: 2, checklistTruncated: true });
const SNAPSHOT = makeLinkSnapshot({ cards: [TRUNCATED] });
const BOARD_KEY = KANBAN_QUERY_KEYS.BOARD('u1', SNAPSHOT.board._id);

beforeEach(() => {
  signIn('u1');
});

afterEach(() => {
  resetHarness();
});

test('carte tronquee : titre optimiste, checklist et compteurs intacts jusqu a la reponse complete', async () => {
  const response = deferred<FakeResponse>();
  stubKanbanFetch({ 'board/get': () => ok(SNAPSHOT), 'card/update': () => response.promise });
  const queryClient = testQueryClient();
  const hook = renderHook(
    () => ({ board: useBoard(SNAPSHOT.board._id), mutations: useBoardMutations(SNAPSHOT.board._id) }),
    { wrapper: hookWrapper(queryClient) },
  );
  await waitFor(() => expect(hook.result.current.board.data).toBeDefined());
  const cached = (): Card | undefined => queryClient.getQueryData<BoardSnapshot>(BOARD_KEY)?.cards[0];

  const sent = [CHECKLIST[0], { ...CHECKLIST[1], done: true }];
  let saved: Promise<Card> = Promise.resolve(TRUNCATED);
  act(() => {
    saved = hook.result.current.mutations.updateCard.mutateAsync({
      cardId: 'c1',
      title: 'Agenda renommé',
      checklist: sent,
      checklistBase: CHECKLIST,
    });
  });

  await waitFor(() => expect(cached()?.title).toBe('Agenda renommé'));
  expect(cached()).toMatchObject({ checklist: [], checklistDone: 1, checklistTotal: 2, checklistTruncated: true });

  // La reponse du serveur : la carte FUSIONNEE et complete, sans drapeau.
  const { checklistTruncated: _flag, ...served } = TRUNCATED;
  response.resolve(ok({ card: { ...served, title: 'Agenda renommé', checklist: sent, checklistDone: 2 }, rev: 13 }));
  await act(async () => {
    await saved;
  });
  expect(cached()?.checklist).toEqual(sent);
  expect(cached()?.checklistDone).toBe(2);
  expect(cached()?.checklistTruncated).toBeUndefined();
});

test('board kanban : la checklist envoyee est posee aussitot, compteurs recalcules', async () => {
  const card = makeCard('k1', 'todo', {
    checklist: [{ id: 'p1', label: 'Devis', done: false }],
    checklistDone: 0,
    checklistTotal: 1,
  });
  const kanban = makeSnapshot({ columns: [makeColumn('todo', 1000)], cards: [card] });
  const response = deferred<FakeResponse>();
  stubKanbanFetch({ 'board/get': () => ok(kanban), 'card/update': () => response.promise });
  const queryClient = testQueryClient();
  const hook = renderHook(
    () => ({ board: useBoard(kanban.board._id), mutations: useBoardMutations(kanban.board._id) }),
    { wrapper: hookWrapper(queryClient) },
  );
  await waitFor(() => expect(hook.result.current.board.data).toBeDefined());
  const boardKey = KANBAN_QUERY_KEYS.BOARD('u1', kanban.board._id);
  const cached = (): Card | undefined => queryClient.getQueryData<BoardSnapshot>(boardKey)?.cards[0];

  // Un point coche, un point ajoute ; pas de `checklistBase` sur un board kanban.
  const sent = [
    { id: 'p1', label: 'Devis', done: true },
    { id: 'p2', label: 'Commande', done: false },
  ];
  let saved: Promise<Card> = Promise.resolve(card);
  act(() => {
    saved = hook.result.current.mutations.updateCard.mutateAsync({ cardId: 'k1', checklist: sent });
  });

  // Avant toute reponse : la liste affichee est celle envoyee, et la pastille
  // « 1/2 » est recomptee sur elle (sinon elle resterait a « 0/1 »).
  await waitFor(() => expect(cached()?.checklist).toEqual(sent));
  expect(cached()).toMatchObject({ checklistDone: 1, checklistTotal: 2 });

  response.resolve(ok({ card: { ...card, checklist: sent, checklistDone: 1, checklistTotal: 2 }, rev: 13 }));
  await act(async () => {
    await saved;
  });
  expect(cached()?.checklist).toEqual(sent);
});
