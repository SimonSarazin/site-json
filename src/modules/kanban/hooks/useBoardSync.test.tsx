// @vitest-environment jsdom
/**
 * CABLAGE du polling delta (`useBoardSync`) et du fil de commentaires
 * (`useCardComments`), montes sur un vrai cache avec un backend simule.
 *
 * Leurs DECISIONS sont pures et testees ailleurs (`decideSync`,
 * `commentThreadsTouched`, `isAccessLostFailure`) ; ce fichier verrouille ce
 * qu'un hook en fait, que la relecture a vu disparaitre sans qu'aucun test ne
 * rougisse (#24, #72, #73) :
 *  - une reponse de `board/sync` partie AVANT un `board/get` plus recent est
 *    abandonnee, qu'elle demande d'appliquer ou de recharger ;
 *  - une activite de commentaire relit le fil MONTE (pastille a 0), un
 *    rechargement relit tous les fils du tableau ;
 *  - une perte d'acces SUSPEND la boucle, et seul un `board/get` reussi la
 *    relance — pas une ecriture locale du cache, pas une AUTRE query reussie ;
 *  - relancee, la boucle repart SEULE, au rythme de son minuteur : la reprise
 *    se prouve sans retour d'onglet, qui declencherait lui-meme une passe ;
 *  - §12 (D30) : une activite `role.updated` relit la liste des ROLES sans
 *    recharger l'instantane ; un rechargement complet la relit aussi ; mais une
 *    activite que la liste porte deja (ma propre ecriture, posee et relue par
 *    `useRoleMutations`) ne la relit PAS une seconde fois.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useBoard } from '@/modules/kanban/hooks/useBoard';
import { BOARD_SYNC_INTERVAL_MS, useBoardSync } from '@/modules/kanban/hooks/useBoardSync';
import { useCardComments } from '@/modules/kanban/hooks/useCardComments';
import { useRoleMutations, useRoles } from '@/modules/kanban/hooks/useRoles';
import { KANBAN_QUERY_KEYS } from '@/modules/kanban/constants/queryKeys';
import type { Activity, BoardSnapshot, Card, CardComment, RoleListResult } from '@/modules/kanban/types';
import {
  deferred,
  type FakeKanban,
  hookWrapper,
  ok,
  refusal,
  resetHarness,
  signIn,
  stubKanbanFetch,
  testQueryClient,
  type FakeResponse,
} from '../__fixtures__/hookHarness';
import { NOW, makeAction, makeLinkSnapshot } from '../__fixtures__/snapshot';

const BOARD_ID = 'board1';
const CARD = makeAction('c1', 'todo', { title: 'Titre initial' });
const SNAPSHOT = makeLinkSnapshot({ cards: [CARD] });
const BOARD_KEY = KANBAN_QUERY_KEYS.BOARD('u1', BOARD_ID);

/** Instantane a une autre revision, carte `c1` retitree : un `board/get` plus recent. */
function snapshotAt(rev: number, title = CARD.title): BoardSnapshot {
  return { ...SNAPSHOT, board: { ...SNAPSHOT.board, rev }, cards: [{ ...CARD, title }] };
}

/** Carte telle que le JOURNAL la transporte : sans `unseenComments`, propre a chacun. */
function journalCard(overrides: Partial<Card>): Card {
  const { unseenComments: _unseen, ...shared } = { ...CARD, ...overrides };
  return shared;
}

function activity(rev: number, payload: Record<string, unknown>): Activity {
  return {
    _id: `act${rev}`,
    boardId: BOARD_ID,
    cardId: 'c1',
    columnId: 'todo',
    actorId: 'u2',
    verb: 'card.updated',
    payload,
    rev,
    at: NOW,
  };
}

/** Activite d'un role (§12, D30) : ni carte ni colonne, rien a rejouer sur l'instantane. */
function roleActivity(rev: number): Activity {
  return {
    _id: `role${rev}`,
    boardId: BOARD_ID,
    cardId: null,
    columnId: null,
    actorId: 'u2',
    verb: 'role.updated',
    payload: { member: { id: 'u2', type: 'citoyens', roles: ['Communication'] } },
    rev,
    at: NOW,
  };
}

