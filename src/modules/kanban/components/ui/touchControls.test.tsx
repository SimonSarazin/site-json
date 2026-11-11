// @vitest-environment jsdom
/**
 * GARDE DU DOIGT « AIMANTE » PAR UNE COMMANDE (`stopTouchOnControls`).
 *
 * Chrome attribue un appui tactile a la commande la plus proche (ajustement
 * tactile). Le conteneur des commandes d'une fiche ne doit arreter l'appui que
 * si le doigt est REELLEMENT dessus ; sinon l'appui revient a la fiche, qui doit
 * pouvoir se saisir. jsdom n'a pas de mise en page : `elementFromPoint` est
 * simule, c'est lui qui dit ce qu'il y a sous le doigt.
 */
import '@/modules/kanban/i18n';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { MemberCard } from '@/modules/kanban/components/roles/MemberCard';
import { stopTouchOnControls } from './touchControls';

const original = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');

afterEach(() => {
  cleanup();
  if (original) Object.defineProperty(document, 'elementFromPoint', original);
  else Reflect.deleteProperty(document, 'elementFromPoint');
});

/** Ce que le navigateur trouverait sous le doigt. */
function underFinger(element: () => Element | null) {
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(element) });
}

function mount() {
  const onCardTouch = vi.fn();
  render(
    <article onTouchStart={onCardTouch}>
      <span>Portrait</span>
      <div onTouchStart={stopTouchOnControls}>
        <button type="button">Actions</button>
      </div>
    </article>,
  );
  return onCardTouch;
}

const touchMenu = () =>
  fireEvent.touchStart(screen.getByRole('button', { name: 'Actions' }), { touches: [{ clientX: 10, clientY: 10 }] });

describe('stopTouchOnControls', () => {
  test('doigt vraiment sur la commande : la fiche ne recoit rien', () => {
    const onCardTouch = mount();
    underFinger(() => screen.getByRole('button', { name: 'Actions' }));
    touchMenu();
    expect(onCardTouch).not.toHaveBeenCalled();
  });

  test('doigt a cote, appui attribue a la commande : il revient a la fiche', () => {
    const onCardTouch = mount();
    underFinger(() => screen.getByText('Portrait'));
    touchMenu();
    expect(onCardTouch).toHaveBeenCalledTimes(1);
  });

  test('point illisible : la commande garde son geste', () => {
    const onCardTouch = mount();
    underFinger(() => null);
    touchMenu();
    expect(onCardTouch).not.toHaveBeenCalled();
  });
});

/**
 * Le menu « ⋯ » de la fiche saisissable de la vue Rôles (la carte du tableau suit la même règle), touche « au doigt » : l'appui
 * remonte-t-il au-dela de ses commandes (vers la fiche et son capteur) ?
 */
describe('cablage dans les fiches', () => {
  function reachesBeyondControls(menu: HTMLElement, card: Element): { aside: boolean; onMenu: boolean } {
    const reached = vi.fn();
    document.body.addEventListener('touchstart', reached);
    try {
      underFinger(() => card);
      fireEvent.touchStart(menu, { touches: [{ clientX: 10, clientY: 10 }] });
      const aside = reached.mock.calls.length === 1;
      underFinger(() => menu);
      fireEvent.touchStart(menu, { touches: [{ clientX: 10, clientY: 10 }] });
      return { aside, onMenu: reached.mock.calls.length === 2 };
    } finally {
      document.body.removeEventListener('touchstart', reached);
    }
  }

  test('carte de membre (vue Rôles)', () => {
    const { container } = render(
      <MemberCard
        member={{ id: 'm1', type: 'citoyens', name: 'Tom Rivière', slug: 'tom', image: null, isAdmin: false, pending: false, roles: [] }}
        variant="member"
        canManage
        onOpenRoles={() => {}}
      />,
    );
    const card = container.querySelector('article');
    if (card === null) throw new Error('fiche introuvable');
    const menu = screen.getByRole('button', { name: 'Actions sur Tom Rivière' });
    expect(reachesBeyondControls(menu, card)).toEqual({ aside: true, onMenu: false });
  });
});
