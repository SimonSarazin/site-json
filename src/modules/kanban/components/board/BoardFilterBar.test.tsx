// @vitest-environment jsdom
/**
 * GARDE DE LA BARRE DE FILTRES DU TABLEAU (DESIGN §6.2, maquette 2).
 *
 * Reprise de co-kanban (`tests/unit/boardFilterBar.test.tsx`). Ce fichier monte la barre AVEC
 * l'etat reel de la vue (`useBoardSearch`) et un temoin qui applique le moteur pur
 * (`filterCards`) : il verrouille que cocher dans un popover change bien ce que le tableau
 * affiche — pas seulement l'apparence du bouton.
 *  - Assignés, Priorité, Étiquettes, Échéance, Statut ; Jalon sur un board-lien
 *    seulement ;
 *  - une case cochee filtre, le declencheur annonce le nombre de valeurs ;
 *  - « Effacer » vide la facette, « Retirer le filtre » vide tout ;
 *  - la recherche libre filtre sur le titre ;
 *  - les compteurs des choix portent sur TOUT le tableau.
 */
import '@/modules/kanban/i18n';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { BoardFilterBar } from '@/modules/kanban/components/board/BoardFilterBar';
import { useBoardSearch } from '@/modules/kanban/components/board/boardSearch';
import { installRadixDom } from '@/modules/kanban/__fixtures__/radixDom';
import { MILESTONES, makeAction, makeCard, makeColumn, makeLinkSnapshot, makeSnapshot } from '@/modules/kanban/__fixtures__/snapshot';
import { filterCards } from '@/modules/kanban/lib/boardFilter';
import type { BoardSnapshot } from '@/modules/kanban/types';

beforeAll(installRadixDom);
afterEach(cleanup);

const [CLOSED, OPEN] = MILESTONES;

function linkSnapshot(): BoardSnapshot {
  return makeLinkSnapshot({
    cards: [
      makeAction('66aa00000000000000000001', 'todo', { title: 'Bulle de discussion', priority: 'urgent', assignees: ['u1'] }),
      makeAction('66aa00000000000000000002', 'next', {
        title: 'Endpoint icalendar',
        priority: 'medium',
        milestone: { milestoneId: OPEN.milestoneId, name: OPEN.name, status: 'open' },
      }),
      makeAction('66aa00000000000000000003', 'done', { title: 'Notifications lues' }),
    ],
  });
}

/** La barre, et un temoin : les titres que le tableau afficherait avec les criteres courants. */
function Harness({ snapshot }: { snapshot: BoardSnapshot }) {
  const search = useBoardSearch();
  return (
    <>
      <BoardFilterBar snapshot={snapshot} search={search} />
      <ul aria-label="Cartes visibles">
        {filterCards(snapshot, search.criteria).map((card) => (
          <li key={card._id}>{card.title}</li>
        ))}
      </ul>
    </>
  );
}

function mount(snapshot: BoardSnapshot) {
  return render(<Harness snapshot={snapshot} />);
}

function visibleTitles(): string[] {
  return within(screen.getByRole('list', { name: 'Cartes visibles' }))
    .queryAllByRole('listitem')
    .map((item) => item.textContent ?? '');
}

test('les cinq filtres de la maquette, plus le jalon sur un board-lien', () => {
  mount(linkSnapshot());
  const bar = screen.getByRole('search', { name: 'Recherche et filtres du tableau' });
  for (const name of ['Assignés', 'Priorité', 'Étiquettes', 'Échéance', 'Statut', 'Jalon']) {
    expect(within(bar).getByRole('button', { name })).toBeTruthy();
  }
});