const ROLE_LIST: RoleListResult = {
  roles: [{ name: 'Communication', declared: true, memberIds: [] }],
  members: [],
  canManageRoles: false,
  rev: 12,
};

const COMMENT: CardComment = {
  _id: 'cm1',
  boardId: BOARD_ID,
  cardId: 'c1',
  authorId: 'u2',
  text: 'Je prends',
  created: NOW,
  updated: NOW,
  author: null,
};

let backend: FakeKanban;

beforeEach(() => {
  signIn('u1');
  backend = stubKanbanFetch({
    'board/get': () => ok(SNAPSHOT),
    'board/sync': () => ok({ rev: SNAPSHOT.board.rev, full: false, activities: [] }),
    'comment/list': () => ok({ comments: [], total: 0 }),
  });
});

afterEach(() => {
  // Demontage d'abord, sous les minuteurs simules s'il y en a : l'effet annule
  // son propre minuteur. Les minuteurs reels ensuite, pour le test suivant.
  resetHarness();
  vi.useRealTimers();
});

/** Retour sur l'onglet : la passe IMMEDIATE du polling. */
async function returnToTab(): Promise<void> {
  await act(async () => {
    window.dispatchEvent(new Event('focus'));
  });
}

/** Laisse filer les promesses en attente (reponses, invalidations). */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

/**
 * Minuteurs SIMULES a partir de l'appel : la boucle s'arme par `setTimeout`, et
 * attendre ses 10 s pour de vrai allongerait chaque test d'autant. Seuls
 * `setTimeout` / `clearTimeout` sont simules : `Date` reste reel (fraicheur des
 * queries), et TanStack, qui notifie par `setTimeout(0)`, avance avec l'horloge.
 * A poser APRES les `waitFor`, qui sondent sur des minuteurs reels.
 */
function installFakeClock(): void {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
}

/** Avance l'horloge simulee, promesses comprises (reponses, notifications). */
async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/**
 * Contributeur retire du projet : `board/sync` PUIS `board/get` refusent. La
 * boucle se suspend sur le refus du premier, l'instantane relu passe en erreur.
 */
async function loseAccess(queryClient: QueryClient): Promise<void> {
  backend.on('board/sync', () => refusal(403, 'notMember'));
  backend.on('board/get', () => refusal(403, 'notMember'));
  await returnToTab();
  await waitFor(() => expect(backend.calls('board/sync')).toBe(1));
  // Lu dans le CACHE : le resultat du hook ne se rerend que pour les champs
  // deja lus (proprietes suivies de TanStack), et `error` ne l'etait pas.
  await waitFor(() => expect(queryClient.getQueryState(BOARD_KEY)?.status).toBe('error'));
}

/** Acces rendu : les deux routes repondent de nouveau. */
function restoreAccess(): void {
  backend.on('board/get', () => ok(SNAPSHOT));
  backend.on('board/sync', () => ok({ rev: SNAPSHOT.board.rev, full: false, activities: [] }));
}

function mountBoard(options: { thread?: boolean } = {}) {
  const queryClient = testQueryClient();
  const hook = renderHook(
    () => {
      useBoardSync(BOARD_ID);
      const board = useBoard(BOARD_ID);
      // La fiche ouverte sur `c1` : son fil est MONTE, il se relit des qu'on l'invalide.
      const thread = useCardComments(options.thread ? BOARD_ID : null, options.thread ? 'c1' : null);
      return { board, thread };
    },
    { wrapper: hookWrapper(queryClient) },
  );
  return { queryClient, hook };
}

function cachedCard(queryClient: ReturnType<typeof testQueryClient>): Card | undefined {
  return queryClient.getQueryData<BoardSnapshot>(BOARD_KEY)?.cards.find((card) => card._id === 'c1');
}

