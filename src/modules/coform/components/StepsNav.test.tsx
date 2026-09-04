// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, fallback?: string) => fallback ?? key,
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => undefined }));

import { StepsNav } from "./StepsNav";
import { buildStepItems } from "../utils/stepsNav";
import type { SubFormFields } from "../types";

/**
 * En-tête de navigation entre étapes.
 *
 * Ce qui est vérifié ici, c'est ce qui casse en silence : la fenêtre au-delà de
 * 6 étapes, le rail qui doit rester pointillé autour d'une étape sautée, une
 * étape réservée qui ne doit pas être atteignable, et le fait qu'une étape sans
 * nom n'en reçoive pas un d'office.
 */
const steps = (count: number, name = (i: number) => `Étape ${i + 1}`): SubFormFields[] =>
  Array.from({ length: count }, (_, i) => ({
    subFormId: `s${i}`,
    subFormName: name(i),
    fields: [],
  }));

/** La fenêtre d'ordinateur ; le rendu téléphone est le second bloc du <nav>. */
const railWindow = (container: HTMLElement) => {
  const list = container.querySelector("ol");
  if (!list) throw new Error("aucune fenêtre d'étapes rendue");
  return list;
};

const renderNav = (
  args: Parameters<typeof buildStepItems>[0],
  onStepSelect = vi.fn()
) => {
  const utils = render(
    <StepsNav
      steps={buildStepItems(args)}
      currentIndex={args.currentIndex}
      onStepSelect={onStepSelect}
    />
  );
  return { ...utils, onStepSelect };
};

describe("StepsNav — fenêtre", () => {
  it("montre les 4 étapes du cas courant, sans nœud de débordement", () => {
    const { container } = renderNav({
      steps: steps(4),
      currentIndex: 0,
      completedIds: [],
    });

    const buttons = within(railWindow(container)).getAllByRole("button");
    expect(buttons).toHaveLength(4);
    expect(within(railWindow(container)).queryByText("⋯")).toBeNull();
  });

  it("à 13 étapes, n'en montre que 5 autour de la courante, entre deux « ⋯ »", () => {
    const { container } = renderNav({
      steps: steps(13),
      currentIndex: 6,
      completedIds: [],
    });

    const win = railWindow(container);
    expect(within(win).getAllByText("⋯")).toHaveLength(2);
    // Fenêtre centrée : étapes 5 à 9 (indices 4 à 8).
    expect(within(win).getByText("Étape 5")).toBeTruthy();
    expect(within(win).getByText("Étape 9")).toBeTruthy();
    expect(within(win).queryByText("Étape 4")).toBeNull();
    expect(within(win).queryByText("Étape 10")).toBeNull();
  });
});

describe("StepsNav — navigation", () => {
  it("remonte l'index de l'étape cliquée", async () => {
    const user = userEvent.setup();
    const { container, onStepSelect } = renderNav({
      steps: steps(4),
      currentIndex: 0,
      completedIds: [],
    });

    await user.click(within(railWindow(container)).getByText("Étape 3"));
    expect(onStepSelect).toHaveBeenCalledWith(2);
  });

  it("laisse sauter de la 1 à la 3 : aucune étape n'est barrée par une autre", () => {
    const { container } = renderNav({
      steps: steps(4),
      currentIndex: 0,
      completedIds: [],
    });

    const buttons = within(railWindow(container)).getAllByRole("button");
    expect(buttons.every((b) => b.getAttribute("aria-disabled") === null)).toBe(true);
  });

  it("ne rend pas une étape réservée atteignable", async () => {
    const user = userEvent.setup();
    const { container, onStepSelect } = renderNav({
      steps: steps(4),
      currentIndex: 0,
      completedIds: [],
      lockedIds: ["s2"],
    });

    const bouton = within(railWindow(container)).getByText("Étape 3").closest("button")!;
    // `aria-disabled` et non `disabled` : l'étape reste annonçable et atteignable
    // au clavier, mais elle ne mène nulle part.
    expect(bouton.getAttribute("aria-disabled")).toBe("true");
    expect(bouton.disabled).toBe(false);
    await user.click(bouton);
    expect(onStepSelect).not.toHaveBeenCalled();
  });

  it("ne mène nulle part quand la navigation libre est coupée", async () => {
    const user = userEvent.setup();
    const { container, onStepSelect } = renderNav({
      steps: steps(4),
      currentIndex: 0,
      completedIds: [],
      navigable: false,
    });

    const buttons = within(railWindow(container)).getAllByRole("button");
    expect(buttons.every((b) => b.getAttribute("aria-disabled") === "true")).toBe(true);
    await user.click(buttons[2]);
    expect(onStepSelect).not.toHaveBeenCalled();
  });
});

