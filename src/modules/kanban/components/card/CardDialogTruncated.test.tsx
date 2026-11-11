// @vitest-environment jsdom
/**
 * Fiche d'une carte TRONQUEE par le budget de `board/get` (§11.9 E29).
 *
 * Sur un board-lien, une carte servie au-dela du budget arrive `checklist: []`
 * et `checklistTruncated: true`, compteurs exacts. La fiche ne fait JAMAIS son
 * brouillon de cette liste vide : elle lit la carte complete (`card/get`),
 * montre un etat de chargement, puis prend CETTE carte pour brouillon et pour
 * base de la fusion a trois. Un echec se dit, avec « Reessayer ».
 *
 * La carte complete est relue a CHAQUE ouverture (aucune fraicheur, aucune
 * retention, cf. `useCardDetail`) ; et la fiche qui passe d'une carte a une
 * carte tronquee ne montre ni n'enregistre, pendant la lecture, le brouillon
 * de la precedente — `ActionsView` garde la meme instance de fiche d'une carte a
 * l'autre.
 *
 * Repris de co-kanban (`tests/unit/cardDialogTruncated.test.tsx`).
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@/modules/kanban/i18n';
import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import CardDialog from './CardDialog';
import type { CardUpdatePatch } from './cardForm';
import { KANBAN_QUERY_KEYS } from '@/modules/kanban/constants/queryKeys';
import type { Card } from '@/modules/kanban/types';
import {
  deferred,
  hookWrapper,
  ok,
  refusal,
  resetHarness,
  signIn,
  stubKanbanFetch,
  testQueryClient,
  type FakeResponse,
} from '@/modules/kanban/__fixtures__/hookHarness';
import { installRadixDom } from '@/modules/kanban/__fixtures__/radixDom';
import { LINK_CAPABILITIES, makeAction, makeLinkSnapshot, makeMember } from '@/modules/kanban/__fixtures__/snapshot';

const CHECKLIST = [
  { id: 't1', label: 'Maquette', done: true },
  { id: 't2', label: 'Recette', done: false },
];
const TRUNCATED = makeAction('c1', 'todo', {
  title: 'Agenda : état vide',
  checklist: [],
  checklistDone: 1,
  checklistTotal: 2,
  checklistTruncated: true,
});
const { checklistTruncated: _flag, ...served } = TRUNCATED;
const COMPLETE: Card = { ...served, checklist: CHECKLIST };
const SNAPSHOT = makeLinkSnapshot({ cards: [TRUNCATED], members: [makeMember('u1', 'owner', 'Camille')] });

beforeAll(installRadixDom);

beforeEach(() => {
  signIn('u1');
});

afterEach(() => {
  resetHarness();
});

/** Cle de la carte complete lue par la fiche (`useCardDetail`). */
const CARD_KEY = KANBAN_QUERY_KEYS.CARD('u1', SNAPSHOT.board._id, TRUNCATED._id);

function mount(card: Card) {
  const onSave = vi.fn(async (_patch: CardUpdatePatch) => undefined);
  const queryClient = testQueryClient();
  const dialog = (shown: Card | null) =>
    // Fiche fermee = DEMONTEE, comme dans `ActionsView` (aucune carte dans l'adresse).
    shown === null ? null : (
      <CardDialog
        card={shown}
        board={SNAPSHOT.board}
        columns={SNAPSHOT.columns}
        members={SNAPSHOT.members}
        capabilities={LINK_CAPABILITIES}
        milestones={SNAPSHOT.milestones}
        currentUserId="u1"
        isLoading={false}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );
  const { rerender } = render(dialog(card), { wrapper: hookWrapper(queryClient, { router: true }) });
  return {
    onSave,
    queryClient,
    /** Meme instance de fiche sur une autre carte, ou fiche fermee (`null`). */
    show: (next: Card | null) => rerender(dialog(next)),
  };
}

