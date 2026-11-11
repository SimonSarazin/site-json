// @vitest-environment jsdom
/**
 * La vue « Rôles » MONTEE (§12.4, D27-D31), reprise de co-kanban (`tests/unit/rolesView.test.tsx`) : ce que les helpers purs ne voient
 * pas — le branchement des colonnes sur `role/list`, des gestes sur `role/*`,
 * la lecture seule, la recherche dans toutes les colonnes, la boite « Rôles… »
 * (l'alternative clavier), la confirmation d'un retrait et d'une suppression,
 * le composeur et ses refus, le glisser rejoue comme dnd-kit le ferait, et le
 * focus rendu quand une carte ou une colonne disparait.
 *
 * jsdom n'a pas de mise en page : dnd-kit n'y trouve aucune cible. Le glisser
 * est donc rejoue par les gestionnaires passes a `DndContext`
 * (`onDragStart` / `onDragOver` / `onDragEnd`) et par ses annonces, releves au
 * passage par un relais — le vrai contexte reste rendu (cf. kanbanBoardDrag).
 */
import type * as DndKit from '@dnd-kit/core';
import type { Active, DndContextProps, DragStartEvent, Over } from '@dnd-kit/core';
import { createRef, type ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { hiddenColumnsStorageKey } from '@/modules/kanban/components/board/hiddenColumns';
import { memberMenuIn, roleColumnElementIn, roleColumnMenuIn } from '@/modules/kanban/components/roles/rolesFocus';
import { assignRoleLocally, createRoleLocally, deleteRoleLocally, unassignRoleLocally } from '@/modules/kanban/lib/roles';
import type { RoleListResult, RoleMember, RoleMemberType } from '@/modules/kanban/types';
import {
  deferred,
  type FakeKanban,
  type FakeResponse,
  hookWrapper,
  ok,
  refusal,
  resetHarness,
  signIn,
  stubKanbanFetch,
  testQueryClient,
} from '@/modules/kanban/__fixtures__/hookHarness';
import { installRadixDom, openMenu } from '@/modules/kanban/__fixtures__/radixDom';
import { RolesView } from './RolesView';

/** Props du `DndContext`, relevees a chaque rendu du tableau. */
interface Relay {
  props: DndContextProps | null;
  /** Glissers que dnd-kit a lui-meme DEMARRES (capteurs), hors des rejeux du relais. */
  started: number;
}
const relay = vi.hoisted((): Relay => ({ props: null, started: 0 }));

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof DndKit>();
  const { createElement } = await import('react');
  function RelayedDndContext(props: DndContextProps) {
    relay.props = props;
    return createElement(actual.DndContext, {
      ...props,
      onDragStart: (event: DragStartEvent) => {
        relay.started += 1;
        props.onDragStart?.(event);
      },
    });
  }
  /*
   * L'apercu : le vrai `DragOverlay` ne rend ses enfants que pendant un glisser
   * que dnd-kit a lui-meme demarre, ce que jsdom ne permet pas de mener jusqu'a
   * une cible. Un passe-plat les rend des que la vue les fournit : on lit ainsi
   * ce que l'apercu DIT (« Attribuer », « Déjà ce rôle »).
   */
  function RelayedDragOverlay({ children }: { children?: ReactNode }) {
    return createElement('div', { 'data-testid': 'drag-overlay' }, children);
  }
  return { ...actual, DndContext: RelayedDndContext, DragOverlay: RelayedDragOverlay };
});

/** Etat coche d'une case native, sans jest-dom. */
function isChecked(element: HTMLElement): boolean {
  if (!(element instanceof HTMLInputElement)) throw new Error('pas une case a cocher');
  return element.checked;
}

function dnd(): DndContextProps {
  if (relay.props === null) throw new Error('DndContext non rendu');
  return relay.props;
}

function announcements() {
  const value = dnd().accessibility?.announcements;
  if (value === undefined) throw new Error('la vue ne passe pas ses annonces a dnd-kit');
  return value;
}

function member(id: string, name: string, roles: string[], overrides: Partial<RoleMember> = {}): RoleMember {
  return { id, type: 'citoyens', name, slug: id, image: null, isAdmin: false, pending: false, roles, ...overrides };
}

const LIST: RoleListResult = {
  roles: [
    { name: 'Coordination', declared: true, memberIds: ['u1', 'u3'] },
    { name: 'Trésorerie', declared: true, memberIds: [] },
    { name: 'Dev', declared: false, memberIds: ['u2'] },
  ],
  members: [
    member('u1', 'Camille', ['Coordination'], { isAdmin: true, image: '/upload/communecter/citoyens/u1/thumb.png' }),
    member('u2', 'Tom', ['Dev']),
    member('u3', 'Noah', ['Coordination'], { pending: true }),
    member('o1', 'Les Jardins du Port', [], { type: 'organizations' }),
  ],
  canManageRoles: true,
  rev: 3,
};

