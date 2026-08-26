// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { FormFieldMapping } from "../types";

/**
 * Ce champ décide de la publication d'une candidature dans l'annuaire, et son
 * scope est le CONTEXTE (le costum), pas l'évaluateur. Les tests portent donc
 * surtout sur l'isolation : ce qui est écrit ne doit toucher qu'un contexte.
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

const ctxMock = vi.fn();
vi.mock("@/hooks/useCocolight", () => ({
  useCocolightOptional: () => ctxMock(),
}));

const saveMutate = vi.fn();
vi.mock("../actions/mutations/selection", () => ({
  useSaveChooseProposal: () => ({ mutate: saveMutate }),
}));

const { ChooseProposalField } = await import("./ChooseProposalField");

const champ = (): FormFieldMapping =>
  ({
    name: "choose",
    label: "Sélectionné pour l'afficher dans le 'directory'",
    type: "tpls.forms.aap.chooseProposal",
    componentType: "chooseProposal",
    isRequired: false,
  }) as unknown as FormFieldMapping;

/** Cas réel : trois contextes, deux retenus. */
const TROIS = {
  ctxA: { value: "selected", type: "organizations", name: "Costum A" },
  ctxB: { value: "notselected", type: "organizations", name: "Costum B" },
  ctxC: { value: "selected", type: "projects", name: "Costum C" },
};

function poser(over: Partial<Parameters<typeof ChooseProposalField>[0]> = {}) {
  return render(
    <ChooseProposalField
      field={champ()}
      subFormId="aapStep2"
      formId="form-1"
      value={TROIS}
      answerId="answer-1"
      {...over}
    />
  );
}

describe("ChooseProposalField", () => {
  beforeEach(() => {
    saveMutate.mockClear();
    ctxMock.mockReturnValue({
      api: {},
      entity: { name: "Costum A" },
      contextId: "ctxA",
      contextType: "organizations",
    });
  });

  it("ne rend RIEN sans réponse enregistrée", () => {
    const { container } = poser({ answerId: undefined });
    expect(container.firstChild).toBeNull();
  });

  it("ne rend RIEN sans contexte identifié", () => {
    // On ne saurait pas sous quelle clé écrire ; se tromper publierait la
    // candidature dans le mauvais annuaire.
    ctxMock.mockReturnValue({ api: {}, entity: null, contextId: null });
    const { container } = poser();
    expect(container.firstChild).toBeNull();
  });

  it("reflète l'état DU CONTEXTE COURANT, pas celui des autres", () => {
    poser();
    const [oui, non] = screen.getAllByRole("radio");
    expect(oui.getAttribute("aria-checked")).toBe("true");
    expect(non.getAttribute("aria-checked")).toBe("false");
  });

  it("un contexte non retenu s'affiche bien comme non retenu", () => {
    ctxMock.mockReturnValue({ api: {}, entity: { name: "Costum B" }, contextId: "ctxB" });
    poser();
    const [oui] = screen.getAllByRole("radio");
    expect(oui.getAttribute("aria-checked")).toBe("false");
  });

  it("écrit au chemin du SEUL contexte courant", () => {
    ctxMock.mockReturnValue({
      api: {},
      entity: { name: "Costum B" },
      contextId: "ctxB",
      contextType: "organizations",
    });
    poser();
    fireEvent.click(screen.getAllByRole("radio")[0]); // « Oui »
    expect(saveMutate).toHaveBeenCalledWith({
      subFormId: "aapStep2",
      contextId: "ctxB",
      entry: { value: "selected", type: "organizations", name: "Costum B" },
    });
  });

  it("retirer le choix écrit `notselected`, ne supprime pas la clé", () => {
    poser();
    fireEvent.click(screen.getAllByRole("radio")[1]); // « Non »
    expect(saveMutate).toHaveBeenCalledWith(
      expect.objectContaining({ entry: expect.objectContaining({ value: "notselected" }) })
    );
  });

  it("n'écrit rien si on reclique sur le choix déjà en place", () => {
    poser();
    fireEvent.click(screen.getAllByRole("radio")[0]); // déjà « Oui »
    expect(saveMutate).not.toHaveBeenCalled();
  });

  it("signale les AUTRES costums qui ont retenu la candidature", () => {
    // Le legacy ne le dit pas : on croit décider pour tout le monde.
    poser();
    expect(screen.getByText(/Également retenu par : Costum C/)).toBeTruthy();
    expect(screen.queryByText(/Costum B/)).toBeNull(); // non retenu → pas listé
  });

  it("affiche le contexte quand la candidature est retenue", () => {
    poser();
    expect(screen.getByText(/Contexte : Costum A/)).toBeTruthy();
  });

  it("masque le contexte quand elle ne l'est pas — comme le legacy", () => {
    // Sur « Non » il n'y a pas de publication à rattacher : le legacy masque
    // la ligne (`$(".contextName").hide()`). Cas séparé du précédent : deux
    // `render()` dans un même `it` laisseraient les deux arbres dans le DOM.
    ctxMock.mockReturnValue({ api: {}, entity: { name: "Costum B" }, contextId: "ctxB" });
    poser();
    expect(screen.queryByText(/Contexte :/)).toBeNull();
  });

  it("en lecture seule : aucune écriture", () => {
    poser({ readOnly: true });
    fireEvent.click(screen.getAllByRole("radio")[1]);
    expect(saveMutate).not.toHaveBeenCalled();
  });
});
