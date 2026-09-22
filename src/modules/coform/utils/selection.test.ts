import { describe, it, expect } from "vitest";
import {
  normalizeCoeff,
  toNote,
  parseSelectionConfig,
  computeSelectionMeans,
  withEvaluatorNotes,
  formatCriterionValue,
} from "./selection";

/**
 * Les cas viennent d'un relevé sur `pixelhumain1` :
 *  - 16 formulaires portent `configSelectionCriteria` (12 sans `type` explicite) ;
 *  - 105 critères, dont 23 à coeff en CHAÎNE, 3 à `null`, 13 réellement pondérants ;
 *  - 6028 notes : 5975 nombres, 52 chaînes, 1 booléen ;
 *  - 76 formulaires utilisent `selection` SANS aucune config de critères.
 */

describe("normalizeCoeff — la règle legacy `is_int($coeff) ? $coeff : 1`", () => {
  it("garde un entier", () => {
    expect(normalizeCoeff(2)).toBe(2);
    expect(normalizeCoeff(3)).toBe(3);
  });

  it("ramène à 1 tout ce qui n'est pas un entier — chaîne comprise", () => {
    // 23 critères en base sont dans ce cas. Lire "3" comme 3 ferait diverger
    // React du legacy sur des moyennes déjà calculées et stockées.
    expect(normalizeCoeff("3")).toBe(1);
    expect(normalizeCoeff("1")).toBe(1);
    expect(normalizeCoeff(null)).toBe(1);
    expect(normalizeCoeff(undefined)).toBe(1);
    expect(normalizeCoeff(2.5)).toBe(1);
  });
});

describe("toNote", () => {
  it("accepte les trois types réellement présents en base", () => {
    expect(toNote(4)).toBe(4);
    expect(toNote("3.5")).toBe(3.5);
    expect(toNote(true)).toBe(1);
  });

  it("neutralise ce qui n'est pas une note", () => {
    expect(toNote("")).toBe(0);
    expect(toNote(null)).toBe(0);
    expect(toNote({})).toBe(0);
    expect(toNote(NaN)).toBe(0);
  });
});

describe("parseSelectionConfig", () => {
  it("sans config : mode étoiles sur 5, admissibilité visible, aucun critère", () => {
    const c = parseSelectionConfig(undefined);
    expect(c).toEqual({ voteType: "starCriterionBased", noteMax: 5, criteria: [], showAdmissibility: true });
  });

  it("`type` vide vaut absent → étoiles (12 formulaires sur 16)", () => {
    expect(parseSelectionConfig({ type: "", noteMax: "" }).voteType).toBe("starCriterionBased");
  });

  it("en mode étoiles, noteMax est FORCÉ à 5 même si la config dit autre chose", () => {
    expect(parseSelectionConfig({ type: "starCriterionBased", noteMax: 20 }).noteMax).toBe(5);
  });

  it("en mode note, prend noteMax, avec 10 par défaut", () => {
    expect(parseSelectionConfig({ type: "noteCriterionBased", noteMax: 20 }).noteMax).toBe(20);
    expect(parseSelectionConfig({ type: "noteCriterionBased", noteMax: "" }).noteMax).toBe(10);
    expect(parseSelectionConfig({ type: "noteCriterionBased" }).noteMax).toBe(10);
  });

  it("distingue critères associés et libres, et résout les libellés", () => {
    // Forme réelle : `criterions` est un tableau, les coeffs y sont des chaînes.
    const c = parseSelectionConfig(
      {
        criterions: [
          { fieldKey: "depense", coeff: "1" },
          { fieldKey: "axesTFPB", coeff: 2, fieldLabel: "Axes TFPB" },
        ],
        unassociatedCriterions: [{ fieldKey: "fieldKey0", coeff: 3, fieldLabel: "Critère libre" }],
      },
      { depense: "Les dépenses du projet", axesTFPB: "(label de la question)" }
    );
    expect(c.criteria).toEqual([
      // Pas de `fieldLabel` → on retombe sur le label de la question d'étape 1.
      { fieldKey: "depense", label: "Les dépenses du projet", coeff: 1, isFree: false },
      // `fieldLabel` gagne sur le label de la question.
      { fieldKey: "axesTFPB", label: "Axes TFPB", coeff: 2, isFree: false },
      { fieldKey: "fieldKey0", label: "Critère libre", coeff: 3, isFree: true },
    ]);
  });

  it("ignore un critère sans fieldKey, comme le legacy", () => {
    expect(parseSelectionConfig({ criterions: [{ coeff: 2 }, { fieldKey: "ok", coeff: 1 }] }).criteria)
      .toHaveLength(1);
  });

  it("l'admissibilité n'est masquée que par un `false` explicite", () => {
    expect(parseSelectionConfig({}).showAdmissibility).toBe(true);
    expect(parseSelectionConfig({ admissibility: true }).showAdmissibility).toBe(true);
    expect(parseSelectionConfig({ admissibility: false }).showAdmissibility).toBe(false);
  });
});

