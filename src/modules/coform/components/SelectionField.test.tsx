// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { FormFieldMapping } from "../types";

/**
 * Ce champ ne ressemble pas à ses voisins, et c'est tout l'enjeu des tests :
 * il n'a ni `value` RHF ni entrée au schéma Zod, et chaque note part
 * immédiatement par CHEMIN CIBLÉ. Ce qui est vérifié ici, c'est donc surtout
 * *ce qui est envoyé*, et à quel chemin.
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

const meMock = vi.fn();
vi.mock("@/hooks/useCocolight", () => ({
  useCocolightOptional: () => ({ api: {}, entity: null, me: meMock() }),
}));

const noteMutate = vi.fn();
const admissibilityMutate = vi.fn();
vi.mock("../actions/mutations/selection", () => ({
  useSaveSelectionNote: () => ({ mutate: noteMutate }),
  useSaveAdmissibility: () => ({ mutate: admissibilityMutate }),
}));

const { SelectionField } = await import("./SelectionField");

const champ = (): FormFieldMapping =>
  ({
    name: "selection",
    label: "Évaluation",
    type: "tpls.forms.aap.selection",
    componentType: "selection",
    isRequired: false,
  }) as unknown as FormFieldMapping;

/** Config relevée en base : `criterions` en tableau, coeffs hétérogènes. */
const CONFIG = {
  criterions: [
    { fieldKey: "depense", coeff: "1" },
    { fieldKey: "axesTFPB", coeff: 2, fieldLabel: "Axes TFPB" },
  ],
  unassociatedCriterions: [{ fieldKey: "fieldKey0", coeff: 1, fieldLabel: "Critère libre" }],
};

function poser(over: Partial<Parameters<typeof SelectionField>[0]> = {}) {
  return render(
    <SelectionField
      field={champ()}
      subFormId="aapStep2"
      formId="form-1"
      config={CONFIG}
      value={{ moi: { depense: 4, axesTFPB: 2 } }}
      admissibility={{}}
      depositAnswers={{
        depense: { 0: { price: 1500 }, 1: { price: 500 } },
        axesTFPB: "Axe 5",
      }}
      depositLabels={{ depense: "Budget demandé" }}
      answerId="answer-1"
      {...over}
    />
  );
}

describe("SelectionField", () => {
  beforeEach(() => {
    noteMutate.mockClear();
    admissibilityMutate.mockClear();
    meMock.mockReturnValue({ id: "moi" });
  });

  it("ne rend RIEN sans réponse enregistrée", () => {
    // L'écriture cible un document existant ; sans lui, un widget n'écrirait
    // nulle part. Relevé : 0 occurrence à l'étape de dépôt, mais rien n'empêche
    // un admin d'y déplacer l'input.
    const { container } = poser({ answerId: undefined });
    expect(container.firstChild).toBeNull();
  });

  it("affiche les critères, leur libellé résolu et la valeur du candidat", () => {
    poser();
    // `fieldLabel` absent → on retombe sur le label de la question de dépôt.
    expect(screen.getByText("Budget demandé")).toBeTruthy();
    expect(screen.getByText("Axes TFPB")).toBeTruthy();
    expect(screen.getByText("Critère libre")).toBeTruthy();
    // `depense` s'affiche comme la SOMME des lignes, pas comme une liste.
    expect(screen.getByText("2000")).toBeTruthy();
    expect(screen.getByText("Axe 5")).toBeTruthy();
  });

  it("n'affiche le coefficient que lorsqu'il pondère vraiment", () => {
    poser();
    expect(screen.getByText("×2")).toBeTruthy();
    // `coeff: "1"` (chaîne) retombe à 1 côté legacy → rien à afficher.
    expect(screen.queryByText("×1")).toBeNull();
  });

  it("une note part immédiatement, au chemin de l'évaluateur courant", () => {
    poser();
    // 3 critères × 5 étoiles ; on clique la 3e étoile du premier critère.
    const etoiles = screen.getAllByRole("radio");
    fireEvent.click(etoiles[2]);
    expect(noteMutate).toHaveBeenCalledTimes(1);
    expect(noteMutate).toHaveBeenCalledWith({
      subFormId: "aapStep2",
      userId: "moi",
      fieldKey: "depense",
      note: 3,
    });
  });

  it("calcule les deux moyennes en pondérant", () => {
    // moi : (4×1 + 2×2 + 0×1) / 4 = 2 ; seul évaluateur → même moyenne globale.
    poser();
    expect(screen.getAllByText("2 / 5").length).toBe(2);
  });

  it("en lecture seule : ni notation ni bloc d'admissibilité", () => {
    poser({ readOnly: true });
    fireEvent.click(screen.getAllByRole("radio")[0]);
    expect(noteMutate).not.toHaveBeenCalled();
    expect(screen.queryByText("Admissibilité")).toBeNull();
  });

  it("enregistre un avis d'admissibilité", () => {
    poser();
    fireEvent.click(screen.getByText("Admissible"));
    expect(admissibilityMutate).toHaveBeenCalledWith({
      subFormId: "aapStep2",
      userId: "moi",
      value: "admissible",
    });
  });

  it("signale un avis posé par un AUTRE écran au lieu d'afficher « non admissible »", () => {
    // `admissibility` porte aussi `instruction` (16) et `rejected` (10) en base.
    // Le legacy les affiche comme « NON », ce qui est faux.
    poser({ admissibility: { moi: "instruction" } });
    expect(screen.getByText(/instruction/)).toBeTruthy();
  });

  it("sans critère configuré : un message, pas une grille vide ni NaN", () => {
    // 76 formulaires sur 92 sont dans ce cas.
    poser({ config: {} });
    expect(screen.getByText(/Aucun critère/)).toBeTruthy();
    expect(screen.queryByText(/NaN/)).toBeNull();
  });
});
