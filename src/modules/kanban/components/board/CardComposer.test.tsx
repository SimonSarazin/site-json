// @vitest-environment jsdom
/**
 * GARDE DU COMPOSEUR DE CARTE EN LIGNE, repris de co-kanban (`tests/unit/cardComposer.test.tsx`).
 *
 * Un champ à la forme d'une carte s'ouvre au pied de la colonne, on tape un titre, on enregistre,
 * et on enchaîne. Ce fichier verrouille les comportements sans lesquels cette saisie rapide
 * devient hostile :
 *
 *  - le pied ouvre le composeur à sa place ; il n'y a pas d'« Ajouter en tête » (ordre
 *    canonique d'un tableau relié) ;
 *  - Échap ou « Annuler » ferment et RESTITUENT le focus au déclencheur ;
 *  - un titre vide ou blanc ne crée rien ;
 *  - un enregistrement réussi vide le champ SANS fermer ;
 *  - un enregistrement en échec CONSERVE la saisie.
 */
import '@/modules/kanban/i18n';
import { DndContext } from '@dnd-kit/core';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { KanbanColumn } from '@/modules/kanban/components/board/KanbanColumn';
import { indexMembers } from '@/modules/kanban/components/board/kanbanDnd';
import { installRadixDom, openMenu } from '@/modules/kanban/__fixtures__/radixDom';
import type { Card, Column } from '@/modules/kanban/types';

beforeAll(installRadixDom);

const COLONNE: Column = {
  _id: 'col1',
  boardId: 'b1',
  title: 'À faire',
  titleKey: 'todo',
  rank: 1000,
  color: null,
  wipLimit: null,
  isDoneColumn: false,
  cardCount: 1,
  creator: 'u1',
  created: 1,
  updated: 1,
};

const CARTE: Card = {
  _id: 'c1',
  boardId: 'b1',
  columnId: 'col1',
  rank: 1000,
  title: 'Commander le plan de travail',
  description: '',
  priority: 'medium',
  status: 'not_started',
  assignees: [],
  labelIds: [],
  links: [],
  linkCount: 0,
  commentCount: 0,
  checklist: [],
  checklistDone: 0,
  checklistTotal: 0,
  dueDate: null,
  completedAt: null,
  creator: 'u1',
  created: 1,
  updated: 1,
};

// Testing Library ne s'auto-nettoie que sous `globals: true`, qui n'est pas
// active ici : sans ce `cleanup`, le composer du test precedent reste monte et
// `getByPlaceholderText` trouverait deux champs.
afterEach(cleanup);

function monter(onCreateCard: (input: { columnId: string; title: string }) => Promise<Card>) {
  return render(
    <DndContext>
      <ul>
        <KanbanColumn
          column={COLONNE}
          cardIds={[CARTE._id]}
          cardsById={new Map([[CARTE._id, CARTE]])}
          columns={[COLONNE]}
          getCard={(cardId) => (cardId === CARTE._id ? CARTE : undefined)}
          getCardOrder={() => ({ col1: [CARTE._id] })}
          memberIndex={indexMembers([])}
          labelIndex={new Map()}
          nowSeconds={0}
          canEditCards
          canReorderColumns={false}
          isFiltered={false}
          canonical
          onHide={() => {}}
          onLimitChange={() => {}}
          onMoveCard={() => {}}
          onCreateCard={onCreateCard}
          announce={() => {}}
        />
      </ul>
    </DndContext>,
    // Le titre de la carte est le lien de sa fiche : il lui faut un routeur.
    { wrapper: MemoryRouter },
  );
}

const creationReussie = () => vi.fn().mockResolvedValue(CARTE);

function champ(): HTMLTextAreaElement {
  return screen.getByPlaceholderText('Titre de la tâche');
}

function boutonEnregistrer(): HTMLButtonElement {
  return screen.getByRole('button', { name: 'Enregistrer' });
}

function menuColonne(): HTMLButtonElement {
  return screen.getByRole('button', { name: 'Actions de la colonne À faire' });
}

function declencheurPied(): HTMLButtonElement {
  return screen.getByRole('button', { name: 'Ajouter une tâche à À faire' });
}

