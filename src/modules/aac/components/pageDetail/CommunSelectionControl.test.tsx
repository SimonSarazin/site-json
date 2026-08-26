// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/**
 * Le bouton publie — ou retire — un commun de l'annuaire de CET appel. Deux
 * invariants comptent plus que le rendu :
 *
 *  1. on n'écrit JAMAIS sans savoir sous quelle clé (`contextId`, étape,
 *     réponse) : une écriture au mauvais endroit s'enregistre sans erreur et
 *     reste invisible pour l'annuaire ;
 *  2. le chemin descend jusqu'au `contextId` — 9 des 59 réponses en base
 *     portent 2 ou 3 contextes, écrire la clé `choose` nue les effacerait.
 */

vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, fallback?: string, params?: Record<string, unknown>) => {
    const base = fallback ?? key;
    if (!params) return base;
    return Object.entries(params).reduce(
      (acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)),
      base
    );
  },
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));

const saveMutate = vi.fn();
let isPending = false;
vi.mock("@/modules/coform/actions/mutations/selection", () => ({
  useSaveChooseProposal: () => ({ mutate: saveMutate, isPending }),
}));

const { CommunSelectionControl } = await import("./CommunSelectionControl");

type Props = Parameters<typeof CommunSelectionControl>[0];

function poser(over: Partial<Props> = {}) {
  return render(
    <CommunSelectionControl
      api={{} as Props["api"]}
      isAdmin
      isSelected={false}
      contextId="677e7e13bd08b2478f5f5314"
      contextType="organizations"
      contextName="Fédération des CAE"
      subFormId="aapStep2"
      formId="6438366673d20a0de1533c77"
      answerId="answer-1"
      {...over}
    />
  );
}

/** Ouvre le dialogue puis valide. */
function cliquerPuisConfirmer(libelle: RegExp) {
  fireEvent.click(screen.getByRole("button", { name: libelle }));
  fireEvent.click(screen.getByRole("button", { name: /detail\.selection\.confirm/ }));
}

beforeEach(() => {
  saveMutate.mockClear();
  isPending = false;
});

describe("CommunSelectionControl — droits", () => {
  it("n'offre aucun bouton à un non-admin, seulement le statut", () => {
    poser({ isAdmin: false, isSelected: false });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("detail.selection.pending")).toBeTruthy();
  });

  it("affiche « Sélectionné » à un non-admin sur un commun retenu", () => {
    poser({ isAdmin: false, isSelected: true });
    expect(screen.getByText("detail.selection.selected")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("n'affiche RIEN quand le statut est indécidable", () => {
    // `null` = on ne sait pas sous quelle clé regarder (pas de question `choose`
    // résolue, ou pas de contexte). Afficher un statut serait une affirmation
    // sans fondement. Une réponse sans étape d'évaluation vaut « En attente »,
    // c'est un cas DIFFÉRENT.
    const { container } = poser({ isAdmin: false, isSelected: null });
    expect(container.textContent).toBe("");
  });
});

describe("CommunSelectionControl — écriture", () => {
  it("demande confirmation avant d'écrire", () => {
    poser();
    fireEvent.click(screen.getByRole("button", { name: /detail\.selection\.selectCta/ }));
    expect(saveMutate).not.toHaveBeenCalled();
  });

  it("écrit `selected` sous le contexte, l'étape et rien d'autre", () => {
    poser();
    cliquerPuisConfirmer(/detail\.selection\.selectCta/);
    expect(saveMutate).toHaveBeenCalledTimes(1);
    expect(saveMutate.mock.calls[0][0]).toEqual({
      subFormId: "aapStep2",
      contextId: "677e7e13bd08b2478f5f5314",
      entry: { value: "selected", type: "organizations", name: "Fédération des CAE" },
    });
  });

  it("écrit `notselected` — jamais null, jamais {} — à la désélection", () => {
    // `null` déclencherait un $unset et `{}` un 500 côté SDK. Le legacy écrit
    // la trace explicite, le backend traite l'absence à l'identique.
    poser({ isSelected: true });
    cliquerPuisConfirmer(/detail\.selection\.deselectCta/);
    expect(saveMutate.mock.calls[0][0].entry).toEqual({
      value: "notselected",
      type: "organizations",
      name: "Fédération des CAE",
    });
  });

  it("n'écrit rien si l'utilisateur annule", () => {
    poser();
    fireEvent.click(screen.getByRole("button", { name: /detail\.selection\.selectCta/ }));
    fireEvent.click(screen.getByRole("button", { name: /detail\.selection\.cancel/ }));
    expect(saveMutate).not.toHaveBeenCalled();
  });
});

describe("CommunSelectionControl — refus d'écrire à l'aveugle", () => {
  it.each([
    ["contexte", { contextId: null }],
    ["étape", { subFormId: null }],
    ["réponse", { answerId: null }],
  ])("retombe sur le statut seul quand il manque le %s", (_quoi, over) => {
    poser({ isSelected: false, ...over });
    expect(screen.queryByRole("button")).toBeNull();
    // Le statut RESTE lisible : c'est une lecture, elle ne risque rien.
    expect(screen.getByText("detail.selection.pending")).toBeTruthy();
  });
});

describe("CommunSelectionControl — libellés", () => {
  it("bascule sur une phrase SANS nom quand le contexte n'en a pas", () => {
    // Le legacy écrit `parent[<id>] = {id, type}` sans `name`, et le déplacement
    // d'un formulaire DÉTRUIT un `name` existant : sans repli, le dialogue
    // annoncerait « l'annuaire de « » ».
    poser({ contextName: null });
    fireEvent.click(screen.getByRole("button", { name: /detail\.selection\.selectCta/ }));
    expect(screen.getByText("detail.selection.descriptionNoName.confirmSelect")).toBeTruthy();
  });

  it("garde la phrase nommée quand le contexte a un nom", () => {
    poser();
    fireEvent.click(screen.getByRole("button", { name: /detail\.selection\.selectCta/ }));
    expect(screen.getByText(/detail\.selection\.confirmSelect\.description/)).toBeTruthy();
  });
});

describe("CommunSelectionControl — écriture en cours", () => {
  it("désactive le déclencheur pendant l'enregistrement", () => {
    isPending = true;
    poser();
    const bouton = screen.getByRole("button", { name: /detail\.selection\.selectCta/ });
    expect(bouton.hasAttribute("disabled")).toBe(true);
  });
});