test('un tableau sans jalons (board kanban) n a pas de filtre de jalon', () => {
  mount(
    makeSnapshot({
      columns: [makeColumn('col1', 1000)],
      cards: [makeCard('c1', 'col1', { title: 'Commander le plan de travail' })],
    }),
  );
  expect(screen.queryByRole('button', { name: 'Jalon' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Priorité' })).toBeTruthy();
});

test('cocher une priorite filtre les vues et le declencheur compte la valeur', () => {
  mount(linkSnapshot());
  expect(visibleTitles()).toHaveLength(3);

  fireEvent.click(screen.getByRole('button', { name: 'Priorité' }));
  const panel = screen.getByRole('dialog', { name: 'Priorité' });
  // Rendu dans un PORTAIL : le panneau porte lui-même la racine des variables du module, sans
  // quoi les points de priorité perdaient leur couleur.
  expect(panel.closest('.kanban-module')).not.toBeNull();
  // Compteurs sur TOUT le tableau : « Aucune » compte la carte sans priorite.
  const urgent = within(panel).getByRole('checkbox', { name: /Urgente/ });
  expect(urgent.closest('label')?.textContent).toMatch(/Urgente\s*1/);
  expect(within(panel).getByRole('checkbox', { name: /Aucune/ }).closest('label')?.textContent).toMatch(/1$/);

  fireEvent.click(urgent);
  expect(visibleTitles()).toEqual(['Bulle de discussion']);
  // Le declencheur dit combien de valeurs sont cochees (chiffre + texte).
  expect(screen.getByRole('button', { name: /Priorité.*1 valeur cochée/ })).toBeTruthy();

  // « Effacer » vide la facette.
  fireEvent.click(within(panel).getByRole('button', { name: 'Effacer' }));
  expect(visibleTitles()).toHaveLength(3);
});

test('« Non assignées » passe par le booleen du moteur', () => {
  mount(linkSnapshot());
  fireEvent.click(screen.getByRole('button', { name: 'Assignés' }));
  const panel = screen.getByRole('dialog', { name: 'Assignés' });
  fireEvent.click(within(panel).getByRole('checkbox', { name: /Non assignées/ }));
  expect(visibleTitles()).toEqual(['Endpoint icalendar', 'Notifications lues']);
});

test('le filtre de jalon propose ouverts, clos et « sans jalon »', () => {
  mount(linkSnapshot());
  fireEvent.click(screen.getByRole('button', { name: 'Jalon' }));
  const panel = screen.getByRole('dialog', { name: 'Jalon' });
  expect(within(panel).getByRole('checkbox', { name: new RegExp(OPEN.name) })).toBeTruthy();
  expect(within(panel).getByRole('checkbox', { name: new RegExp(`${CLOSED.name} \\(clos\\)`) })).toBeTruthy();
  fireEvent.click(within(panel).getByRole('checkbox', { name: /Sans jalon/ }));
  expect(visibleTitles()).toEqual(['Bulle de discussion', 'Notifications lues']);
});

test('« Retirer le filtre » remet tout a zero ; la recherche libre filtre le titre', () => {
  mount(linkSnapshot());
  fireEvent.click(screen.getByRole('button', { name: 'Statut' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Statut' })).getByRole('checkbox', { name: /Terminé/ }));
  expect(visibleTitles()).toEqual(['Notifications lues']);

  fireEvent.click(screen.getByRole('button', { name: 'Retirer le filtre' }));
  expect(visibleTitles()).toHaveLength(3);
  expect(screen.queryByRole('button', { name: /Retirer/ })).toBeNull();

  fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher dans ce tableau' }), {
    target: { value: 'icalendar' },
  });
  expect(visibleTitles()).toEqual(['Endpoint icalendar']);
});

/*
 * CONSTAT #104 — le RESULTAT d'un filtrage s'annonce (WCAG 4.1.3), apres une
 * pause dans la frappe, dans une region montee des le premier rendu.
 */
test('le résultat d’une recherche s’annonce : combien de cartes correspondent, sur combien', async () => {
  mount(linkSnapshot());
  const bar = screen.getByRole('search', { name: 'Recherche et filtres du tableau' });
  const region = () => bar.querySelector('p[role="status"]');
  // Montee a vide : rien n'est annonce a l'ouverture du tableau.
  expect(region()).not.toBeNull();
  expect(region()?.textContent).toBe('');

  fireEvent.change(within(bar).getByRole('searchbox'), { target: { value: 'bulle' } });
  await waitFor(() => expect(region()?.textContent).toContain('1 carte correspond, sur 3.'), { timeout: 2000 });

  fireEvent.change(within(bar).getByRole('searchbox'), { target: { value: '' } });
  await waitFor(() => expect(region()?.textContent).toContain('Aucun filtre : 3 cartes au total.'), { timeout: 2000 });
});