function checkbox(container: HTMLElement, label: string): HTMLInputElement {
  const box = within(container).getByRole('checkbox', { name: `Cocher : ${label}` });
  if (!(box instanceof HTMLInputElement)) throw new Error(`case « ${label} » introuvable`);
  return box;
}

/** Champ du titre (son nom accessible porte aussi la mention « obligatoire »). */
function titleField(container: HTMLElement): HTMLInputElement | null {
  const field = within(container).queryByRole('textbox', { name: /^Titre/ });
  if (field === null) return null;
  if (!(field instanceof HTMLInputElement)) throw new Error('le champ du titre n est pas un <input>');
  return field;
}

test('carte tronquee : card/get, etat de chargement, puis brouillon ET base pris de la carte complete', async () => {
  const pending = deferred<FakeResponse>();
  const backend = stubKanbanFetch({
    'card/get': () => pending.promise,
    'comment/list': () => ok({ comments: [], total: 0 }),
  });
  const { onSave } = mount(TRUNCATED);
  const dialog = await screen.findByRole('dialog');

  // Chargement : aucun formulaire fait de la liste vide, rien a enregistrer.
  await waitFor(() => expect(backend.calls('card/get')).toBe(1));
  expect(dialog.querySelector('[aria-busy="true"]')).not.toBeNull();
  expect(within(dialog).queryByRole('textbox', { name: 'Titre' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull();

  pending.resolve(ok({ card: COMPLETE }));
  await within(dialog).findByRole('checkbox', { name: 'Cocher : Recette' });
  expect(checkbox(dialog, 'Maquette').checked).toBe(true);

  fireEvent.click(checkbox(dialog, 'Recette'));
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
  await waitFor(() => expect(onSave).toHaveBeenCalled());
  // La BASE est la liste complete vue a l'ouverture, jamais la liste vide.
  expect(onSave).toHaveBeenCalledWith({
    checklist: [CHECKLIST[0], { ...CHECKLIST[1], done: true }],
    checklistBase: CHECKLIST,
  });
});

test('echec de card/get : la cause et « Reessayer », qui relit la carte et ouvre la fiche', async () => {
  const retry = deferred<FakeResponse>();
  let attempts = 0;
  const backend = stubKanbanFetch({
    'card/get': () => {
      attempts += 1;
      // Refus NON passager : site-json réessaie une fois un 500 (`shouldRetryKanbanQuery`).
      return attempts === 1 ? refusal(404, 'notFound') : retry.promise;
    },
    'comment/list': () => ok({ comments: [], total: 0 }),
  });
  mount(TRUNCATED);
  const dialog = await screen.findByRole('dialog');

  await within(dialog).findByText("Le détail de cette carte n'a pas pu être chargé.");
  expect(within(dialog).getByRole('alert')).toBeTruthy();
  // Seule sortie hors « Reessayer » : fermer. Rien a enregistrer ni archiver.
  expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Fermer' })).toBeTruthy();

  fireEvent.click(within(dialog).getByRole('button', { name: 'Réessayer' }));
  await waitFor(() => expect(backend.calls('card/get')).toBe(2));
  // Pendant la relecture, l'echec precedent ne reste pas affiche : sans donnees,
  // TanStack 5 remet la query a `pending` (erreur effacee) des le depart de la
  // lecture, et la fiche montre le chargement ; la clause `!isFetching` de
  // CardDialog n'en est que la ceinture.
  await waitFor(() => expect(dialog.querySelector('[aria-busy="true"]')).not.toBeNull());
  expect(within(dialog).queryByText("Le détail de cette carte n'a pas pu être chargé.")).toBeNull();
  expect(within(dialog).queryByRole('button', { name: 'Réessayer' })).toBeNull();

  retry.resolve(ok({ card: COMPLETE }));
  await within(dialog).findByRole('checkbox', { name: 'Cocher : Maquette' });
});

test('fermer puis rouvrir relit card/get, sans montrer la lecture precedente', async () => {
  const reread = deferred<FakeResponse>();
  let reads = 0;
  const backend = stubKanbanFetch({
    'card/get': () => {
      reads += 1;
      return reads === 1 ? ok({ card: COMPLETE }) : reread.promise;
    },
    'comment/list': () => ok({ comments: [], total: 0 }),
  });
  const { queryClient, show } = mount(TRUNCATED);
  const first = await screen.findByRole('dialog');
  await within(first).findByRole('checkbox', { name: 'Cocher : Recette' });
  expect(checkbox(first, 'Recette').checked).toBe(false);

  // Fiche fermee : la carte lue n'est pas gardee (`gcTime: 0`)…
  show(null);
  await waitFor(() => expect(queryClient.getQueryCache().find({ queryKey: CARD_KEY })).toBeUndefined());

  // … et rouverte dans la minute (la fraicheur de l'application), elle relit
  // card/get. Entre-temps, une collegue a coche « Recette ».
  show(TRUNCATED);
  const second = await screen.findByRole('dialog');
  await waitFor(() => expect(backend.calls('card/get')).toBe(2));
  // Pendant la relecture : le chargement, jamais la liste de la lecture precedente.
  expect(second.querySelector('[aria-busy="true"]')).not.toBeNull();
  expect(within(second).queryByRole('checkbox', { name: 'Cocher : Recette' })).toBeNull();

  reread.resolve(ok({ card: { ...COMPLETE, checklist: [CHECKLIST[0], { ...CHECKLIST[1], done: true }], checklistDone: 2 } }));
  await within(second).findByRole('checkbox', { name: 'Cocher : Recette' });
  expect(checkbox(second, 'Recette').checked).toBe(true);
});

test('passer de A a B tronquee : le brouillon de A ne s affiche pas sous B et ne part pas pour elle', async () => {
  const pending = deferred<FakeResponse>();
  const backend = stubKanbanFetch({
    'card/get': () => pending.promise,
    'comment/list': () => ok({ comments: [], total: 0 }),
  });
  const cardA = makeAction('cA', 'todo', { title: 'Carte A' });
  const { onSave, show } = mount(cardA);
  const dialog = await screen.findByRole('dialog');
  const titleOfA = titleField(dialog);
  if (titleOfA === null) throw new Error('la fiche de A n affiche pas son titre');
  fireEvent.change(titleOfA, { target: { value: 'Titre de A modifie' } });

  // La fiche passe a B (lien profond, « precedent » du navigateur) pendant que
  // sa carte complete est en vol.
  show(TRUNCATED);
  await waitFor(() => expect(backend.calls('card/get')).toBe(1));
  expect(within(dialog).queryByDisplayValue('Titre de A modifie')).toBeNull();
  expect(titleField(dialog)).toBeNull();
  // Rien a enregistrer : le seul geste offert est de fermer.
  expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Fermer' })).toBeTruthy();

  // B arrive : SON brouillon, intact, que rien ne declare modifie.
  pending.resolve(ok({ card: COMPLETE }));
  await within(dialog).findByRole('checkbox', { name: 'Cocher : Recette' });
  expect(titleField(dialog)?.value).toBe(COMPLETE.title);
  const save = screen.getByRole('button', { name: 'Enregistrer' });
  if (!(save instanceof HTMLButtonElement)) throw new Error('« Enregistrer » n est pas un bouton');
  expect(save.disabled).toBe(true);
  expect(onSave).not.toHaveBeenCalled();
});

test('carte complete : aucune lecture de card/get, la fiche s ouvre aussitot', async () => {
  const backend = stubKanbanFetch({ 'comment/list': () => ok({ comments: [], total: 0 }) });
  mount(COMPLETE);
  const dialog = await screen.findByRole('dialog');
  expect(checkbox(dialog, 'Maquette').checked).toBe(true);
  await waitFor(() => expect(backend.calls('comment/list')).toBe(1));
  expect(backend.calls('card/get')).toBe(0);
});