describe("computeSelectionMeans", () => {
  const criteres = parseSelectionConfig({
    criterions: [
      { fieldKey: "a", coeff: 1 },
      { fieldKey: "b", coeff: 3 },
    ],
  }).criteria;

  it("pondère par les coefficients", () => {
    // moi : (4×1 + 2×3) / 4 = 2.5
    const m = computeSelectionMeans({ moi: { a: 4, b: 2 } }, criteres, "moi");
    expect(m.myMean).toBe(2.5);
    expect(m.allMean).toBe(2.5);
    expect(m.evaluatorCount).toBe(1);
  });

  it("moyenne des moyennes d'évaluateurs, et isole la mienne", () => {
    // moi : (5+3×5)/4 = 5 ; autre : (1+3×1)/4 = 1 → tous : 3
    const m = computeSelectionMeans({ moi: { a: 5, b: 5 }, autre: { a: 1, b: 1 } }, criteres, "moi");
    expect(m.myMean).toBe(5);
    expect(m.allMean).toBe(3);
    expect(m.evaluatorCount).toBe(2);
  });

  it("un critère NON noté tire la moyenne vers le bas — le dénominateur est fixe", () => {
    // Comportement d'origine : le diviseur est la somme des coeffs de TOUS les
    // critères configurés, pas seulement des critères notés. (4×1)/4 = 1.
    expect(computeSelectionMeans({ moi: { a: 4 } }, criteres, "moi").myMean).toBe(1);
  });

  it("ignore une note dont le critère a été retiré de la config", () => {
    expect(computeSelectionMeans({ moi: { a: 4, disparu: 100 } }, criteres, "moi").myMean).toBe(1);
  });

  it("coerce les notes stockées en chaîne", () => {
    expect(computeSelectionMeans({ moi: { a: "4", b: "2" } }, criteres, "moi").myMean).toBe(2.5);
  });

  it("myMean est null quand l'utilisateur courant n'a pas voté", () => {
    const m = computeSelectionMeans({ autre: { a: 4, b: 4 } }, criteres, "moi");
    expect(m.myMean).toBeNull();
    expect(m.allMean).toBe(4);
  });

  it("SANS critère configuré : null, pas NaN", () => {
    // 76 formulaires utilisent `selection` sans `configSelectionCriteria`.
    // Le legacy diviserait par 0 et afficherait NaN.
    const m = computeSelectionMeans({ moi: { a: 4 } }, [], "moi");
    expect(m.myMean).toBeNull();
    expect(m.allMean).toBeNull();
  });

  it("sans aucun évaluateur : null, pas de division par zéro", () => {
    expect(computeSelectionMeans({}, criteres, "moi")).toEqual({
      myMean: null,
      allMean: null,
      evaluatorCount: 0,
    });
    expect(computeSelectionMeans(null, criteres, "moi").allMean).toBeNull();
  });

  it("arrondit à 3 décimales comme le legacy", () => {
    // (1×1 + 0×3)/4 = 0.25 ; deux évaluateurs → 0.125
    const m = computeSelectionMeans({ moi: { a: 1 }, autre: {} }, criteres, "moi");
    expect(m.myMean).toBe(0.25);
    expect(m.allMean).toBe(0.125);
  });
});

describe("formatCriterionValue", () => {
  it("somme les prix pour `depense` et `budget`", () => {
    const lignes = { 0: { poste: "A", price: 1500 }, 1: { poste: "B", price: "500" } };
    expect(formatCriterionValue("depense", lignes)).toBe("2000");
    expect(formatCriterionValue("budget", lignes)).toBe("2000");
    expect(formatCriterionValue("depense", undefined)).toBe("0");
  });

  it("les prix sont des MONTANTS de document : « 1 500,00 » vaut 1500, bool et null valent 0", () => {
    // Relevé en base sur `depense[].price` : 178 chaînes, 75 booléens, 200 null.
    // Lus comme des notes (`toNote`), « 1 500,00 » valait 1 et `true` 1 : la
    // colonne « Valeur » du jury affichait un budget faux, sans erreur.
    const lignes = {
      0: { poste: "A", price: "1 500,00" },
      1: { poste: "B", price: true },
      2: { poste: "C", price: null },
      3: { poste: "D", price: 250 },
    };
    expect(formatCriterionValue("depense", lignes)).toBe("1750");
  });

  it("liste un tableau, affiche un scalaire, vide le reste", () => {
    expect(formatCriterionValue("k", ["un", "deux"])).toBe("un\ndeux");
    expect(formatCriterionValue("k", "texte")).toBe("texte");
    expect(formatCriterionValue("k", 42)).toBe("42");
    expect(formatCriterionValue("k", { a: 1 })).toBe("");
    expect(formatCriterionValue("k", null)).toBe("");
  });
});

describe("withEvaluatorNotes — la valeur locale dont dérivent les moyennes", () => {
  it("remplace les notes de l'évaluateur courant, sans toucher aux autres", () => {
    const v = withEvaluatorNotes({ moi: { c1: 1 }, autre: { c1: 5 } }, "moi", { c1: 4, c2: 2 });
    expect(v).toEqual({ moi: { c1: 4, c2: 2 }, autre: { c1: 5 } });
  });

  it("ajoute l'évaluateur quand il a écrit sans entrée préalable", () => {
    expect(withEvaluatorNotes({}, "moi", { c1: 4 })).toEqual({ moi: { c1: 4 } });
    expect(withEvaluatorNotes(undefined, "moi", { c1: 4 })).toEqual({ moi: { c1: 4 } });
  });

  it("ne crée PAS d'entrée vide — elle compterait un évaluateur de plus", () => {
    const base = { autre: { c1: 5 } };
    expect(withEvaluatorNotes(base, "moi", {})).toBe(base);
    expect(withEvaluatorNotes(undefined, "moi", {})).toBeUndefined();
  });

  it("sans évaluateur identifié, rend la valeur telle quelle", () => {
    const base = { autre: { c1: 5 } };
    expect(withEvaluatorNotes(base, null, { c1: 4 })).toBe(base);
  });
});
