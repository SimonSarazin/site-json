// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";

import { ConditionalField } from "./ConditionalField";

/**
 * Enveloppe animée des champs à affichage conditionnel.
 *
 * Le test le plus important est le second : tant qu'un champ est masqué, sa
 * render-prop ne doit JAMAIS être appelée. C'est ce qui distingue ce composant
 * d'un simple `hidden` en CSS — les champs `finder` et `commonTable` déclenchent
 * des requêtes réseau au montage.
 */
describe("ConditionalField", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function poser(visible: boolean, rendu = vi.fn(() => <input data-testid="champ" />)) {
    const utils = render(
      <ConditionalField visible={visible} fieldName="f1" width="col-span-6">
        {rendu}
      </ConditionalField>,
    );
    return { ...utils, rendu };
  }

  it("rend le champ, ouvert et sans animation, quand il est visible d'emblée", () => {
    // Sinon tout le formulaire s'animerait à l'ouverture de la page.
    const { container } = poser(true);
    const enveloppe = container.querySelector("[data-field-name='f1']")!;
    expect(enveloppe.getAttribute("data-state")).toBe("open");
    expect(enveloppe.className).toContain("grid-rows-[1fr]");
    expect(enveloppe.className).toContain("col-span-6");
  });

  it("n'appelle JAMAIS la render-prop tant que le champ est masqué", () => {
    const { container, rendu } = poser(false);
    expect(rendu).not.toHaveBeenCalled();
    expect(container.querySelector("[data-field-name='f1']")).toBeNull();
  });

  it("monte le champ fermé puis l'ouvre à la frame suivante", () => {
    // Sans ce délai d'une frame, le navigateur n'a pas d'état de départ à
    // interpoler et la transition ne joue pas du tout.
    const rendu = vi.fn(() => <input data-testid="champ" />);
    const { container, rerender } = render(
      <ConditionalField visible={false} fieldName="f1">{rendu}</ConditionalField>,
    );
    rerender(<ConditionalField visible fieldName="f1">{rendu}</ConditionalField>);

    const enveloppe = () => container.querySelector("[data-field-name='f1']")!;
    expect(enveloppe().getAttribute("data-state")).toBe("closed");
    expect(rendu).toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(50); });
    expect(enveloppe().getAttribute("data-state")).toBe("open");
  });

  it("garde le champ monté pendant la fermeture, puis le démonte", () => {
    const rendu = vi.fn(() => <input data-testid="champ" />);
    const { container, rerender } = render(
      <ConditionalField visible fieldName="f1">{rendu}</ConditionalField>,
    );
    rerender(<ConditionalField visible={false} fieldName="f1">{rendu}</ConditionalField>);

    // Encore là, replié en cours, et déjà hors du parcours clavier.
    const enveloppe = container.querySelector("[data-field-name='f1']")!;
    expect(enveloppe.getAttribute("data-state")).toBe("closed");
    expect(enveloppe.hasAttribute("inert")).toBe(true);

    act(() => { vi.advanceTimersByTime(300); });
    expect(container.querySelector("[data-field-name='f1']")).toBeNull();
  });

  it("ne rogne le débordement que pendant le mouvement", () => {
    // En régime établi, `overflow-hidden` couperait anneaux de focus et ombres.
    const { container } = poser(true);
    const interne = container.querySelector("[data-field-name='f1']")!.firstElementChild!;
    expect(interne.className).not.toContain("overflow-hidden");
  });
});

/**
 * Cas de bord du cycle de vie — c'est là que se concentre le risque du
 * composant : deux timers (rAF pour l'ouverture, `setTimeout` pour le
 * démontage) et des ajustements d'état pendant le rendu.
 */
describe("ConditionalField — bascules pendant une transition", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const rendu = () => <input data-testid="champ" />;
  const vue = (visible: boolean) => (
    <ConditionalField visible={visible} fieldName="f1">{rendu}</ConditionalField>
  );

  it("réouvrir pendant la fermeture annule le démontage", () => {
    const { container, rerender } = render(vue(true));
    rerender(vue(false));
    rerender(vue(true));

    act(() => { vi.advanceTimersByTime(300); });
    const enveloppe = container.querySelector("[data-field-name='f1']");
    expect(enveloppe).not.toBeNull();
    expect(enveloppe!.getAttribute("data-state")).toBe("open");
  });

  it("fermer pendant l'ouverture démonte quand même", () => {
    // Le rAF est annulé par le nettoyage de l'effet : le champ ne doit pas
    // rester monté, invisible, indéfiniment.
    const { container, rerender } = render(vue(false));
    rerender(vue(true));
    rerender(vue(false));

    act(() => { vi.advanceTimersByTime(300); });
    expect(container.querySelector("[data-field-name='f1']")).toBeNull();
  });

  it("survit à un aller-retour rapide sans rester bloqué", () => {
    const { container, rerender } = render(vue(false));
    for (let i = 0; i < 5; i++) {
      rerender(vue(true));
      rerender(vue(false));
    }
    rerender(vue(true));
    act(() => { vi.advanceTimersByTime(300); });
    expect(container.querySelector("[data-field-name='f1']")!.getAttribute("data-state")).toBe("open");
  });

  it("ne rend rien quand le champ lui-même rend `null`", () => {
    // `params` admin absents : le chemin non animé fait `if (!fieldElement)
    // return null`. Sans la même garde ici, l'enveloppe réserverait une cellule
    // de grille vide — un trou de `col-span-*` + `gap-6` dans le formulaire.
    const { container } = render(
      <ConditionalField visible fieldName="f1">{() => null}</ConditionalField>,
    );
    expect(container.querySelector("[data-field-name='f1']")).toBeNull();
  });
});