test('#72 : un delta parti avant un board/get plus recent n est PAS applique', async () => {
  const { queryClient, hook } = mountBoard();
  await waitFor(() => expect(hook.result.current.board.data?.board.rev).toBe(12));

  // board/sync EN VOL depuis la revision 12…
  const inFlight = deferred<FakeResponse>();
  backend.on('board/sync', () => inFlight.promise);
  await returnToTab();
  expect(backend.calls('board/sync')).toBe(1);

  // … pendant qu'un rechargement apporte la revision 20.
  backend.on('board/get', () => ok(snapshotAt(20, 'Titre recharge')));
  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: BOARD_KEY });
  });
  expect(cachedCard(queryClient)?.title).toBe('Titre recharge');

  // Le delta calcule depuis 12 arrive : il reecrirait le titre recharge.
  inFlight.resolve(ok({ rev: 13, full: false, activities: [activity(13, { card: journalCard({ title: 'Titre perime' }) })] }));
  await settle();

  expect(cachedCard(queryClient)?.title).toBe('Titre recharge');
  expect(queryClient.getQueryData<BoardSnapshot>(BOARD_KEY)?.board.rev).toBe(20);
});

test('#72 : un rechargement demande par une reponse perimee n est pas execute', async () => {
  const { queryClient, hook } = mountBoard();
  await waitFor(() => expect(hook.result.current.board.data?.board.rev).toBe(12));

  const inFlight = deferred<FakeResponse>();
  backend.on('board/sync', () => inFlight.promise);
  await returnToTab();
  backend.on('board/get', () => ok(snapshotAt(20)));
  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: BOARD_KEY });
  });
  expect(backend.calls('board/get')).toBe(2);

  // `full: true` decide depuis 12 : l'instantane est deja a 20, rien a relire.
  inFlight.resolve(ok({ rev: 15, full: true }));
  await settle();
  expect(backend.calls('board/get')).toBe(2);
});

test('#24 : une activite de commentaire rejouee relit le fil MONTE et remet la pastille a 0', async () => {
  const { queryClient, hook } = mountBoard({ thread: true });
  await waitFor(() => expect(backend.calls('comment/list')).toBe(1));
  await waitFor(() => expect(hook.result.current.board.data).toBeDefined());

  backend.on('comment/list', () => ok({ comments: [COMMENT], total: 1 }));
  backend.on('board/sync', () =>
    ok({
      rev: 13,
      full: false,
      activities: [activity(13, { card: journalCard({ commentCount: 1 }), fields: ['commentCount'], comment: COMMENT })],
    }),
  );
  await returnToTab();

  // Le fil ouvert se relit (et le serveur le marque vu) : le message apparait…
  await waitFor(() => expect(backend.calls('comment/list')).toBe(2));
  await waitFor(() => expect(hook.result.current.thread.comments.map((comment) => comment._id)).toEqual(['cm1']));
  // … et la pastille posee par le rejeu (message d'un AUTRE) retombe aussitot.
  await waitFor(() => expect(cachedCard(queryClient)?.unseenComments).toBe(0));
  expect(cachedCard(queryClient)?.commentCount).toBe(1);
});

test('#24 : un rechargement complet relit aussi les fils du tableau (message ecrit dans gestion)', async () => {
  const { hook } = mountBoard({ thread: true });
  await waitFor(() => expect(backend.calls('comment/list')).toBe(1));
  await waitFor(() => expect(hook.result.current.board.data).toBeDefined());

  // Un commentaire ecrit dans Kanban gestion n'a pas de ligne de journal : D17.
  backend.on('board/get', () => ok(snapshotAt(13)));
  backend.on('board/sync', () => ok({ rev: 13, full: true }));
  await returnToTab();

  await waitFor(() => expect(backend.calls('board/get')).toBe(2));
  await waitFor(() => expect(backend.calls('comment/list')).toBe(2));
});

test('#73 : perte d acces = boucle SUSPENDUE ; elle repart quand board/get reussit de nouveau', async () => {
  const { queryClient, hook } = mountBoard();
  await waitFor(() => expect(hook.result.current.board.data).toBeDefined());

  await loseAccess(queryClient);
  // L'instantane est relu, pour que l'ecran d'erreur explique le refus.
  expect(backend.calls('board/get')).toBe(2);

  // Suspendue : les retours d'onglet ne relancent rien…
  await returnToTab();
  await returnToTab();
  await settle();
  expect(backend.calls('board/sync')).toBe(1);
  // … pas meme une ECRITURE locale du cache, qui ne prouve pas l'acces rendu.
  act(() => {
    queryClient.setQueryData<BoardSnapshot>(BOARD_KEY, SNAPSHOT);
  });
  await returnToTab();
  await settle();
  expect(backend.calls('board/sync')).toBe(1);

  // Acces rendu, « Reessayer » : board/get reussit… et la boucle repart.
  restoreAccess();
  await act(async () => {
    await hook.result.current.board.refetch();
  });
  await returnToTab();
  await waitFor(() => expect(backend.calls('board/sync')).toBe(2));
});

