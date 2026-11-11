// @vitest-environment jsdom
/**
 * CABLAGE du kanban des roles (`useRoles`, `useRoleMutations`, §12 D27-D30),
 * monte sur un vrai cache avec un backend simule.
 *
 * La logique de liste est pure et testee ailleurs (`lib/roles.ts`) ; ce
 * fichier verrouille ce que les hooks en font :
 *  - la liste passe la garde et vit dans SA cle (`ROLES`), dimensionnee par
 *    utilisateur ;
 *  - une attribution se voit AVANT la reponse (optimiste), puis la liste est
 *    RELUE au reglement — la liste servie fait autorite ;
 *  - un refus repose la photo d'avant, relit la liste et notifie la RAISON
 *    (404 `notLinked` : « ne fait plus partie… »), jamais « une erreur » ;
 *  - deux depots RAPIDES : le `scope` ne serialise que les appels reseau, pas
 *    les `onMutate` — le rollback est a TEMOIN et la photo reposee est celle
 *    d'avant la CHAINE, sans quoi le refus du second ressuscitait le role que
 *    le premier venait de voir refuser ;
 *  - chaque succes pose la revision de sa reponse sur la liste, pour que le
 *    polling ne relise pas une ecriture qu'elle porte deja.
 */
import { act, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { useRoleMutations, useRoles } from '@/modules/kanban/hooks/useRoles';
import { KANBAN_QUERY_KEYS } from '@/modules/kanban/constants/queryKeys';
import type { RoleListResult } from '@/modules/kanban/types';
import { deferred, type FakeKanban, hookWrapper, ok, refusal, resetHarness, signIn, stubKanbanFetch, testQueryClient, type FakeResponse } from '../__fixtures__/hookHarness';

const BOARD_ID = 'board1';
const ROLES_KEY = KANBAN_QUERY_KEYS.ROLES('u1', BOARD_ID);

const LIST: RoleListResult = {
  roles: [
    { name: 'Coordination', declared: true, memberIds: ['u1'] },
    { name: 'Communication', declared: true, memberIds: [] },
  ],
  members: [
    { id: 'u1', type: 'citoyens', name: 'Camille', slug: 'camille', image: null, isAdmin: true, pending: false, roles: ['Coordination'] },
    { id: 'u2', type: 'citoyens', name: 'Tom', slug: 'tom', image: null, isAdmin: false, pending: false, roles: [] },
  ],
  canManageRoles: true,
  rev: 4,
};

let backend: FakeKanban;

beforeEach(() => {
  signIn('u1');
  backend = stubKanbanFetch({
    'role/list': () => ok(LIST),
    'role/assign': () => ok({ member: { id: 'u2', type: 'citoyens', roles: ['Communication'] }, changed: true, rev: 5 }),
    'role/unassign': () => ok({ member: { id: 'u1', type: 'citoyens', roles: [] }, changed: true, rev: 5 }),
    'role/create': () => ok({ role: 'Accueil', created: true, rev: 5 }),
    'role/delete': () => ok({ role: 'Communication', removedFrom: 0, rev: 5 }),
  });
});

afterEach(resetHarness);

function mount() {
  const queryClient = testQueryClient();
  const hook = renderHook(() => ({ roles: useRoles(BOARD_ID), mutations: useRoleMutations(BOARD_ID) }), {
    wrapper: hookWrapper(queryClient),
  });
  const cached = () => queryClient.getQueryData<RoleListResult>(ROLES_KEY);
  const rolesOf = (memberId: string) => cached()?.members.find((member) => member.id === memberId)?.roles;
  return { queryClient, hook, cached, rolesOf };
}

test('la liste passe la garde et vit dans la cle ROLES de l utilisateur', async () => {
  const { hook, cached } = mount();
  await waitFor(() => expect(hook.result.current.roles.data).toEqual(LIST));
  expect(cached()).toEqual(LIST);
  expect(backend.calls('role/list')).toBe(1);
});

test('attribuer : visible AVANT la reponse, colonne devenue declaree, puis liste relue au reglement', async () => {
  const { hook, cached, rolesOf } = mount();
  await waitFor(() => expect(hook.result.current.roles.data).toBeDefined());

  const inFlight = deferred<FakeResponse>();
  backend.on('role/assign', () => inFlight.promise);
  act(() => {
    hook.result.current.mutations.assign.mutate({ memberId: 'u2', memberType: 'citoyens', role: 'Communication' });
  });
  // Optimiste : le depot se voit, le serveur n'a pas encore repondu.
  await waitFor(() => expect(rolesOf('u2')).toEqual(['Communication']));
  expect(cached()?.roles.find((entry) => entry.name === 'Communication')?.memberIds).toEqual(['u2']);
  expect(backend.calls('role/list')).toBe(1);

  inFlight.resolve(ok({ member: { id: 'u2', type: 'citoyens', roles: ['Communication'] }, changed: true, rev: 5 }));
  // Reglement : la liste servie fait autorite, elle est relue.
  await waitFor(() => expect(backend.calls('role/list')).toBe(2));
  await waitFor(() => expect(hook.result.current.mutations.assign.isSuccess).toBe(true));
});

test('refus 404 notLinked : photo reposee AVANT la relecture, liste relue, raison notifiee', async () => {
  const { hook, cached } = mount();
  await waitFor(() => expect(hook.result.current.roles.data).toBeDefined());
  backend.on('role/assign', () => refusal(404, 'notFound', { reason: 'notLinked', memberId: 'u2', memberType: 'citoyens' }));
  // La relecture qui suit le refus est tenue EN VOL : ce qu'on lit dans le
  // cache entre-temps est le fait du rollback, pas de la liste reservie.
  const relist = deferred<FakeResponse>();
  backend.on('role/list', () => relist.promise);

  act(() => {
    hook.result.current.mutations.assign.mutate({ memberId: 'u2', memberType: 'citoyens', role: 'Communication' });
  });
  await waitFor(() => expect(hook.result.current.mutations.assign.isError).toBe(true));
  // La photo d'avant est reposee : rien n'est reste de l'optimiste…
  await waitFor(() => expect(cached()).toEqual(LIST));
  // … la liste est relue (quelqu'un a pu ecrire entre-temps)…
  await waitFor(() => expect(backend.calls('role/list')).toBe(2));
  relist.resolve(ok(LIST));
  // … et le refus dit SA raison, traduite, pas « une erreur est survenue ».
  expect(await screen.findByText(/ne fait plus partie du projet ou de l'organisation/)).toBeTruthy();
});

test('retirer, creer, supprimer : optimistes puis relus ; un libelle est pose tel quel, trim compris', async () => {
  const { hook, cached, rolesOf } = mount();
  await waitFor(() => expect(hook.result.current.roles.data).toBeDefined());

  const unassign = deferred<FakeResponse>();
  backend.on('role/unassign', () => unassign.promise);
  act(() => {
    hook.result.current.mutations.unassign.mutate({ memberId: 'u1', memberType: 'citoyens', role: 'Coordination' });
  });
  await waitFor(() => expect(rolesOf('u1')).toEqual([]));
  // Declaree : la colonne survit, vide.
  expect(cached()?.roles.find((entry) => entry.name === 'Coordination')).toEqual({ name: 'Coordination', declared: true, memberIds: [] });
  unassign.resolve(ok({ member: { id: 'u1', type: 'citoyens', roles: [] }, changed: true, rev: 5 }));
  await waitFor(() => expect(hook.result.current.mutations.unassign.isSuccess).toBe(true));

  const create = deferred<FakeResponse>();
  backend.on('role/create', () => create.promise);
  act(() => {
    hook.result.current.mutations.create.mutate({ role: ' Accueil ' });
  });
  await waitFor(() => expect(cached()?.roles.map((entry) => entry.name)).toContain('Accueil'));
  create.resolve(ok({ role: 'Accueil', created: true, rev: 6 }));
  await waitFor(() => expect(hook.result.current.mutations.create.isSuccess).toBe(true));

  const remove = deferred<FakeResponse>();
  backend.on('role/delete', () => remove.promise);
  act(() => {
    hook.result.current.mutations.remove.mutate({ role: 'Communication' });
  });
  await waitFor(() => expect(cached()?.roles.some((entry) => entry.name === 'Communication')).toBe(false));
  remove.resolve(ok({ role: 'Communication', removedFrom: 0, rev: 7 }));
  await waitFor(() => expect(hook.result.current.mutations.remove.isSuccess).toBe(true));
  // Chaque reglement a relu la liste.
  await waitFor(() => expect(backend.calls('role/list')).toBe(4));
});

test('chaque succes pose la revision de sa reponse sur la liste, avant meme la relecture (creer, supprimer compris)', async () => {
  const { hook, cached } = mount();
  await waitFor(() => expect(hook.result.current.roles.data).toBeDefined());
  // Relecture tenue en vol : la revision lue vient du succes, pas de la liste reservie.
  const gate = deferred<void>();
  backend.on('role/list', async () => {
    await gate.promise;
    return ok(LIST);
  });

  backend.on('role/create', () => ok({ role: 'Accueil', created: true, rev: 7 }));
  act(() => {
    hook.result.current.mutations.create.mutate({ role: 'Accueil' });
  });
  await waitFor(() => expect(hook.result.current.mutations.create.isSuccess).toBe(true));
  expect(cached()?.rev).toBe(7);

  backend.on('role/delete', () => ok({ role: 'Accueil', removedFrom: 0, rev: 8 }));
  act(() => {
    hook.result.current.mutations.remove.mutate({ role: 'Accueil' });
  });
  await waitFor(() => expect(hook.result.current.mutations.remove.isSuccess).toBe(true));
  expect(cached()?.rev).toBe(8);
  gate.resolve();
});

/* -------------------------------------------------------------------------- */
/*  Deux depots rapides : le scope ne serialise que les appels reseau          */
/* -------------------------------------------------------------------------- */

/**
 * Tom glisse sur « Communication » puis aussitot sur « Coordination ». Les deux
 * `onMutate` ont ecrit leur optimiste AVANT que le premier appel ne parte (le
 * cache porte les deux roles, un seul `role/assign` est parti) ; la relecture
 * est tenue en vol pour lire ce que le rollback fait du cache.
 */
async function twoQuickAssigns() {
  const { hook, rolesOf } = mount();
  await waitFor(() => expect(hook.result.current.roles.data).toBeDefined());
  const first = deferred<FakeResponse>();
  const second = deferred<FakeResponse>();
  let sent = 0;
  backend.on('role/assign', () => (++sent === 1 ? first.promise : second.promise));
  const gate = deferred<void>();
  let served = LIST;
  backend.on('role/list', async () => {
    await gate.promise;
    return ok(served);
  });
  act(() => {
    hook.result.current.mutations.assign.mutate({ memberId: 'u2', memberType: 'citoyens', role: 'Communication' });
  });
  act(() => {
    hook.result.current.mutations.assign.mutate({ memberId: 'u2', memberType: 'citoyens', role: 'Coordination' });
  });
  await waitFor(() => expect(rolesOf('u2')).toEqual(['Communication', 'Coordination']));
  expect(backend.calls('role/assign')).toBe(1);
  return { first, second, gate, rolesOf, serve: (list: RoleListResult) => void (served = list) };
}

const DENIED = () => refusal(403, 'forbidden', { reason: 'roleManagementNotAllowed' });

test('1er refuse, 2e en vol : l optimiste du 2e SURVIT (aucune photo reposee par-dessus), puis sa reponse fait foi', async () => {
  const { first, second, gate, rolesOf, serve } = await twoQuickAssigns();
  first.resolve(DENIED());
  // Le 2e appel part quand le 1er est regle : le cache n'a pas bouge, la photo
  // du 1er n'a pas ete reposee (une autre ecriture — le 2e depot — etait passee).
  await waitFor(() => expect(backend.calls('role/assign')).toBe(2));
  expect(rolesOf('u2')).toEqual(['Communication', 'Coordination']);
  second.resolve(ok({ member: { id: 'u2', type: 'citoyens', roles: ['Coordination'] }, changed: true, rev: 5 }));
  // La liste COMPLETE du membre servie par le 2e : le role refuse disparait.
  await waitFor(() => expect(rolesOf('u2')).toEqual(['Coordination']));
  serve({ ...LIST, members: LIST.members.map((member) => (member.id === 'u2' ? { ...member, roles: ['Coordination'] } : member)), rev: 5 });
  gate.resolve();
  await waitFor(() => expect(rolesOf('u2')).toEqual(['Coordination']));
});

test('les deux refuses : le role refuse par le 1er ne RESSUSCITE pas — la photo reposee est celle d avant la chaine', async () => {
  const { first, second, gate, rolesOf } = await twoQuickAssigns();
  first.resolve(DENIED());
  await waitFor(() => expect(backend.calls('role/assign')).toBe(2));
  second.resolve(DENIED());
  // Avant toute relecture (toujours tenue en vol) : plus aucun des deux roles.
  // Avec la photo du 2e seul (prise sur la liste deja optimiste du 1er), le
  // cache aurait montre « Communication » jusqu'a la relecture.
  await waitFor(() => expect(rolesOf('u2')).toEqual([]));
  gate.resolve();
  await waitFor(() => expect(rolesOf('u2')).toEqual([]));
});