test('le pied de colonne ouvre le composer EN BAS', async () => {
  const creer = creationReussie();
  monter(creer);

  fireEvent.click(declencheurPied());

  const saisie = champ();
  // Le declencheur du pied a disparu : le composer PREND SA PLACE, sinon deux
  // commandes proposeraient le meme geste au meme endroit.
  expect(screen.queryByRole('button', { name: 'Ajouter une tâche à À faire' })).toBeNull();
  // EN BAS : le composer suit la carte existante.
  const carte = screen.getByTitle(CARTE.title);
  expect(saisie.compareDocumentPosition(carte) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();

  fireEvent.change(saisie, { target: { value: 'Poser les plinthes' } });
  // Entree enregistre ; Maj+Entree, elle, doit laisser passer le saut de ligne.
  fireEvent.keyDown(saisie, { key: 'Enter' });
  await waitFor(() => {
    expect(creer).toHaveBeenCalledWith({
      columnId: 'col1',
      title: 'Poser les plinthes',
    });
  });
});

test('Maj+Entrée ne déclenche pas l’enregistrement', () => {
  const creer = creationReussie();
  monter(creer);

  fireEvent.click(declencheurPied());
  fireEvent.change(champ(), { target: { value: 'Deux' } });
  fireEvent.keyDown(champ(), { key: 'Enter', shiftKey: true });

  expect(creer).not.toHaveBeenCalled();
});

test('Échap ferme le composer et rend le focus au déclencheur', async () => {
  monter(creationReussie());

  fireEvent.click(declencheurPied());
  fireEvent.keyDown(champ(), { key: 'Escape' });

  await waitFor(() => {
    expect(screen.queryByPlaceholderText('Titre de la tâche')).toBeNull();
  });
  // Le focus revient EXACTEMENT sur le bouton qui a ouvert le composer : sans
  // cela, le clavier repart en tete de document a chaque abandon.
  expect(document.activeElement).toBe(declencheurPied());
});

test('« Annuler » ferme aussi, et rend le focus au déclencheur du pied', async () => {
  monter(creationReussie());

  fireEvent.click(declencheurPied());
  fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));

  await waitFor(() => {
    expect(screen.queryByPlaceholderText('Titre de la tâche')).toBeNull();
  });
  expect(document.activeElement).toBe(declencheurPied());
});

test('un titre vide ou uniquement blanc n’est pas enregistrable', () => {
  const creer = creationReussie();
  monter(creer);

  fireEvent.click(declencheurPied());
  expect(boutonEnregistrer().disabled).toBe(true);

  // Des espaces ne sont pas un titre : le bouton reste ferme, et la touche
  // Entree — qui contourne un bouton desactive — ne cree rien non plus.
  fireEvent.change(champ(), { target: { value: '   ' } });
  expect(boutonEnregistrer().disabled).toBe(true);
  fireEvent.keyDown(champ(), { key: 'Enter' });
  expect(creer).not.toHaveBeenCalled();
});

test('un enregistrement réussi vide le champ SANS fermer le composer', async () => {
  const creer = creationReussie();
  monter(creer);

  fireEvent.click(declencheurPied());
  fireEvent.change(champ(), { target: { value: 'Première tâche' } });
  fireEvent.keyDown(champ(), { key: 'Enter' });

  await waitFor(() => {
    expect(champ().value).toBe('');
  });
  // Toujours ouvert et toujours focalise : on saisit rarement une seule tache.
  expect(document.activeElement).toBe(champ());

  fireEvent.change(champ(), { target: { value: 'Deuxième tâche' } });
  fireEvent.keyDown(champ(), { key: 'Enter' });
  await waitFor(() => {
    expect(creer).toHaveBeenCalledTimes(2);
  });
  expect(creer).toHaveBeenLastCalledWith({
    columnId: 'col1',
    title: 'Deuxième tâche',
  });
});

test('un enregistrement en échec CONSERVE la saisie et annonce l’erreur', async () => {
  // Le cas capital : une panne reseau ne doit jamais effacer ce qui vient
  // d'etre tape. Retaper une tache perdue est le genre de detail qui fait
  // abandonner un outil.
  const creer = vi.fn().mockRejectedValue(new Error('réseau injoignable'));
  monter(creer);

  fireEvent.click(declencheurPied());
  fireEvent.change(champ(), { target: { value: 'Tâche à ne pas perdre' } });
  fireEvent.keyDown(champ(), { key: 'Enter' });

  /*
   * Le message est relu PAR SON LIEN au champ (`aria-describedby`), pas par un
   * `getByRole('status')` : dnd-kit monte sa propre region d'annonces avec le
   * meme role, et on verifie ici que l'erreur est bien rattachee a la saisie —
   * sans ce lien, un lecteur d'ecran l'annoncerait sans dire de quoi il parle.
   */
  const annonce = () => document.getElementById(champ().getAttribute('aria-describedby') ?? '');
  await waitFor(() => {
    expect(annonce()?.textContent).toMatch(/n’a pas pu être ajoutée/);
  });
  expect(annonce()?.getAttribute('aria-live')).toBe('polite');
  expect(champ().getAttribute('aria-invalid')).toBe('true');
  expect(champ().value).toBe('Tâche à ne pas perdre');
  // Le composer reste ouvert : on corrige et on relance, sans rien retaper.
  expect(boutonEnregistrer().disabled).toBe(false);
});

/*
 * CONSTAT #64 — tableau relié (ordre canonique) : une carte créée naît à SON rang, jamais « en
 * tête ». Le menu n'a pas d'item qui mentirait ; le pied reste la seule entrée.
 */
test('tableau relié : pas d’« Ajouter une tâche en tête », le pied reste la seule entrée', async () => {
  monter(creationReussie());
  expect(declencheurPied()).toBeTruthy();
  await act(async () => {
    openMenu(menuColonne());
  });
  const menu = await screen.findByRole('menu');
  // Le menu garde ce que tout le monde peut faire : masquer la colonne chez soi.
  expect(within(menu).getByRole('menuitem', { name: 'Masquer la colonne' })).toBeTruthy();
  expect(within(menu).queryByRole('menuitem', { name: 'Ajouter une tâche en tête' })).toBeNull();
});
