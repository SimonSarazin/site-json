import { describe, it, expect } from "vitest";
import {
  parseAapEvaluationConfig,
  isLocalCriteriaActive,
  buildCriterionValue,
  isNoteValid,
  toNumber,
  AAP_EVALUATION_NOTE_MAX,
} from "./aapEvaluation";

/**
 * Config relevée en base — coeffs et notes y sont des CHAÎNES, et `criterions`
 * est un tableau : `{"activateLocalCriteria":true,"whoCanEvaluate":"",
 * "type":"starCriterionBased","criterions":[{"label":"Budget","coeff":"1","note":"0"}]}`
 */
const CONFIG = {
  activateLocalCriteria: true,
  whoCanEvaluate: "",
  type: "starCriterionBased",
  criterions: [
    { label: "Budget", coeff: "1", note: "0" },
    { label: "Contribution au Commun", coeff: "2", note: "0" },
  ],
};

describe("toNumber", () => {
  it("coerce les chaînes, qui sont la forme réelle en base", () => {
    expect(toNumber("1")).toBe(1);
    expect(toNumber("3.5")).toBe(3.5);
    expect(toNumber("3,5")).toBe(3.5);
  });

  it("retombe sur le défaut fourni", () => {
    expect(toNumber(undefined, 1)).toBe(1);
    expect(toNumber("", 1)).toBe(1);
    expect(toNumber(null)).toBe(0);
  });
});

describe("isLocalCriteriaActive", () => {
  it("accepte le booléen ET la chaîne, comme le legacy", () => {
    expect(isLocalCriteriaActive({ activateLocalCriteria: true })).toBe(true);
    expect(isLocalCriteriaActive({ activateLocalCriteria: "true" })).toBe(true);
  });

  it("faux sinon", () => {
    expect(isLocalCriteriaActive({ activateLocalCriteria: false })).toBe(false);
    expect(isLocalCriteriaActive({})).toBe(false);
    expect(isLocalCriteriaActive(undefined)).toBe(false);
  });
});

describe("parseAapEvaluationConfig", () => {
  it("lit les critères et coerce les coeffs en chaîne", () => {
    const c = parseAapEvaluationConfig(CONFIG, undefined);
    expect(c.voteType).toBe("starCriterionBased");
    expect(c.criteria).toEqual([
      { index: "0", label: "Budget", coeff: 1, note: 0 },
      { index: "1", label: "Contribution au Commun", coeff: 2, note: 0 },
    ]);
  });

  it("superpose les notes déjà saisies par l'évaluateur", () => {
    const c = parseAapEvaluationConfig(CONFIG, {
      "0": { label: "Budget", note: "4", coeff: 1 },
    });
    expect(c.criteria[0].note).toBe(4);
    expect(c.criteria[1].note).toBe(0); // pas encore noté
  });

  it("le LIBELLÉ vient de la config, pas de la copie stockée", () => {
    // La réponse garde un instantané du libellé ; si l'admin l'a renommé depuis,
    // c'est le nom actuel qui doit s'afficher.
    const c = parseAapEvaluationConfig(CONFIG, {
      "0": { label: "Ancien nom", note: "4", coeff: 1 },
    });
    expect(c.criteria[0].label).toBe("Budget");
  });

  it("supporte une évaluation PARTIELLE — critère ajouté après un premier passage", () => {
    const c = parseAapEvaluationConfig(CONFIG, { "0": { note: 5 } });
    expect(c.criteria).toHaveLength(2);
    expect(c.criteria.map((x) => x.note)).toEqual([5, 0]);
  });

  it("`type` absent ou inconnu → étoiles (113 formulaires sur 126)", () => {
    expect(parseAapEvaluationConfig({ criterions: [] }, null).voteType).toBe("starCriterionBased");
    expect(parseAapEvaluationConfig({ type: "n'importe quoi" }, null).voteType).toBe(
      "starCriterionBased"
    );
    expect(parseAapEvaluationConfig({ type: "noteCriterionBased" }, null).voteType).toBe(
      "noteCriterionBased"
    );
  });

  it("sans critère : liste vide, pas d'erreur", () => {
    expect(parseAapEvaluationConfig(undefined, null).criteria).toEqual([]);
    expect(parseAapEvaluationConfig({ criterions: null }, null).criteria).toEqual([]);
  });

  it("ignore une entrée qui n'est pas un objet", () => {
    expect(
      parseAapEvaluationConfig({ criterions: ["pas un objet", { label: "ok" }] }, null).criteria
    ).toHaveLength(1);
  });
});

describe("buildCriterionValue", () => {
  it("écrit l'objet COMPLET, pas la seule note", () => {
    // Le legacy enregistre `{label, note, coeff}` : la réponse porte sa copie.
    const crit = { index: "0", label: "Budget", coeff: 2, note: 0 };
    expect(buildCriterionValue(crit, 3.5)).toEqual({ label: "Budget", note: 3.5, coeff: 2 });
  });

  it("arrondit le coeff — le legacy le coerce en int", () => {
    expect(buildCriterionValue({ index: "0", label: "x", coeff: 2.6, note: 0 }, 1).coeff).toBe(3);
  });
});

describe("isNoteValid", () => {
  it("borne à 10, comme le legacy", () => {
    expect(isNoteValid(0)).toBe(true);
    expect(isNoteValid(AAP_EVALUATION_NOTE_MAX)).toBe(true);
    expect(isNoteValid(10.5)).toBe(false);
    expect(isNoteValid(-1)).toBe(false);
    expect(isNoteValid(NaN)).toBe(false);
  });
});
