// @vitest-environment jsdom
/**
 * « Colonnes affichées » (constats #77 et #118 ; §12.8 D34) : un identifiant de
 * colonne supprimee ailleurs, reste dans le stockage, n'active plus « Tout
 * afficher » ; la boite est la MEME pour le Tableau et la vue Roles (entrees
 * generiques, portee de la preference) et porte « Tout masquer ».
 */
import '@/modules/kanban/i18n';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import ColumnVisibilityDialog, { type ColumnVisibilityEntry } from './ColumnVisibilityDialog';
import { hiddenColumnsStorageKey, type HiddenColumnsScope } from './hiddenColumns';
import { boardPrefsContextFor, BoardPrefsContext, type BoardPrefsValue } from './boardPrefs';
import { BoardPrefsProvider } from './BoardPrefsProvider';

afterEach(cleanup);

const ENTRIES: ColumnVisibilityEntry[] = [
  { id: 'todo', label: 'À faire', detail: '3 cartes' },
  { id: 'done', label: 'Fini', detail: '1 carte' },
];

function prefs(hiddenColumnIds: string[]): BoardPrefsValue {
  return { hiddenColumnIds, toggleColumn: vi.fn(), showAllColumns: vi.fn(), hideAllColumns: vi.fn(), openColumnVisibility: vi.fn() };
}

function monter(value: BoardPrefsValue, scope: HiddenColumnsScope = 'kanban', entries = ENTRIES, description?: string) {
  const Context = boardPrefsContextFor(scope);
  render(
    <Context.Provider value={value}>
      <ColumnVisibilityDialog open scope={scope} entries={entries} description={description} onClose={() => {}} />
    </Context.Provider>,
  );
}

/** Bouton du pied par son nom, garde plutot que `as` : un autre element le dirait. */
function bouton(name: string): HTMLButtonElement {
  const button = screen.getByRole('button', { name });
  if (!(button instanceof HTMLButtonElement)) throw new Error(`« ${name} » : <${button.tagName}> au lieu d un bouton`);
  return button;
}

test('identifiant perime seulement : toutes les cases cochees, « Tout afficher » inactif, « Tout masquer » actif', () => {
  monter(prefs(['colonne-supprimee']));
  expect(screen.getAllByRole('checkbox').every((box) => box instanceof HTMLInputElement && box.checked)).toBe(true);
  expect(bouton('Tout afficher').disabled).toBe(true);
  expect(bouton('Tout masquer').disabled).toBe(false);
  // Les details (nombre de cartes) sont ceux des entrees, deja traduits.
  expect(screen.getByText('3 cartes')).toBeTruthy();
});

test('une colonne existante masquee : « Tout afficher » actif et branche ; une case bascule sa colonne', () => {
  const value = prefs(['colonne-supprimee', 'done']);
  monter(value);
  expect(bouton('Tout afficher').disabled).toBe(false);
  fireEvent.click(bouton('Tout afficher'));
  expect(value.showAllColumns).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('checkbox', { name: /À faire/ }));
  expect(value.toggleColumn).toHaveBeenCalledWith('todo');
});

test('« Tout masquer » (D34) : branche sur le fournisseur, inactif quand tout est deja masque', () => {
  const value = prefs([]);
  monter(value);
  fireEvent.click(bouton('Tout masquer'));
  expect(value.hideAllColumns).toHaveBeenCalledTimes(1);
  cleanup();
  monter(prefs(['todo', 'done']));
  expect(bouton('Tout masquer').disabled).toBe(true);
  expect(bouton('Tout afficher').disabled).toBe(false);
});

test('portee `roles` : la boite lit la preference de la vue Roles, pas celle du Tableau, et dit sa phrase', () => {
  const kanban = prefs(['todo']);
  const roles = prefs(['Trésorerie']);
  const Roles = boardPrefsContextFor('roles');
  render(
    <BoardPrefsContext.Provider value={kanban}>
      <Roles.Provider value={roles}>
        <ColumnVisibilityDialog
          open
          scope="roles"
          entries={[
            { id: 'Coordination', label: 'Coordination', detail: '2 membres' },
            { id: 'Trésorerie', label: 'Trésorerie', detail: '0 membre' },
          ]}
          description="Masquez les rôles que vous ne suivez pas."
          onClose={() => {}}
        />
      </Roles.Provider>
    </BoardPrefsContext.Provider>,
  );
  const coordination = screen.getByRole('checkbox', { name: /Coordination/ });
  const tresorerie = screen.getByRole('checkbox', { name: /Trésorerie/ });
  expect(coordination instanceof HTMLInputElement && coordination.checked).toBe(true);
  expect(tresorerie instanceof HTMLInputElement && tresorerie.checked).toBe(false);
  expect(screen.getByRole('dialog').textContent).toContain('Masquez les rôles que vous ne suivez pas.');
  fireEvent.click(coordination);
  expect(roles.toggleColumn).toHaveBeenCalledWith('Coordination');
  expect(kanban.toggleColumn).not.toHaveBeenCalled();
  fireEvent.click(bouton('Tout masquer'));
  expect(roles.hideAllColumns).toHaveBeenCalledTimes(1);
  expect(kanban.hideAllColumns).not.toHaveBeenCalled();
});

test('sans entree : la boite le dit, les deux commandes sont inactives', () => {
  monter(prefs([]), 'roles', []);
  expect(screen.getByText('Aucune colonne à afficher pour le moment.')).toBeTruthy();
  expect(bouton('Tout masquer').disabled).toBe(true);
  expect(bouton('Tout afficher').disabled).toBe(true);
});

/*
 * Relecture v3.1 : actives au clavier, « Tout masquer » puis « Tout afficher »
 * se desactivaient SOUS le focus, que le navigateur rendait a <body> dans une
 * boite modale (WCAG 2.4.3). Le VRAI fournisseur est monte : c'est le changement
 * de preference qui desactive le bouton presse — un faux fournisseur a `vi.fn()`
 * ne le montrerait pas.
 */
test('« Tout masquer » puis « Tout afficher » : le focus passe au bouton jumeau, jamais a <body>', () => {
  window.localStorage.clear();
  render(
    <BoardPrefsProvider boardId="b1" columnIds={ENTRIES.map((entry) => entry.id)}>
      <ColumnVisibilityDialog open entries={ENTRIES} onClose={() => {}} />
    </BoardPrefsProvider>,
  );
  const hideAll = bouton('Tout masquer');
  const showAll = bouton('Tout afficher');
  act(() => hideAll.focus());
  expect(document.activeElement).toBe(hideAll);

  fireEvent.click(hideAll);
  expect(hideAll.disabled).toBe(true);
  expect(document.activeElement).toBe(showAll);
  expect(window.localStorage.getItem(hiddenColumnsStorageKey('b1'))).toBe(JSON.stringify(['done', 'todo']));

  fireEvent.click(showAll);
  expect(showAll.disabled).toBe(true);
  expect(document.activeElement).toBe(hideAll);
  expect(window.localStorage.getItem(hiddenColumnsStorageKey('b1'))).toBeNull();
});