test('#73 : relancee par board/get, la boucle repart SEULE, au rythme du minuteur, sans retour d onglet', async () => {
  const { queryClient, hook } = mountBoard();
  await waitFor(() => expect(hook.result.current.board.data).toBeDefined());
  await loseAccess(queryClient);

  // « Reessayer » sur l'ecran d'erreur : board/get reussit. AUCUN evenement
  // d'onglet ensuite — c'est le scenario de la regression : l'utilisateur
  // reste sur la page, et seul le minuteur peut ramener les mises a jour.
  installFakeClock();
  restoreAccess();
  await act(async () => {
    await hook.result.current.board.refetch();
  });
  expect(queryClient.getQueryState(BOARD_KEY)?.status).toBe('success');
  // Pas de passe immediate : la reprise RE-ARME le minuteur, a l'intervalle exact.
  expect(backend.calls('board/sync')).toBe(1);
  await advance(BOARD_SYNC_INTERVAL_MS - 1);
  expect(backend.calls('board/sync')).toBe(1);
  await advance(1);
  expect(backend.calls('board/sync')).toBe(2);

  // Et la boucle continue : la passe terminee (`advance(0)` laisse filer sa
  // reponse), le minuteur suivant part de la.
  await advance(0);
  await advance(BOARD_SYNC_INTERVAL_MS);
  expect(backend.calls('board/sync')).toBe(3);
});

test('#73 : une AUTRE query reussie pendant la suspension ne relance pas la boucle', async () => {
  backend.on('role/list', () => ok(ROLE_LIST));
  const queryClient = testQueryClient();
  const hook = renderHook(
    () => {
      useBoardSync(BOARD_ID);
      // La liste des roles se relit sans encombre quand l'acces au TABLEAU
      // est perdu : sa reussite ne prouve rien pour lui.
      return { board: useBoard(BOARD_ID), boards: useRoles(BOARD_ID) };
    },
    { wrapper: hookWrapper(queryClient) },
  );
  await waitFor(() => expect(hook.result.current.board.data).toBeDefined());
  await waitFor(() => expect(hook.result.current.boards.data).toBeDefined());
  await loseAccess(queryClient);

  installFakeClock();
  await act(async () => {
    await hook.result.current.boards.refetch();
  });
  expect(backend.calls('role/list')).toBe(2);
  expect(queryClient.getQueryState(BOARD_KEY)?.status).toBe('error');

  // Toujours suspendue : ni le minuteur…
  await advance(BOARD_SYNC_INTERVAL_MS);
  expect(backend.calls('board/sync')).toBe(1);
  // … ni un retour d'onglet ne relancent rien.
  await returnToTab();
  await advance(0);
  expect(backend.calls('board/sync')).toBe(1);
});

/* -------------------------------------------------------------------------- */
/*  §12, D30 : les roles se relisent sur `role.updated` et sur un `full`       */
/* -------------------------------------------------------------------------- */

function mountWithRoles() {
  backend.on('role/list', () => ok(ROLE_LIST));
  const queryClient = testQueryClient();
  const hook = renderHook(
    () => {
      useBoardSync(BOARD_ID);
      // La vue Roles est ouverte : sa liste est MONTEE, elle se relit des qu'on l'invalide.
      return { board: useBoard(BOARD_ID), roles: useRoles(BOARD_ID) };
    },
    { wrapper: hookWrapper(queryClient) },
  );
  return { queryClient, hook };
}

test('§12 : une activite role.updated relit la liste des roles SANS recharger l instantane', async () => {
  const { queryClient, hook } = mountWithRoles();
  await waitFor(() => expect(hook.result.current.board.data).toBeDefined());
  await waitFor(() => expect(hook.result.current.roles.data).toBeDefined());
  expect(backend.calls('role/list')).toBe(1);

  backend.on('board/sync', () => ok({ rev: 13, full: false, activities: [roleActivity(13)] }));
  await returnToTab();

  await waitFor(() => expect(backend.calls('role/list')).toBe(2));
  // Pas de rechargement complet : un role ne change aucune carte, la revision avance seule.
  expect(backend.calls('board/get')).toBe(1);
  await waitFor(() => expect(queryClient.getQueryData<BoardSnapshot>(BOARD_KEY)?.board.rev).toBe(13));
});

