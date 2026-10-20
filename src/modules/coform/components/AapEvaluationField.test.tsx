// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { FormFieldMapping } from "../types";

vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, fallback?: string) => fallback ?? key,
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));

const meMock = vi.fn();
vi.mock("@/hooks/useCocolight", () => ({
  useCocolightOptional: () => ({ api: {}, entity: null, me: meMock() }),
}));

const noteMutate = vi.fn();
vi.mock("../actions/mutations/selection", () => ({
  useSaveAapEvaluationNote: () => ({ mutate: noteMutate }),
}));

const { AapEvaluationField } = await import("./AapEvaluationField");

const champ = (): FormFieldMapping =>
  ({
    name: "evaluation",
    label: "Évaluation",
    type: "tpls.forms.aap.evaluation",
    componentType: "aapEvaluation",
    isRequired: false,
  }) as unknown as FormFieldMapping;

/** Config relevée en base : coeffs et notes en CHAÎNES. */
const CONFIG = {
  activateLocalCriteria: true,
  type: "starCriterionBased",
  criterions: [
    { label: "Budget", coeff: "1", note: "0" },
    { label: "Humain", coeff: "2", note: "0" },
  ],
};

function poser(over: Partial<Parameters<typeof AapEvaluationField>[0]> = {}) {
  return render(
    <AapEvaluationField
      field={champ()}
      subFormId="aapStep3"
      formId="form-1"
      config={CONFIG}
      value={{ moi: { "0": { label: "Budget", note: 4, coeff: 1 } } }}
      answerId="answer-1"
      {...over}
    />
  );
}

// Second argument : les options `mutate` — c'est là que ces champs branchent
// leur écho local (cf. `useEcrituresLocales`). L'assertion porte sur le PAYLOAD ;
// figer l'arité ferait échouer le test pour une raison qui n'est pas la sienne.
describe("AapEvaluationField", () => {
  beforeEach(() => {
    noteMutate.mockClear();
    meMock.mockReturnValue({ id: "moi" });
  });

  it("ne rend RIEN sans réponse enregistrée", () => {
    const { container } = poser({ answerId: undefined });
    expect(container.firstChild).toBeNull();
  });

  it("affiche les critères et n'annonce le coefficient que s'il pondère", () => {
    poser();
    expect(screen.getByText("Budget")).toBeTruthy();
    expect(screen.getByText("Humain")).toBeTruthy();
    expect(screen.getByText("×2")).toBeTruthy();
    expect(screen.queryByText("×1")).toBeNull();
  });

  it("écrit l'objet COMPLET, pas la seule note", () => {
    // Le legacy enregistre `{label, note, coeff}` par critère.
    poser();
    // 5 étoiles par critère, chacune valant 2 points (note sur 10).
    fireEvent.click(screen.getAllByRole("radio")[2]);
    expect(noteMutate).toHaveBeenCalledWith(
      {
        subFormId: "aapStep3",
        userId: "moi",
        index: "0",
        value: { label: "Budget", note: 6, coeff: 1 },
      },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });

  it("restitue la note déjà saisie par l'évaluateur", () => {
    poser();
    // note 4 sur le 1er critère → les 2 premières étoiles (2 points chacune).
    const etoiles = screen.getAllByRole("radio");
    expect(etoiles[1].getAttribute("aria-checked")).toBe("true");
  });

  it("en lecture seule : aucune écriture", () => {
    poser({ readOnly: true });
    fireEvent.click(screen.getAllByRole("radio")[0]);
    expect(noteMutate).not.toHaveBeenCalled();
  });

  it("mode note libre : saisie au blur, bornée à 10", () => {
    poser({ config: { ...CONFIG, type: "noteCriterionBased" } });
    const champs = screen.getAllByRole("spinbutton");
    fireEvent.blur(champs[0], { target: { value: "7.5" } });
    expect(noteMutate).toHaveBeenCalledWith(
      expect.objectContaining({ index: "0", value: { label: "Budget", note: 7.5, coeff: 1 } }),
      expect.anything()
    );

    noteMutate.mockClear();
    fireEvent.blur(champs[1], { target: { value: "42" } });
    expect(noteMutate).not.toHaveBeenCalled(); // au-delà de 10, rien ne part
  });

  it("sans critère configuré : un message, pas une grille vide", () => {
    poser({ config: { criterions: [] } });
    expect(screen.getByText(/Aucun critère/)).toBeTruthy();
  });

  /**
   * H18 : les inputs de note vivent DANS le `<form>` de l'étape (sans
   * `noValidate`, boutons `type="submit"`). Avec `min`/`max`/`step`, une saisie
   * hors barème rendait le formulaire nativement invalide et bloquait « Suivant »
   * sans message — pendant que le champ refusait la note en silence.
   */
  describe("notation libre — refus visible, soumission native jamais bloquée", () => {
    const CONFIG_NOTE = { ...CONFIG, type: "noteCriterionBased" };

    it("une note hors barème ou hors pas ne rend plus le formulaire nativement invalide", () => {
      render(
        <form data-testid="etape">
          <AapEvaluationField
            field={champ()}
            subFormId="aapStep3"
            formId="form-1"
            config={CONFIG_NOTE}
            value={{ moi: { "0": { label: "Budget", note: 4, coeff: 1 } } }}
            answerId="answer-1"
          />
        </form>
      );
      const etape = screen.getByTestId("etape") as HTMLFormElement;
      const [budget] = screen.getAllByRole("spinbutton") as HTMLInputElement[];

      fireEvent.change(budget, { target: { value: "42" } }); // rangeOverflow avec max=10
      expect(etape.checkValidity()).toBe(true);

      fireEvent.change(budget, { target: { value: "3.7" } }); // stepMismatch avec step=0.5
      expect(etape.checkValidity()).toBe(true);
    });

    it("une note hors barème est refusée VISIBLEMENT et l'input revient à la note réelle", () => {
      poser({ config: CONFIG_NOTE });
      const [budget] = screen.getAllByRole("spinbutton") as HTMLInputElement[];

      // `change` puis `blur` séparés : RTL fait suivre `focusout` (celui que
      // React écoute) d'un `blur` natif qui réappliquerait `target.value`.
      fireEvent.change(budget, { target: { value: "42" } });
      fireEvent.blur(budget);
      expect(noteMutate).not.toHaveBeenCalled();
      expect(screen.getByRole("alert").textContent).toMatch(/entre 0 et/);
      expect(budget.getAttribute("aria-invalid")).toBe("true");
      // La note réelle (`moi.0.note = 4`) : le DOM ne montre pas un « 42 »
      // qui n'existe nulle part.
      expect(budget.value).toBe("4");

      // Une saisie valide ensuite : le message s'efface et la note part.
      fireEvent.change(budget, { target: { value: "7" } });
      fireEvent.blur(budget);
      expect(screen.queryByRole("alert")).toBeNull();
      expect(noteMutate).toHaveBeenCalledWith(
        expect.objectContaining({ index: "0", value: { label: "Budget", note: 7, coeff: 1 } }),
        expect.anything()
      );
    });
  });
});