const railsOf = (button: HTMLElement) =>
  Array.from(button.querySelectorAll("span[aria-hidden='true'].absolute"));

describe("StepsNav — rail", () => {

  it("relie deux étapes atteintes par un trait plein", () => {
    const { container } = renderNav({
      steps: steps(4),
      currentIndex: 1,
      completedIds: ["s0"],
    });

    const deuxieme = within(railWindow(container)).getByText("Étape 2").closest("button")!;
    const [rail] = railsOf(deuxieme);
    expect(rail.className).toContain("border-primary");
    expect(rail.className).not.toContain("border-dashed");
  });

  it("laisse les deux segments autour d'une étape sautée en pointillé", () => {
    // On est arrivé sur la 3 sans passer par la 2.
    const { container } = renderNav({
      steps: steps(4),
      currentIndex: 2,
      completedIds: ["s0"],
    });

    const win = railWindow(container);
    const deux = within(win).getByText("Étape 2").closest("button")!;
    const trois = within(win).getByText("Étape 3").closest("button")!;
    expect(railsOf(deux)[0].className).toContain("border-dashed");
    expect(railsOf(trois)[0].className).toContain("border-dashed");
  });

  it("passe en rouge de part et d'autre d'une étape à corriger", () => {
    const { container } = renderNav({
      steps: steps(4),
      currentIndex: 2,
      completedIds: ["s0"],
      errorIds: ["s1"],
    });

    const win = railWindow(container);
    const deux = within(win).getByText("Étape 2").closest("button")!;
    const trois = within(win).getByText("Étape 3").closest("button")!;
    expect(railsOf(deux)[0].className).toContain("border-destructive");
    expect(railsOf(trois)[0].className).toContain("border-destructive");
  });

  it("part du « ⋯ » et non d'une demi-largeur d'étape en tête de fenêtre", () => {
    // Le voisin de gauche n'est pas une pastille `flex-1` mais le nœud « ⋯ »,
    // bien plus étroit : la géométrie « −50 % » le traverserait et peindrait
    // par-dessus lui.
    const { container } = renderNav({
      steps: steps(13),
      currentIndex: 6,
      completedIds: [],
    });

    const win = railWindow(container);
    const premiere = within(win).getByText("Étape 5").closest("button")!;
    const deuxieme = within(win).getByText("Étape 6").closest("button")!;
    expect(railsOf(premiere)[0].className).toContain("left-[-0.25rem]");
    expect(railsOf(deuxieme)[0].className).toContain("left-[calc(-50%-0.25rem+1rem)]");
  });

  it("prolonge le rail vers les « ⋯ » aux deux bouts de la fenêtre", () => {
    const { container } = renderNav({
      steps: steps(13),
      currentIndex: 6,
      completedIds: [],
    });

    const boutons = within(railWindow(container))
      .getAllByRole("button")
      .filter((b) => !b.textContent?.includes("⋯"));
    // La première de la fenêtre reçoit un rail (vers le « ⋯ » de gauche),
    // la dernière en reçoit deux (le sien, plus celui qui part vers la droite).
    expect(railsOf(boutons[0])).toHaveLength(1);
    expect(railsOf(boutons[boutons.length - 1])).toHaveLength(2);
  });
});

