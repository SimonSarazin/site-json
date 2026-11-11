import { fireEvent } from "@testing-library/react";

/**
 * Ce que jsdom ne fournit pas aux primitives Radix du site (menus, popovers) : `ResizeObserver`,
 * dont le Popper a besoin, et la capture de pointeur. Même parti que les tests de `cagnotte`
 * (`PiggyBankHeaderButton.test.tsx`) : des bouchons inertes, posés une fois.
 */
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

export function installRadixDom(): void {
  globalThis.ResizeObserver ??= ResizeObserverStub;
  const proto = window.HTMLElement.prototype;
  proto.hasPointerCapture ??= () => false;
  proto.releasePointerCapture ??= () => undefined;
  proto.scrollIntoView ??= () => undefined;
}

/**
 * Ouvre un `DropdownMenu` du site. Radix l'ouvre au `pointerdown` (bouton principal), que jsdom
 * ne sait pas produire fidèlement : on passe par le clavier, Entrée sur le déclencheur, qui est
 * aussi le geste d'une personne au clavier.
 */
export function openMenu(trigger: HTMLElement): void {
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "Enter" });
}