/** Membre tenu, tel que dnd-kit le transmettrait. */
function held(memberId: string, memberType: 'citoyens' | 'organizations' = 'citoyens'): Active {
  const rect = { top: 0, left: 0, width: 280, height: 60, bottom: 60, right: 280 };
  return {
    id: `member:${memberType}:${memberId}`,
    data: { current: { type: 'member', memberId, memberType } },
    rect: { current: { initial: rect, translated: rect } },
  };
}

/** Colonne de role survolee. */
function overRole(role: string): Over {
  return { id: `role:${role}`, rect: { top: 0, left: 300, width: 288, height: 400, bottom: 400, right: 588 }, disabled: false, data: { current: { type: 'role', role } } };
}

function gesture(active: Active, over: Over | null) {
  return { activatorEvent: new MouseEvent('mousedown'), active, over, collisions: null, delta: { x: 0, y: 0 } };
}

let backend: FakeKanban;
let bodies: Record<string, unknown[]>;
/*
 * Backend simule AVEC ETAT : chaque ecriture est appliquee a la liste servie
 * (par les memes fonctions pures que le cache optimiste), car le reglement
 * d'une mutation RELIT `role/list` — une liste figee ecraserait aussitot
 * l'etat optimiste que le test vient de verifier.
 */
let served: RoleListResult;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function field(body: unknown, name: string): string {
  if (!isRecord(body) || typeof body[name] !== 'string') throw new Error(`corps sans ${name}`);
  return body[name];
}

/** `memberType` du corps, garde plutot que cast : l'identite d'un membre est la paire id + type (D28). */
function memberTypeOf(value: string): RoleMemberType {
  if (value !== 'citoyens' && value !== 'organizations') throw new Error(`memberType inconnu : ${value}`);
  return value;
}

function recording(route: string, respond: (body: unknown) => FakeResponse) {
  return (body: unknown) => {
    (bodies[route] ??= []).push(body);
    return respond(body);
  };
}

beforeEach(() => {
  signIn('u1');
  bodies = {};
  served = LIST;
  backend = stubKanbanFetch({
    'role/list': () => ok(served),
    'role/assign': recording('role/assign', (body) => {
      served = assignRoleLocally(served, { id: field(body, 'memberId'), type: memberTypeOf(field(body, 'memberType')) }, field(body, 'role'));
      const roles = served.members.find((entry) => entry.id === field(body, 'memberId'))?.roles ?? [];
      return ok({ member: { id: field(body, 'memberId'), type: field(body, 'memberType'), roles }, changed: true, rev: 4 });
    }),
    'role/unassign': recording('role/unassign', (body) => {
      served = unassignRoleLocally(served, { id: field(body, 'memberId'), type: memberTypeOf(field(body, 'memberType')) }, field(body, 'role'));
      const roles = served.members.find((entry) => entry.id === field(body, 'memberId'))?.roles ?? [];
      return ok({ member: { id: field(body, 'memberId'), type: field(body, 'memberType'), roles }, changed: true, rev: 4 });
    }),
    'role/create': recording('role/create', (body) => {
      served = createRoleLocally(served, field(body, 'role'));
      return ok({ role: field(body, 'role'), created: true, rev: 4 });
    }),
    'role/delete': recording('role/delete', (body) => {
      served = deleteRoleLocally(served, field(body, 'role'));
      return ok({ role: field(body, 'role'), removedFrom: 0, rev: 4 });
    }),
  });
});

afterEach(() => {
  cleanup();
  resetHarness();
  relay.props = null;
  relay.started = 0;
});

beforeAll(() => installRadixDom());

/**
 * La vue telle que la page la monte : sous la session du module (faux pont SDK), avec le
 * titre de la page qu'elle reprend comme repli de focus. Ses preferences de colonnes, elle les
 * porte elle-meme (`BoardPrefsProvider`, portee `roles`).
 */
function tree() {
  const titleRef = createRef<HTMLHeadingElement>();
  const Wrapper = hookWrapper(testQueryClient());
  return (
    <Wrapper>
      <h1 ref={titleRef} tabIndex={-1}>
        Rôles
      </h1>
      <RolesView boardId="board1" titleRef={titleRef} />
    </Wrapper>
  );
}

async function mount() {
  const view = render(tree());
  await screen.findByRole('heading', { level: 3, name: 'Membres' });
  return view;
}

/** La region vivante de la vue (ou une autre) a-t-elle dit ce texte ? */
const said = (text: string) => screen.getAllByRole('status').some((region) => region.textContent?.startsWith(text));
/*
 * `hidden: true` : une boite du site (`Dialog` Radix) est MODALE et masque le reste de la page
 * aux technologies d'assistance pendant qu'elle est ouverte ; les colonnes s'y lisent quand meme.
 */
const headings = () => screen.getAllByRole('heading', { level: 3, hidden: true }).map((heading) => heading.textContent);

const list = (name: string | RegExp) => screen.getByRole('list', { name, hidden: true });
const overlay = () => screen.getByTestId('drag-overlay');
const namesIn = (listName: string | RegExp) =>
  within(list(listName))
    .queryAllByRole('article', { hidden: true })
    .map((article) => document.getElementById(article.getAttribute('aria-labelledby') ?? '')?.textContent ?? '');

