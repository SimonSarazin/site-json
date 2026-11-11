// @vitest-environment jsdom
/**
 * Preferences locales du tableau (colonnes masquees, constats #31, #77, #118 ;
 * portee `roles` du §12.8 D34) :
 *  - rien de masque au rendu serveur ni au premier rendu client (meme HTML) ;
 *  - la preference est relue APRES l'hydratation ;
 *  - jamais d'ecriture sous la cle d'un autre tableau ;
 *  - les colonnes disparues sont elaguees ET le stockage reecrit ;
 *  - une PORTEE par fournisseur : la vue Roles lit et ecrit sa cle, sans
 *    toucher celle du Tableau, et les deux fournisseurs cohabitent ;
 *  - « Tout masquer » masque toutes les colonnes connues ; « Colonnes
 *    affichées » s'ouvre par le contexte.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { hiddenColumnsStorageKey, type HiddenColumnsScope } from '@/modules/kanban/components/board/hiddenColumns';
import { BoardPrefsProvider } from '@/modules/kanban/components/board/BoardPrefsProvider';
import { useBoardPrefs } from '@/modules/kanban/components/board/boardPrefs';

function Probe({ scope = 'kanban', column = 'done' }: { scope?: HiddenColumnsScope; column?: string }) {
  const { hiddenColumnIds, toggleColumn, hideAllColumns, showAllColumns, openColumnVisibility } = useBoardPrefs(scope);
  return (
    <>
      <output data-testid={`hidden-${scope}`}>{hiddenColumnIds.join(',')}</output>
      <button type="button" onClick={() => toggleColumn(column)}>
        basculer {scope}
      </button>
      <button type="button" onClick={hideAllColumns}>
        tout masquer {scope}
      </button>
      <button type="button" onClick={showAllColumns}>
        tout afficher {scope}
      </button>
      <button type="button" onClick={openColumnVisibility}>
        ouvrir {scope}
      </button>
    </>
  );
}

const stored = (boardId: string, scope: HiddenColumnsScope = 'kanban') =>
  window.localStorage.getItem(hiddenColumnsStorageKey(boardId, scope));
const hidden = (scope: HiddenColumnsScope = 'kanban') => screen.getByTestId(`hidden-${scope}`).textContent;
const press = (name: string) => act(() => screen.getByRole('button', { name }).click());

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(cleanup);

describe('BoardPrefsProvider', () => {
  test('rendu serveur : rien de masque, quel que soit le stockage', () => {
    window.localStorage.setItem(hiddenColumnsStorageKey('b1'), JSON.stringify(['todo']));
    const html = renderToString(
      <BoardPrefsProvider boardId="b1">
        <Probe />
      </BoardPrefsProvider>,
    );
    expect(html).toContain('<output data-testid="hidden-kanban"></output>');
  });

  test('apres l hydratation : la preference du tableau est relue', () => {
    window.localStorage.setItem(hiddenColumnsStorageKey('b1'), JSON.stringify(['todo']));
    render(
      <BoardPrefsProvider boardId="b1">
        <Probe />
      </BoardPrefsProvider>,
    );
    expect(hidden()).toBe('todo');
  });

  test('changer de tableau relit SA cle et n ecrit rien sous celle du suivant', () => {
    window.localStorage.setItem(hiddenColumnsStorageKey('b1'), JSON.stringify(['todo']));
    const view = render(
      <BoardPrefsProvider boardId="b1" columnIds={['todo', 'done']}>
        <Probe />
      </BoardPrefsProvider>,
    );
    view.rerender(
      <BoardPrefsProvider boardId="b2" columnIds={undefined}>
        <Probe />
      </BoardPrefsProvider>,
    );
    expect(hidden()).toBe('');
    expect(stored('b2')).toBeNull();
    expect(stored('b1')).toBe(JSON.stringify(['todo']));
  });

  test('colonne disparue : elaguee de l affichage ET du stockage, une seule fois', () => {
    window.localStorage.setItem(hiddenColumnsStorageKey('b1'), JSON.stringify(['gone', 'todo']));
    const view = render(
      <BoardPrefsProvider boardId="b1">
        <Probe />
      </BoardPrefsProvider>,
    );
    // Instantane pas encore charge : on ne touche a rien.
    expect(stored('b1')).toBe(JSON.stringify(['gone', 'todo']));
    view.rerender(
      <BoardPrefsProvider boardId="b1" columnIds={['todo', 'done']}>
        <Probe />
      </BoardPrefsProvider>,
    );
    expect(hidden()).toBe('todo');
    expect(stored('b1')).toBe(JSON.stringify(['todo']));
    // Une bascule ulterieure ecrit la liste elaguee, sans l'id perime.
    press('basculer kanban');
    expect(stored('b1')).toBe(JSON.stringify(['done', 'todo']));
  });
});

/* §12.8 D34 : la vue Roles masque ses colonnes de role, sous sa propre cle. */
describe('portee `roles`', () => {
  test('rendu serveur : rien de masque pour la vue Roles non plus', () => {
    window.localStorage.setItem(hiddenColumnsStorageKey('b1', 'roles'), JSON.stringify(['Trésorerie']));
    const html = renderToString(
      <BoardPrefsProvider boardId="b1" scope="roles">
        <Probe scope="roles" />
      </BoardPrefsProvider>,
    );
    expect(html).toContain('<output data-testid="hidden-roles"></output>');
  });

  test('lit et ecrit la cle `:roles`, jamais celle du Tableau', () => {
    window.localStorage.setItem(hiddenColumnsStorageKey('b1', 'roles'), JSON.stringify(['Trésorerie']));
    window.localStorage.setItem(hiddenColumnsStorageKey('b1'), JSON.stringify(['todo']));
    render(
      <BoardPrefsProvider boardId="b1" scope="roles" columnIds={['Coordination', 'Trésorerie']}>
        <Probe scope="roles" column="Coordination" />
      </BoardPrefsProvider>,
    );
    expect(hidden('roles')).toBe('Trésorerie');
    press('basculer roles');
    expect(hidden('roles')).toBe('Trésorerie,Coordination');
    expect(stored('b1', 'roles')).toBe(JSON.stringify(['Coordination', 'Trésorerie']));
    expect(stored('b1')).toBe(JSON.stringify(['todo']));
  });

  test('deux fournisseurs imbriques : chaque portee lit la sienne, et les deux cohabitent', () => {
    window.localStorage.setItem(hiddenColumnsStorageKey('b1'), JSON.stringify(['todo']));
    window.localStorage.setItem(hiddenColumnsStorageKey('b1', 'roles'), JSON.stringify(['Dev']));
    render(
      <BoardPrefsProvider boardId="b1" columnIds={['todo', 'done']}>
        <BoardPrefsProvider boardId="b1" scope="roles" columnIds={['Dev', 'Coordination']}>
          <Probe />
          <Probe scope="roles" column="Coordination" />
        </BoardPrefsProvider>
      </BoardPrefsProvider>,
    );
    expect(hidden()).toBe('todo');
    expect(hidden('roles')).toBe('Dev');
    press('basculer roles');
    expect(hidden('roles')).toBe('Dev,Coordination');
    // Le Tableau n'a pas bouge, ni en memoire ni dans le stockage.
    expect(hidden()).toBe('todo');
    expect(stored('b1')).toBe(JSON.stringify(['todo']));
  });

  test('un role disparu est elague de la cle `:roles`', () => {
    window.localStorage.setItem(hiddenColumnsStorageKey('b1', 'roles'), JSON.stringify(['Disparu', 'Dev']));
    render(
      <BoardPrefsProvider boardId="b1" scope="roles" columnIds={['Dev', 'Coordination']}>
        <Probe scope="roles" />
      </BoardPrefsProvider>,
    );
    expect(hidden('roles')).toBe('Dev');
    expect(stored('b1', 'roles')).toBe(JSON.stringify(['Dev']));
  });
});