test('§12 : un rechargement complet (role ecrit dans Communecter, empreinte) relit aussi les roles', async () => {
  const { hook } = mountWithRoles();
  await waitFor(() => expect(hook.result.current.board.data).toBeDefined());
  await waitFor(() => expect(hook.result.current.roles.data).toBeDefined());

  backend.on('board/get', () => ok(snapshotAt(13)));
  backend.on('board/sync', () => ok({ rev: 13, full: true }));
  await returnToTab();

  await waitFor(() => expect(backend.calls('board/get')).toBe(2));
  await waitFor(() => expect(backend.calls('role/list')).toBe(2));
});

test('§12 : le polling ne relit PAS ma propre ecriture de role (revision deja portee par la liste), mais relit celle d un autre client', async () => {
  // La liste servie porte la revision du tableau au moment de sa lecture : 12,
  // puis celle de ma reponse d'ecriture.
  let servedRev = ROLE_LIST.rev;
  backend.on('role/list', () => ok({ ...ROLE_LIST, rev: servedRev }));
  backend.on('role/assign', () => {
    servedRev = 13;
    return ok({ member: { id: 'u2', type: 'citoyens', roles: ['Communication'] }, changed: true, rev: 13 });
  });
  const queryClient = testQueryClient();
  const hook = renderHook(
    () => {
      useBoardSync(BOARD_ID);
      return { board: useBoard(BOARD_ID), roles: useRoles(BOARD_ID), mutations: useRoleMutations(BOARD_ID) };
    },
    { wrapper: hookWrapper(queryClient) },
  );
  await waitFor(() => expect(hook.result.current.board.data).toBeDefined());
  await waitFor(() => expect(hook.result.current.roles.data).toBeDefined());

  // MON ecriture : posee sur la liste (rev 13), puis relue au reglement (2e `role/list`).
  act(() => {
    hook.result.current.mutations.assign.mutate({ memberId: 'u2', memberType: 'citoyens', role: 'Communication' });
  });
  await waitFor(() => expect(hook.result.current.mutations.assign.isSuccess).toBe(true));
  await waitFor(() => expect(backend.calls('role/list')).toBe(2));
  await waitFor(() => expect(queryClient.getQueryData<RoleListResult>(KANBAN_QUERY_KEYS.ROLES('u1', BOARD_ID))?.rev).toBe(13));

  // Le polling rapporte cette meme ecriture (rev 13) : l'instantane avance, la liste n'est PAS relue.
  backend.on('board/sync', () => ok({ rev: 13, full: false, activities: [{ ...roleActivity(13), actorId: 'u1' }] }));
  await returnToTab();
  await waitFor(() => expect(queryClient.getQueryData<BoardSnapshot>(BOARD_KEY)?.board.rev).toBe(13));
  await settle();
  expect(backend.calls('role/list')).toBe(2);

  // Un AUTRE client ecrit un role (rev 14) : au-dela de la liste, elle se relit.
  backend.on('board/sync', () => ok({ rev: 14, full: false, activities: [roleActivity(14)] }));
  await returnToTab();
  await waitFor(() => expect(backend.calls('role/list')).toBe(3));
});

test('un delta SANS role.updated ne relit pas les roles', async () => {
  const { hook } = mountWithRoles();
  await waitFor(() => expect(hook.result.current.board.data).toBeDefined());
  await waitFor(() => expect(hook.result.current.roles.data).toBeDefined());

  backend.on('board/sync', () => ok({ rev: 13, full: false, activities: [activity(13, { card: journalCard({ title: 'Retitree' }) })] }));
  await returnToTab();
  await waitFor(() => expect(cachedCardTitle()).toBe('Retitree'));
  await settle();
  expect(backend.calls('role/list')).toBe(1);

  function cachedCardTitle(): string | undefined {
    return hook.result.current.board.data?.cards.find((card) => card._id === 'c1')?.title;
  }
});