describe('rendu', () => {
  test('en-tete, colonnes dans l ordre du serveur, capsules, badges en toutes lettres, portrait resolu', async () => {
    await mount();
    expect(screen.getByText(/4 membres, 3 rôles\./)).toBeTruthy();
    expect(screen.getByText(/Glissez un membre vers un rôle/)).toBeTruthy();

    const headings = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
    expect(headings).toEqual(['Membres', 'Coordination', 'Trésorerie', 'Dev']);
    expect(namesIn('Tous les membres')).toEqual(['Camille', 'Tom', 'Noah', 'Les Jardins du Port']);
    expect(namesIn('Membres ayant le rôle Coordination')).toEqual(['Camille', 'Noah']);
    // Colonne declaree sans porteur : visible, et elle dit ou deposer.
    expect(within(list('Membres ayant le rôle Trésorerie')).getByText('Déposez un membre ici pour lui attribuer ce rôle.')).toBeTruthy();
    expect(screen.getByText('4 membres')).toBeTruthy();
    expect(screen.getByText('0 membre')).toBeTruthy();

    const members = list('Tous les membres');
    expect(within(members).getAllByText('Admin')).toHaveLength(1);
    expect(within(members).getByText('En attente')).toBeTruthy();
    expect(within(members).getByText('Organisation')).toBeTruthy();
    // La ligne des roles portes : c'est elle qui change quand un depot reussit.
    expect(within(members).getAllByText('Coordination')).toHaveLength(2);
    expect(within(members).getByText('Dev')).toBeTruthy();
    // Portrait DECORATIF : le nom est ecrit a cote. L'`Avatar` du site (Radix) ne rend la photo
    // qu'une fois chargee, ce que jsdom ne fait jamais : on lit les initiales de repli.
    const portrait = members.querySelector('[data-slot="avatar"]');
    expect(portrait?.getAttribute('aria-hidden')).toBe('true');
    expect(portrait?.textContent).toBe('C');

    expect(screen.getByRole('button', { name: 'Ajouter un rôle' })).toBeTruthy();
    // Aucune instruction dnd-kit : les cartes ne posent pas d'`aria-describedby`,
    // un texte que personne n'entend serait une cle morte (constat ui n°2).
    expect(dnd().accessibility?.screenReaderInstructions).toBeUndefined();
  });

  test('lecture seule : la note, ni menu de carte, ni retraits, ni composeur, ni suppression — mais le masquage local reste ; la rangee est focalisable ; aucune prise au pointeur et un lacher relaye n ecrit rien', async () => {
    backend.on('role/list', () => ok({ ...LIST, canManageRoles: false }));
    await mount();
    expect(screen.getByText('Seuls les administrateurs peuvent modifier les rôles.')).toBeTruthy();
    expect(screen.queryByText(/Glissez un membre/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Actions sur/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Retirer le rôle/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ajouter un rôle' })).toBeNull();
    // Masquer une colonne est une preference de POSTE (D34), pas une ecriture :
    // le menu de la colonne reste, sans « Supprimer ce rôle ».
    openMenu(screen.getByRole('button', { name: 'Actions du rôle Trésorerie' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getAllByRole('menuitem').map((entry) => entry.textContent)).toEqual(['Masquer la colonne']);
    fireEvent.keyDown(menu, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(within(list('Membres ayant le rôle Trésorerie')).getByText('Personne n’a ce rôle.')).toBeTruthy();

    // Sans commande dans les colonnes, la rangee est le seul arret clavier qui
    // permette de la faire defiler (WCAG 2.1.1) : nommee et focalisable.
    expect(list('Colonnes du kanban des rôles').getAttribute('tabindex')).toBe('0');

    // Aucune prise : ni poignee, ni curseur de saisie, et un appui-glisser au
    // pointeur ne demarre rien (cf. le temoin admin dans « glisser »).
    const cards = within(list('Tous les membres')).getAllByRole('article');
    for (const article of cards) {
      expect(article.querySelector('svg.lucide-grip-vertical')).toBeNull();
      expect(article.className).not.toMatch(/cursor-grab/);
    }
    fireEvent.pointerDown(cards[1], { clientX: 10, clientY: 10, button: 0 });
    fireEvent.mouseDown(cards[1], { clientX: 10, clientY: 10, button: 0 });
    fireEvent.mouseMove(document, { clientX: 80, clientY: 60 });
    fireEvent.mouseUp(document, { clientX: 80, clientY: 60 });
    await act(async () => undefined);
    expect(relay.started).toBe(0);
    expect(overlay().textContent).toBe('');

    // Garde en profondeur : un lacher qui arriverait quand meme (relais, hors
    // capteurs) est traite comme une annulation — rien ne part, rien ne reste souleve.
    const active = held('u2');
    act(() => dnd().onDragStart?.({ activatorEvent: new MouseEvent('mousedown'), active }));
    act(() => dnd().onDragEnd?.(gesture(active, overRole('Coordination'))));
    await act(async () => undefined);
    expect(bodies['role/assign']).toBeUndefined();
    expect(overlay().textContent).toBe('');
    expect(namesIn('Membres ayant le rôle Coordination')).toEqual(['Camille', 'Noah']);
  });

  test('echec de chargement : bandeau et « Réessayer » qui relit la liste', async () => {
    backend.on('role/list', () => refusal(500, 'serverError'));
    render(tree());
    // `shouldRetryKanbanQuery` reessaie UNE fois une panne serveur (delai de TanStack : 1 s).
    const alert = await screen.findByRole('alert', undefined, { timeout: 3000 });
    backend.on('role/list', () => ok(LIST));
    fireEvent.click(within(alert).getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('heading', { level: 3, name: 'Membres' })).toBeTruthy();
    expect(backend.calls('role/list')).toBe(3);
  });
});

describe('recherche', () => {
  test('filtre les cartes de TOUTES les colonnes, par nom ou par role ; les capsules ne bougent pas', async () => {
    await mount();
    const field = screen.getByRole('searchbox', { name: 'Rechercher un membre ou un rôle' });
    fireEvent.change(field, { target: { value: 'coord' } });
    expect(namesIn('Tous les membres')).toEqual(['Camille', 'Noah']);
    expect(namesIn('Membres ayant le rôle Coordination')).toEqual(['Camille', 'Noah']);
    expect(within(list('Membres ayant le rôle Dev')).getByText('Aucun membre ne correspond.')).toBeTruthy();
    expect(screen.getByText('4 membres')).toBeTruthy();

    fireEvent.change(field, { target: { value: 'zzz' } });
    expect(within(list('Tous les membres')).getByText('Aucun membre ni rôle ne correspond à « zzz ».')).toBeTruthy();
    // Echap vide la recherche sans quitter le champ.
    fireEvent.keyDown(field, { key: 'Escape' });
    await waitFor(() => expect(namesIn('Tous les membres')).toHaveLength(4));
  });
});

describe('boite « Rôles… » (alternative clavier)', () => {
  test('cocher attribue, decocher retire — un appel par case, etat optimiste, statut dit, focus rendu', async () => {
    await mount();
    const opener = screen.getByRole('button', { name: 'Actions sur Tom' });
    openMenu(opener);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rôles…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rôles de Tom' });

    const coordination = within(dialog).getByRole('checkbox', { name: /Coordination/ });
    const dev = within(dialog).getByRole('checkbox', { name: /^Dev/ });
    expect(isChecked(coordination)).toBe(false);
    expect(isChecked(dev)).toBe(true);

    fireEvent.click(coordination);
    await waitFor(() => expect(bodies['role/assign']).toEqual([{ boardId: 'board1', memberId: 'u2', memberType: 'citoyens', role: 'Coordination' }]));
    // Optimiste : la case et la colonne suivent avant la reponse.
    await waitFor(() => expect(isChecked(within(dialog).getByRole('checkbox', { name: /Coordination/ }))).toBe(true));
    expect(within(dialog).getByRole('status').textContent).toBe('Rôle « Coordination » attribué à Tom.');
    await waitFor(() => expect(namesIn('Membres ayant le rôle Coordination')).toEqual(['Camille', 'Tom', 'Noah']));

    fireEvent.click(within(dialog).getByRole('checkbox', { name: /^Dev/ }));
    await waitFor(() => expect(bodies['role/unassign']).toEqual([{ boardId: 'board1', memberId: 'u2', memberType: 'citoyens', role: 'Dev' }]));
    expect(within(dialog).getByRole('status').textContent).toBe('Rôle « Dev » retiré à Tom.');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Fermer' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Actions sur Tom' }));
  });

  test('refus du serveur : la case se decoche toute seule et la ligne de statut redit l etat vrai, avec la raison', async () => {
    backend.on('role/assign', () => refusal(404, 'notFound', { reason: 'notLinked' }));
    await mount();
    openMenu(screen.getByRole('button', { name: 'Actions sur Tom' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rôles…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rôles de Tom' });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Coordination/ }));
    // Optimiste d'abord : la ligne dit ce que la case montre deja…
    expect(within(dialog).getByRole('status').textContent).toBe('Rôle « Coordination » attribué à Tom.');
    // …puis le rollback decoche, et la ligne ne pretend plus l'attribution.
    await waitFor(() => expect(isChecked(within(dialog).getByRole('checkbox', { name: /Coordination/ }))).toBe(false));
    await waitFor(() =>
      expect(within(dialog).getByRole('status').textContent).toBe(
        'Le rôle « Coordination » n\'a pas pu être attribué à Tom. Cette personne ne fait plus partie du projet ou de l\'organisation : ses rôles ne se modifient plus ici.',
      ),
    );
    expect(namesIn('Membres ayant le rôle Coordination')).toEqual(['Camille', 'Noah']);
    // La ligne de la boite est une `ChoiceRow` : l'anneau de focus est porte par la ligne.
    expect(within(dialog).getByRole('checkbox', { name: /Coordination/ }).closest('label')?.className).toContain('has-[input:focus-visible]:outline-2');
  });
});

describe('retirer et supprimer', () => {
  test('« Retirer le rôle » confirme puis retire ; le focus passe au menu de la colonne', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Retirer le rôle « Coordination » à Camille' }));
    expect(screen.getByText('Retirer le rôle « Coordination » à Camille ?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retirer le rôle' }));
    await waitFor(() => expect(bodies['role/unassign']).toEqual([{ boardId: 'board1', memberId: 'u1', memberType: 'citoyens', role: 'Coordination' }]));
    await waitFor(() => expect(namesIn('Membres ayant le rôle Coordination')).toEqual(['Noah']));
    // La carte, et son bouton, ont disparu : le focus revient au menu de la colonne.
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Actions du rôle Coordination' })));
    // La region vivante de la vue l'a dit.
    expect(screen.getAllByRole('status').some((region) => region.textContent?.startsWith('Rôle « Coordination » retiré à Camille.'))).toBe(true);
  });

  test('retrait refuse par le serveur : la carte revient, et la region de la vue redit l etat vrai avec la raison', async () => {
    // Requete tenue EN VOL : avec un refus immediat, l'optimiste et son rollback
    // tiendraient dans la meme micro-tache et rien ne serait observable.
    const inFlight = deferred<FakeResponse>();
    backend.on('role/unassign', () => inFlight.promise);
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Retirer le rôle « Coordination » à Camille' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retirer le rôle' }));
    // Optimiste : la carte part…
    await waitFor(() => expect(namesIn('Membres ayant le rôle Coordination')).toEqual(['Noah']));
    // …puis le refus la ramene, et la region ne pretend plus le retrait.
    inFlight.resolve(refusal(409, 'boardArchived'));
    await waitFor(() => expect(namesIn('Membres ayant le rôle Coordination')).toEqual(['Camille', 'Noah']));
    await waitFor(() =>
      expect(
        screen.getAllByRole('status').some((region) =>
          region.textContent?.startsWith('Le rôle « Coordination » n\'a pas pu être retiré à Camille. Ce tableau est archivé'),
        ),
      ).toBe(true),
    );
  });

  test('« Supprimer ce rôle » : confirmation avec le nombre de porteurs, puis la colonne part et le titre reprend le focus', async () => {
    await mount();
    openMenu(screen.getByRole('button', { name: 'Actions du rôle Trésorerie' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Supprimer ce rôle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Supprimer ce rôle' });
    expect(within(dialog).getByText('Le rôle « Trésorerie » n\'est porté par personne : sa colonne disparaît.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => expect(bodies['role/delete']).toEqual([{ boardId: 'board1', role: 'Trésorerie' }]));
    await waitFor(() => expect(screen.queryByRole('heading', { level: 3, name: 'Trésorerie' })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Rôles' })));
  });

  test('E42 : suppression arretee en cours de route (`roleWriteFailed`, `removedFrom`) — la notification dit le compte, pas « le serveur n a pas repondu »', async () => {
    backend.on('role/delete', recording('role/delete', () => refusal(500, 'serverError', { reason: 'roleWriteFailed', role: 'Coordination', memberId: 'u3', removedFrom: 1 })));
    await mount();
    openMenu(screen.getByRole('button', { name: 'Actions du rôle Coordination' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Supprimer ce rôle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Supprimer ce rôle' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => expect(bodies['role/delete']).toEqual([{ boardId: 'board1', role: 'Coordination' }]));
    // La raison fine, chiffree par `removedFrom` (cote donnees : `kanbanErrorTranslation`), arrive par la notification de la vue.
    // Notification `sonner` du site : on lit le toast lui-meme (`data-sonner-toast`).
    await waitFor(() => expect(document.querySelector('[data-sonner-toast]')?.textContent).toMatch(/1 membre/));
    expect(document.querySelector('[data-sonner-toast]')?.textContent).not.toMatch(/n'a pas répondu correctement/);
    // Le cache est repose puis la liste relue : la colonne est toujours la.
    await waitFor(() => expect(namesIn('Membres ayant le rôle Coordination')).toEqual(['Camille', 'Noah']));
  });

  test('la confirmation compte les porteurs reels (« retiré de 2 membres »), recherche active ou non', async () => {
    await mount();
    // Une recherche qui ne laisse voir qu'un porteur ne change pas le compte (M14).
    fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher un membre ou un rôle' }), { target: { value: 'cam' } });
    expect(namesIn('Membres ayant le rôle Coordination')).toEqual(['Camille']);
    openMenu(screen.getByRole('button', { name: 'Actions du rôle Coordination' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Supprimer ce rôle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Supprimer ce rôle' });
    expect(within(dialog).getByText('Le rôle « Coordination » sera retiré de 2 membres. Cette action est irréversible.')).toBeTruthy();
  });
});

describe('composeur « Ajouter un rôle »', () => {
  test('refus dits sous le champ, creation optimiste, enchainement, Echap rend le focus au bouton', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un rôle' }));
    const field = screen.getByRole('textbox', { name: /Nom du rôle/ });
    expect(document.activeElement).toBe(field);

    fireEvent.click(screen.getByRole('button', { name: 'Créer le rôle' }));
    expect(screen.getByRole('alert').textContent).toBe('Nommez le rôle.');
    expect(bodies['role/create']).toBeUndefined();

    fireEvent.change(field, { target: { value: ' Coordination ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer le rôle' }));
    expect(screen.getByRole('alert').textContent).toBe('Le rôle « Coordination » existe déjà : déposez le membre dans sa colonne.');

    fireEvent.change(field, { target: { value: 'a<b' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer le rôle' }));
    expect(screen.getByRole('alert').textContent).toMatch(/ni « < »/);

    fireEvent.change(field, { target: { value: ' Accueil ' } });
    fireEvent.submit(field.closest('form') ?? field);
    await waitFor(() => expect(bodies['role/create']).toEqual([{ boardId: 'board1', role: 'Accueil' }]));
    expect(await screen.findByRole('heading', { level: 3, name: 'Accueil' })).toBeTruthy();
    // Le champ se vide et garde la main pour enchainer.
    expect(screen.getByRole('textbox', { name: /Nom du rôle/ })).toHaveProperty('value', '');
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.keyDown(screen.getByRole('textbox', { name: /Nom du rôle/ }), { key: 'Escape' });
    const add = await screen.findByRole('button', { name: 'Ajouter un rôle' });
    expect(document.activeElement).toBe(add);
  });
});

describe('glisser (rejoue comme dnd-kit)', () => {
  test('membre lache sur une colonne de role : fantome au survol, `role/assign` au lacher, annonce du role attribue — la carte reste dans « Membres »', async () => {
    await mount();
    const active = held('u2');
    const over = overRole('Coordination');

    expect(announcements().onDragStart({ active })).toBe(
      'Tom saisi. Déposez la carte sur une colonne de rôle pour lui attribuer ce rôle, ou relâchez-la ailleurs pour annuler.',
    );
    act(() => dnd().onDragStart?.({ activatorEvent: new MouseEvent('mousedown'), active }));
    // L'apercu est la carte soulevee, marquee du geste : « Attribuer ».
    expect(overlay().textContent).toContain('Tom');
    expect(within(overlay()).getByText('Attribuer')).toBeTruthy();
    expect(announcements().onDragOver({ active, over })).toBe('Déposer ici attribue le rôle « Coordination » à Tom.');
    act(() => dnd().onDragOver?.(gesture(active, over)));
    expect(within(overlay()).getByText('Attribuer')).toBeTruthy();
    // Fantome a la place de Tom dans l'ordre des membres (entre Camille et Noah), masque aux lecteurs d'ecran.
    const coordination = list('Membres ayant le rôle Coordination');
    const ghost = within(coordination).getAllByRole('article', { hidden: true }).find((article) => article.getAttribute('aria-hidden') === 'true');
    expect(ghost?.textContent).toContain('Tom');
    expect(within(coordination).getAllByRole('article', { hidden: true }).map((article) => article.textContent?.includes('Tom'))).toEqual([false, true, false]);

    act(() => dnd().onDragEnd?.(gesture(active, over)));
    expect(announcements().onDragEnd({ active, over })).toBe('Rôle « Coordination » attribué à Tom.');
    expect(overlay().textContent).toBe('');
    await waitFor(() => expect(bodies['role/assign']).toEqual([{ boardId: 'board1', memberId: 'u2', memberType: 'citoyens', role: 'Coordination' }]));
    await waitFor(() => expect(namesIn('Membres ayant le rôle Coordination')).toEqual(['Camille', 'Tom', 'Noah']));
    // Glisser = COPIE : Tom est toujours dans « Membres », avec son nouveau role.
    expect(namesIn('Tous les membres')).toEqual(['Camille', 'Tom', 'Noah', 'Les Jardins du Port']);
    expect(within(list('Tous les membres')).getByText('Dev · Coordination')).toBeTruthy();
  });

  test('depot refuse par le serveur : la carte deposee repart de la colonne, et la region de la vue redit l etat vrai avec la raison', async () => {
    const inFlight = deferred<FakeResponse>();
    backend.on('role/assign', () => inFlight.promise);
    await mount();
    const active = held('u2');
    const over = overRole('Coordination');
    act(() => dnd().onDragStart?.({ activatorEvent: new MouseEvent('mousedown'), active }));
    act(() => dnd().onDragEnd?.(gesture(active, over)));
    // Optimiste : Tom est dans la colonne tant que la requete est en vol…
    await waitFor(() => expect(namesIn('Membres ayant le rôle Coordination')).toEqual(['Camille', 'Tom', 'Noah']));
    // …puis le refus (membre delie entre-temps) l'en retire, et la region le dit.
    inFlight.resolve(refusal(404, 'notFound', { reason: 'notLinked' }));
    await waitFor(() => expect(namesIn('Membres ayant le rôle Coordination')).toEqual(['Camille', 'Noah']));
    await waitFor(() =>
      expect(
        screen.getAllByRole('status').some((region) =>
          region.textContent?.startsWith('Le rôle « Coordination » n\'a pas pu être attribué à Tom. Cette personne ne fait plus partie'),
        ),
      ).toBe(true),
    );
  });

  test('membre deja porteur : la carte le dit, rien ne part, l annonce dit pourquoi ; lache dans le vide : rien', async () => {
    await mount();
    const active = held('u1');
    const over = overRole('Coordination');
    act(() => dnd().onDragStart?.({ activatorEvent: new MouseEvent('mousedown'), active }));
    expect(announcements().onDragOver({ active, over })).toBe('Camille a déjà le rôle « Coordination ».');
    act(() => dnd().onDragOver?.(gesture(active, over)));
    const coordination = list('Membres ayant le rôle Coordination');
    expect(within(coordination).getByText('Déjà ce rôle')).toBeTruthy();
    // Aucun fantome sur une colonne qui refuse (M12) : le fantome promet une place.
    expect(within(coordination).queryAllByRole('article', { hidden: true }).find((article) => article.getAttribute('aria-hidden') === 'true')).toBeUndefined();
    // L'apercu lui-meme dit le refus — la pastille de la carte porteuse est
    // souvent sous lui — et ne dit plus « Attribuer » ; le curseur dit « interdit ».
    expect(within(overlay()).getByText('Déjà ce rôle')).toBeTruthy();
    expect(within(overlay()).queryByText('Attribuer')).toBeNull();
    expect(overlay().querySelector('article')?.className).toMatch(/cursor-not-allowed/);
    act(() => dnd().onDragEnd?.(gesture(active, over)));
    expect(announcements().onDragEnd({ active, over })).toBe('Camille a déjà le rôle « Coordination ».');
    await act(async () => undefined);
    expect(bodies['role/assign']).toBeUndefined();

    act(() => dnd().onDragStart?.({ activatorEvent: new MouseEvent('mousedown'), active }));
    act(() => dnd().onDragEnd?.(gesture(active, null)));
    expect(announcements().onDragEnd({ active, over: null })).toBe('Carte relâchée hors d’une colonne de rôle : les rôles de Camille ne changent pas.');
    expect(announcements().onDragCancel({ active, over: null })).toBe('Attribution annulée : les rôles de Camille ne changent pas.');
    expect(bodies['role/assign']).toBeUndefined();
  });

  test('temoin : au pointeur, la carte d un admin se saisit — le capteur souris demarre le glisser au-dela de 6 px, et le relache le termine', async () => {
    await mount();
    const card = within(list('Tous les membres')).getAllByRole('article')[1];
    expect(card.querySelector('svg.lucide-grip-vertical')).not.toBeNull();
    expect(card.className).toMatch(/cursor-grab/);
    // L'appui long qui saisit la carte ne doit ni selectionner ni ouvrir de « callout ».
    expect(card.className).toMatch(/(^|\s)select-none(\s|$)/);
    expect(card.className).toContain('[-webkit-touch-callout:none]');
    fireEvent.mouseDown(card, { clientX: 10, clientY: 10, button: 0 });
    fireEvent.mouseMove(document, { clientX: 80, clientY: 60 });
    await waitFor(() => expect(relay.started).toBe(1));
    expect(overlay().textContent).toContain('Tom');
    fireEvent.mouseUp(document, { clientX: 80, clientY: 60 });
    await waitFor(() => expect(overlay().textContent).toBe(''));
    await act(async () => undefined);
    // Relache hors de toute colonne : rien ne part.
    expect(bodies['role/assign']).toBeUndefined();
  });

  test('aucune carte n est un faux bouton clavier : la prise est au pointeur, le clavier passe par « Rôles… »', async () => {
    await mount();
    const members = list('Tous les membres');
    for (const article of within(members).getAllByRole('article')) {
      expect(article.getAttribute('role')).toBeNull();
      expect(article.getAttribute('tabindex')).toBeNull();
    }
  });
});

/* §12.8 D34 : le repli des colonnes du kanban des roles de Communecter (spec §1.2), preference de poste. */
describe('masquage local des colonnes de role (D34)', () => {
  test('« Masquer la colonne » : la colonne part, le focus et l annonce vont a l indicateur, la cle `:roles` est ecrite ; « Tout afficher » la ramene', async () => {
    await mount();
    // « Membres » (la source) n'a pas de menu : seules les colonnes de role se masquent.
    expect(screen.queryByRole('button', { name: /Actions de la colonne Membres/ })).toBeNull();
    const membersColumn = screen.getByRole('heading', { level: 3, name: 'Membres' }).closest('section');
    expect(membersColumn?.querySelector('header button[aria-haspopup="menu"]')).toBeNull();

    openMenu(screen.getByRole('button', { name: 'Actions du rôle Trésorerie' }));
    const menu = await screen.findByRole('menu');
    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Masquer la colonne' }));
    });
    await waitFor(() => expect(screen.queryByRole('heading', { level: 3, name: 'Trésorerie' })).toBeNull());
    expect(headings()).toEqual(['Membres', 'Coordination', 'Dev']);
    // La colonne n'est pas rendue : elle n'est donc plus une cible de depot.
    expect(screen.queryByRole('list', { name: 'Membres ayant le rôle Trésorerie' })).toBeNull();

    const notice = screen.getByRole('button', { name: '1 colonne masquée · Tout afficher' });
    await waitFor(() => expect(document.activeElement).toBe(notice));
    expect(said('Colonne « Trésorerie » masquée sur cet appareil.')).toBe(true);
    // Persistance sous la cle de la PORTEE roles, et seulement elle.
    expect(window.localStorage.getItem(hiddenColumnsStorageKey('board1', 'roles'))).toBe(JSON.stringify(['Trésorerie']));
    expect(window.localStorage.getItem(hiddenColumnsStorageKey('board1'))).toBeNull();

    fireEvent.click(notice);
    expect(await screen.findByRole('heading', { level: 3, name: 'Trésorerie' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /colonne masquée/ })).toBeNull();
    // L'indicateur a disparu avec le focus : il revient a « Colonnes affichées ».
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Colonnes affichées' })));
    expect(said('Toutes les colonnes sont de nouveau affichées.')).toBe(true);
    expect(window.localStorage.getItem(hiddenColumnsStorageKey('board1', 'roles'))).toBeNull();
  });

  test('persistance au remontage : la preference est relue apres l hydratation, elaguee des roles disparus ; un role masque reste attribuable par « Rôles… »', async () => {
    window.localStorage.setItem(hiddenColumnsStorageKey('board1', 'roles'), JSON.stringify(['Coordination', 'Disparu']));
    await mount();
    await waitFor(() => expect(headings()).toEqual(['Membres', 'Trésorerie', 'Dev']));
    // Deux roles stockes, un seul existe : l'indicateur compte les colonnes qui existent.
    expect(screen.getByRole('button', { name: '1 colonne masquée · Tout afficher' })).toBeTruthy();

    // La boite « Rôles… » lit la liste servie, pas les colonnes rendues : la case est la, et attribue.
    openMenu(screen.getByRole('button', { name: 'Actions sur Tom' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rôles…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rôles de Tom' });
    expect(within(dialog).getAllByRole('checkbox').map((box) => box.closest('label')?.textContent)).toEqual([
      expect.stringContaining('Coordination'),
      expect.stringContaining('Trésorerie'),
      expect.stringContaining('Dev'),
    ]);
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Coordination/ }));
    await waitFor(() => expect(bodies['role/assign']).toEqual([{ boardId: 'board1', memberId: 'u2', memberType: 'citoyens', role: 'Coordination' }]));
    // La colonne masquee le reste : attribuer un role n'est pas l'afficher.
    expect(screen.queryByRole('heading', { level: 3, name: 'Coordination' })).toBeNull();
    expect(within(list('Tous les membres')).getByText('Dev · Coordination')).toBeTruthy();
  });

  test('la recherche ne rend pas une colonne masquee, et le compteur de l en-tete compte toujours les roles', async () => {
    window.localStorage.setItem(hiddenColumnsStorageKey('board1', 'roles'), JSON.stringify(['Coordination']));
    await mount();
    await waitFor(() => expect(headings()).toEqual(['Membres', 'Trésorerie', 'Dev']));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher un membre ou un rôle' }), { target: { value: 'coord' } });
    expect(headings()).toEqual(['Membres', 'Trésorerie', 'Dev']);
    expect(screen.getByText(/4 membres, 3 rôles\./)).toBeTruthy();
  });

  test('« Colonnes affichées » dans l en-tete de la vue ouvre la boite (le meme reglage que le menu « ⋯ »)', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Colonnes affichées' }));
    const dialog = await screen.findByRole('dialog', { name: 'Colonnes affichées' });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Trésorerie/ }));
    await waitFor(() => expect(headings()).toEqual(['Membres', 'Coordination', 'Dev']));
    expect(window.localStorage.getItem(hiddenColumnsStorageKey('board1', 'roles'))).toBe(JSON.stringify(['Trésorerie']));
  });
});

describe('reperage DOM des colonnes (rolesFocus)', () => {
  test('la colonne et son menu se retrouvent par libelle, quel que soit le libelle', async () => {
    await mount();
    const root = screen.getByRole('list', { name: 'Colonnes du kanban des rôles' });
    expect(roleColumnElementIn(root, 'Trésorerie')?.querySelector('h3')?.textContent).toBe('Trésorerie');
    expect(roleColumnMenuIn(root, 'Trésorerie')).toBe(screen.getByRole('button', { name: 'Actions du rôle Trésorerie' }));
    expect(roleColumnMenuIn(root, 'Inconnu')).toBeNull();
    expect(roleColumnMenuIn(null, 'Trésorerie')).toBeNull();
    // Le menu d'une carte de « Membres », par la cle du membre : jamais celui d'une carte porteuse.
    expect(memberMenuIn(root, 'citoyens:u2')).toBe(screen.getByRole('button', { name: 'Actions sur Tom' }));
    expect(memberMenuIn(root, 'citoyens:inconnu')).toBeNull();
    expect(memberMenuIn(null, 'citoyens:u2')).toBeNull();
  });
});
