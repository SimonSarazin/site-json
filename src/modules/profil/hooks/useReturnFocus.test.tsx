// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { useRef } from "react";

import { focusTarget, useReturnFocus } from "./useReturnFocus";

/**
 * Où rendre le focus à la fermeture d'une boîte ouverte depuis l'onglet « Structures » : nulle part
 * s'il est déjà sur un élément présent, sinon l'ouvreur s'il est encore là, sinon le premier repli
 * présent — et de nouveau quand la liste rechargée retire la ligne APRÈS la fermeture.
 */
const bouton = (label: string, attache = true) => {
  const el = document.createElement("button");
  el.textContent = label;
  if (attache) document.body.appendChild(el);
  return el;
};

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("focusTarget", () => {
  it("focus déjà sur un élément présent : on n'y touche pas", () => {
    const ailleurs = bouton("ailleurs");
    expect(focusTarget(ailleurs, bouton("ouvreur"), [bouton("repli")])).toBeNull();
  });

  it("focus perdu (body) : l'ouvreur s'il est encore dans le document", () => {
    const ouvreur = bouton("ouvreur");
    expect(focusTarget(document.body, ouvreur, [bouton("repli")])).toBe(ouvreur);
  });

  it("ouvreur retiré du document : le premier repli PRÉSENT", () => {
    const retire = bouton("ouvreur", false);
    const absent = bouton("repli absent", false);
    const repli = bouton("repli");
    expect(focusTarget(document.body, retire, [null, absent, repli])).toBe(repli);
  });

  it("élément actif retiré du document (la ligne qui avait le focus a disparu) : focus perdu", () => {
    const ligne = bouton("ligne");
    ligne.remove();
    const repli = bouton("repli");
    expect(focusTarget(ligne, ligne, [repli])).toBe(repli);
  });
});

/** Banc d'essai : une « ligne » ouvreuse, un repli, et `watch` qui simule l'arrivée de nouvelles données. */
function Banc({ ligne, watch }: { ligne: boolean; watch: number }) {
  const repliRef = useRef<HTMLButtonElement>(null);
  const { openerRef, returnFocus } = useReturnFocus([repliRef], watch);
  return (
    <div>
      <button ref={repliRef}>repli</button>
      {ligne && (
        <button
          onClick={(e) => {
            openerRef.current = e.currentTarget;
            returnFocus();
          }}
        >
          ligne
        </button>
      )}
    </div>
  );
}

describe("useReturnFocus", () => {
  it("la ligne disparaît au rechargement QUI SUIT la fermeture : le focus va au repli", () => {
    vi.useFakeTimers();
    const { getByText, rerender } = render(<Banc ligne watch={0} />);
    const ligne = getByText("ligne");
    ligne.focus();
    act(() => ligne.click());
    act(() => vi.runAllTimers());
    expect(document.activeElement).toBe(ligne);
    // Le rechargement retire la ligne (elle change de groupe) : le focus tombait sur `body`.
    rerender(<Banc ligne={false} watch={1} />);
    expect(document.activeElement).toBe(getByText("repli"));
  });

  it("hors de la fenêtre qui suit une fermeture, un rechargement ne déplace jamais le focus", () => {
    const { getByText, rerender } = render(<Banc ligne watch={0} />);
    getByText("ligne").focus();
    rerender(<Banc ligne={false} watch={1} />);
    expect(document.activeElement).toBe(document.body);
  });
});
