// @vitest-environment jsdom
/**
 * Écran `/kanban` : les tuiles du registre, et l'état d'accès que tranche `board/create`.
 *
 * Verrouille ce que la RFC promet (§1.1) : rien de décidé avant hydratation (parité SSR), une
 * invitation pour l'anonyme, « réservé aux membres » sur un 403, des tuiles inertes quand le
 * serveur refuse, le flux du tableau et l'aperçu des rôles quand l'accès est ouvert, et un site
 * sans organisation ni projet porteur sans tuile du tout.
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, test } from 'vitest';
import { CocolightContext, type CocolightContextType } from '@/contexts/CocolightContext';
import { LocalizationProvider } from '@/contexts/LocalizationProvider';
import { SiteContext } from '@/contexts/SiteContext';
import type { SiteConfig } from '@/types/site-schema';
import { FakeSdk, ok, refusal, sdkError, type RouteHandler } from '@/modules/kanban/__fixtures__/fakeSdk';
import { testQueryClient } from '@/modules/kanban/__fixtures__/hookHarness';
import { makeBoard, makeColumn } from '@/modules/kanban/__fixtures__/snapshot';
import { KanbanSessionContext } from '@/modules/kanban/hooks/useKanbanSession';
import { createSdkKanbanClient } from '@/modules/kanban/transport/sdkKanbanClient';
import '@/modules/kanban/i18n';
import { KanbanHome } from './KanbanHome';

afterEach(() => cleanup());

const CREATED = {
  board: makeBoard({ source: 'communecter', parentType: 'projects', parentId: 'p1', counts: { columns: 3, cards: 7, done: 2 } }),
  columns: [
    makeColumn('todo', 1000, { cardCount: 4, titleKey: 'todo' }),
    makeColumn('totest', 2000, { cardCount: 0, titleKey: 'totest' }),
    makeColumn('tracking', 3000, { cardCount: 1, titleKey: 'tracking' }),
    makeColumn('done', 4000, { cardCount: 2, titleKey: 'done', isDoneColumn: true }),
  ],
  capabilities: {},
  created: false,
};

function member(id: string, name: string, roles: string[]) {
  return { id, type: 'citoyens', name, slug: id, image: null, isAdmin: false, pending: false, roles };
}

const ROLES = {
  roles: [
    { name: 'Présidence', declared: true, memberIds: ['m2'] },
    { name: 'Trésorerie', declared: true, memberIds: [] },
  ],
  members: [member('m1', 'Camille', []), member('m2', 'Tom', ['Présidence']), member('m3', 'Noah', [])],
  canManageRoles: true,
  rev: 1,
};

interface Setup {
  hydrated?: boolean;
  userId?: string | null;
  contextType?: string;
  config?: Record<string, unknown>;
  createBoard?: RouteHandler;
  listRoles?: RouteHandler;
}

function renderHome({ hydrated = true, userId = 'u1', contextType = 'projects', config = {}, createBoard = () => ok(CREATED), listRoles = () => ok(ROLES) }: Setup = {}) {
  const sdk = new FakeSdk({ 'board/create': createBoard, 'role/list': listRoles });
  const cocolight = {
    contextType,
    contextId: 'p1',
    entity: { serverData: { name: 'Jardin partagé' } },
  } as unknown as CocolightContextType;
  const site = { config: { kanban: config } as unknown as SiteConfig, setConfig: () => undefined };
  const session = { hydrated, userId: hydrated ? userId : null, profile: null, client: createSdkKanbanClient(() => sdk) };
  const wrap = (children: ReactNode) => (
    <QueryClientProvider client={testQueryClient()}>
      <SiteContext.Provider value={site}>
        <CocolightContext.Provider value={cocolight}>
          <KanbanSessionContext.Provider value={session}>
            <LocalizationProvider>
              <MemoryRouter>{children}</MemoryRouter>
            </LocalizationProvider>
          </KanbanSessionContext.Provider>
        </CocolightContext.Provider>
      </SiteContext.Provider>
    </QueryClientProvider>
  );
  render(wrap(<KanbanHome />));
  return sdk;
}

describe('écran /kanban', () => {
  test('avant hydratation : les tuiles du registre, aucun état d accès, aucun appel', () => {
    const sdk = renderHome({ hydrated: false });
    expect(screen.getByRole('heading', { level: 1, name: 'Kanbans' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Actions/ }).getAttribute('href')).toBe('/kanban/actions');
    expect(screen.getByRole('link', { name: /Rôles/ }).getAttribute('href')).toBe('/kanban/roles');
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText(/Connectez-vous/)).toBeNull();
    expect(sdk.calls).toHaveLength(0);
  });

  test('anonyme : invitation à se connecter, nommant l élément ; aucun appel', () => {
    const sdk = renderHome({ userId: null });
    expect(screen.getByText('Connectez-vous pour ouvrir les kanbans de Jardin partagé.')).toBeTruthy();
    expect(sdk.calls).toHaveLength(0);
  });

  test('membre : board/create sur le porteur, puis le flux du tableau des actions', async () => {
    const sdk = renderHome();
    expect(await screen.findByText('5 ouvertes')).toBeTruthy();
    expect(screen.getByText('2 terminées sur 7')).toBeTruthy();
    // La légende nomme les colonnes ouvertes NON VIDES, dans l'ordre du tableau ; « Terminé » a
    // son propre chiffre, « À tester » (vide) n'y figure pas.
    const legend = screen.getByRole('list', { name: 'Actions ouvertes par colonne' });
    expect(within(legend).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['À faire 4', 'En cours 1']);
    expect(sdk.calls[0]).toMatchObject({ route: 'board/create', body: { source: 'communecter', parentType: 'projects', parentId: 'p1' } });
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  test('membre : role/list sur le tableau, puis l aperçu des rôles', async () => {
    const sdk = renderHome();
    expect(await screen.findByText('2 rôles')).toBeTruthy();
    expect(screen.getByText('3 membres')).toBeTruthy();
    expect(screen.getByText('1 rôle sans titulaire')).toBeTruthy();
    expect(sdk.calls.find((call) => call.route === 'role/list')?.body).toMatchObject({ boardId: CREATED.board._id });
  });

  test('tableau vide : le dit, sans légende', async () => {
    renderHome({ createBoard: () => ok({ ...CREATED, board: { ...CREATED.board, counts: { columns: 4, cards: 0, done: 0 } }, columns: CREATED.columns.map((column) => ({ ...column, cardCount: 0 })) }) });
    expect(await screen.findByText('Aucune action pour le moment')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Actions ouvertes par colonne' })).toBeNull();
  });

  test('échec de role/list : la tuile des rôles reste un lien, sans chiffres ni squelette', async () => {
    const sdk = renderHome({ listRoles: () => refusal(403, 'forbidden') });
    const rolesTile = screen.getByRole('link', { name: /Rôles/ });
    expect(await screen.findByText('5 ouvertes')).toBeTruthy();
    await waitFor(() => expect(sdk.count('role/list')).toBe(1));
    await waitFor(() => expect(rolesTile.querySelector('[data-slot="skeleton"]')).toBeNull());
    expect(within(rolesTile).queryByText(/membres?$/)).toBeNull();
  });

  test('non-membre (403) : réservé aux membres, tuiles inertes', async () => {
    renderHome({ createBoard: () => refusal(403, 'notMember', { parentType: 'projects', parentId: 'p1' }) });
    expect(await screen.findByText('Réservé aux membres')).toBeTruthy();
    expect(screen.getByText(/Les kanbans de Jardin partagé sont ouverts/)).toBeTruthy();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  test('panne réseau : une nouvelle tentative, puis message de la classe d échec et « Réessayer »', async () => {
    const sdk = renderHome({
      createBoard: () => {
        throw sdkError(500, null, "Erreur lors de l'appel de l'API : Network Error");
      },
    });
    // `shouldRetryKanbanQuery` réessaie UNE fois un échec passager (délai de TanStack : 1 s).
    expect(await screen.findByRole('alert', undefined, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Réessayer/ })).toBeTruthy();
    expect(sdk.count('board/create')).toBe(2);
  });

  test('porteur ni organisation ni projet : pas de kanban, pas de tuile, aucun appel', async () => {
    const sdk = renderHome({ contextType: 'events' });
    expect(await screen.findByText('Pas de kanban sur ce site')).toBeTruthy();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    await waitFor(() => expect(sdk.calls).toHaveLength(0));
  });

  test('`boards` de la config restreint les tuiles', () => {
    renderHome({ hydrated: false, config: { boards: ['roles'] } });
    expect(screen.queryByRole('link', { name: /Actions/ })).toBeNull();
    expect(screen.getByRole('link', { name: /Rôles/ })).toBeTruthy();
  });
});