describe('« Tout masquer » et « Colonnes affichées »', () => {
  test('tout masquer : toutes les colonnes CONNUES, persistees triees ; tout afficher les rend', () => {
    render(
      <BoardPrefsProvider boardId="b1" columnIds={['todo', 'done', 'next']}>
        <Probe />
      </BoardPrefsProvider>,
    );
    press('tout masquer kanban');
    expect(hidden()).toBe('todo,done,next');
    expect(stored('b1')).toBe(JSON.stringify(['done', 'next', 'todo']));
    press('tout afficher kanban');
    expect(hidden()).toBe('');
    expect(stored('b1')).toBeNull();
  });

  test('tout masquer sans colonnes connues : rien ne change (il n y a rien a masquer)', () => {
    render(
      <BoardPrefsProvider boardId="b1">
        <Probe />
      </BoardPrefsProvider>,
    );
    press('tout masquer kanban');
    expect(hidden()).toBe('');
    expect(stored('b1')).toBeNull();
  });

  test('l ouverture de la boite passe par le contexte, et suit le dernier rappel fourni', () => {
    const first = vi.fn();
    const second = vi.fn();
    const view = render(
      <BoardPrefsProvider boardId="b1" scope="roles" onOpenColumnVisibility={first}>
        <Probe scope="roles" />
      </BoardPrefsProvider>,
    );
    press('ouvrir roles');
    expect(first).toHaveBeenCalledTimes(1);
    view.rerender(
      <BoardPrefsProvider boardId="b1" scope="roles" onOpenColumnVisibility={second}>
        <Probe scope="roles" />
      </BoardPrefsProvider>,
    );
    press('ouvrir roles');
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
  });

  test('sans fournisseur : valeur neutre, aucune exception', () => {
    render(<Probe scope="roles" />);
    expect(hidden('roles')).toBe('');
    press('tout masquer roles');
    press('ouvrir roles');
    expect(hidden('roles')).toBe('');
  });
});