describe("StepsNav — étape sans nom", () => {
  it("n'invente pas de libellé", () => {
    const { container } = renderNav({
      steps: steps(4, () => ""),
      currentIndex: 0,
      completedIds: [],
    });

    const buttons = within(railWindow(container)).getAllByRole("button");
    // Il ne reste que le numéro dans la pastille.
    expect(buttons.map((b) => b.textContent)).toEqual(["1", "2", "3", "4"]);
  });
});

describe("StepsNav — largeur imposée", () => {
  /**
   * Mesuré dans un vrai navigateur, modale ouverte à 390 px : avec `truncate`
   * (donc `white-space: nowrap`), la largeur min-content du nom d'étape était
   * la phrase entière ; `DialogContent` étant une GRILLE, cette largeur
   * remontait à la piste et étirait toute la modale — 452 px de contenu pour
   * 356 de large. jsdom ne mesure pas : ce test garde les deux classes qui
   * empêchent le composant d'imposer sa largeur à son conteneur.
   */
  it("ne pose pas de nowrap sur le nom d'étape et laisse le bouton rétrécir", () => {
    const { container } = renderNav({
      steps: steps(4, () => "Autorisation d'utilisation des données personnelles"),
      currentIndex: 0,
      completedIds: [],
    });

    const mobile = container.querySelector(".md\\:hidden button")!;
    expect(mobile.className).toContain("min-w-0");
    const nom = mobile.querySelector(".line-clamp-1");
    expect(nom).not.toBeNull();
    expect(mobile.querySelector(".truncate")).toBeNull();
  });
});

describe("StepsNav — sommaire", () => {
  it("liste toutes les étapes, y compris celles hors fenêtre, et y navigue", async () => {
    const user = userEvent.setup();
    const { onStepSelect } = renderNav({
      steps: steps(13),
      currentIndex: 6,
      completedIds: [],
    });

    await user.click(screen.getAllByText("coform.steps.allSteps")[0]);

    const dialogue = await screen.findByRole("dialog");
    expect(within(dialogue).getAllByRole("button")).toHaveLength(13);

    await user.click(within(dialogue).getByText("Étape 12"));
    expect(onStepSelect).toHaveBeenCalledWith(11);
  });

  it("propose d'aller à la première étape à corriger", async () => {
    const user = userEvent.setup();
    const { onStepSelect } = renderNav({
      steps: steps(4),
      currentIndex: 3,
      completedIds: ["s0"],
      errorIds: ["s1", "s2"],
    });

    await user.click(screen.getAllByText("coform.steps.allSteps")[0]);
    const dialogue = await screen.findByRole("dialog");

    await user.click(within(dialogue).getByText("coform.steps.goToFirstError"));
    expect(onStepSelect).toHaveBeenCalledWith(1);
  });

  it("n'offre pas ce raccourci vers une étape qu'on n'a pas le droit d'atteindre", async () => {
    const user = userEvent.setup();
    renderNav({
      steps: steps(4),
      currentIndex: 0,
      completedIds: [],
      errorIds: ["s2"],
      navigable: false,
    });

    await user.click(screen.getAllByText("coform.steps.allSteps")[0]);
    const dialogue = await screen.findByRole("dialog");

    expect(within(dialogue).queryByText("coform.steps.goToFirstError")).toBeNull();
  });

  it("n'affiche pas ce raccourci quand rien n'est à corriger", async () => {
    const user = userEvent.setup();
    renderNav({ steps: steps(4), currentIndex: 0, completedIds: [] });

    await user.click(screen.getAllByText("coform.steps.allSteps")[0]);
    const dialogue = await screen.findByRole("dialog");

    expect(within(dialogue).queryByText("coform.steps.goToFirstError")).toBeNull();
  });
});
