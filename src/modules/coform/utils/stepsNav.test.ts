import { describe, it, expect } from "vitest";
import {
  buildStepItems,
  isSubFormValid,
  invalidSteps,
  computeStepsWindow,
  railStateBetween,
  firstErrorStep,
  STEPS_WINDOW_SIZE,
  type StepNavItem,
} from "./stepsNav";
import { parseCoFormFields } from "./formParser";
import type { SubFormFields } from "../types";

const steps = (...names: string[]): SubFormFields[] =>
  names.map((subFormName, i) => ({ subFormId: `s${i}`, subFormName, fields: [] }));

const item = (index: number, status: StepNavItem["status"]): StepNavItem => ({
  index,
  id: `s${index}`,
  name: `Étape ${index}`,
  status,
  clickable: status !== "locked",
});

describe("buildStepItems", () => {
  it("classe chaque étape selon l'état du provider", () => {
    const result = buildStepItems({
      steps: steps("Un", "Deux", "Trois", "Quatre"),
      currentIndex: 2,
      completedIds: ["s0"],
      errorIds: ["s1"],
      lockedIds: ["s3"],
    });

    expect(result.map((s) => s.status)).toEqual(["done", "error", "current", "locked"]);
    expect(result.map((s) => s.clickable)).toEqual([true, true, true, false]);
  });

  it("donne la priorité à « courante » sur l'erreur : l'erreur est déjà sous les yeux", () => {
    const result = buildStepItems({
      steps: steps("Un", "Deux"),
      currentIndex: 1,
      completedIds: [],
      errorIds: ["s1"],
    });

    expect(result[1].status).toBe("current");
  });

  it("garde une étape sans nom sans nom — on n'en fabrique pas", () => {
    const result = buildStepItems({
      steps: steps("", ""),
      currentIndex: 0,
      completedIds: [],
    });

    expect(result.map((s) => s.name)).toEqual(["", ""]);
  });
});

describe("computeStepsWindow", () => {
  it("montre tout jusqu'au seuil : 80 % des formulaires ont 4 étapes", () => {
    expect(computeStepsWindow(4, 0)).toEqual({ start: 0, end: 4 });
    expect(computeStepsWindow(6, 5)).toEqual({ start: 0, end: 6 });
  });

  it("centre la fenêtre sur l'étape courante au-delà du seuil", () => {
    expect(computeStepsWindow(13, 6)).toEqual({ start: 4, end: 9 });
  });

  it("bute aux deux bouts sans raccourcir la fenêtre", () => {
    expect(computeStepsWindow(13, 0)).toEqual({ start: 0, end: 5 });
    expect(computeStepsWindow(13, 12)).toEqual({ start: 8, end: 13 });
    expect(computeStepsWindow(35, 34)).toEqual({ start: 30, end: 35 });
  });

  it("garde toujours une fenêtre de la taille demandée", () => {
    for (let current = 0; current < 35; current++) {
      const { start, end } = computeStepsWindow(35, current);
      expect(end - start).toBe(STEPS_WINDOW_SIZE);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeLessThanOrEqual(35);
    }
  });
});

describe("railStateBetween", () => {
  it("n'est plein qu'entre deux étapes atteintes", () => {
    expect(railStateBetween(item(0, "done"), item(1, "current"))).toBe("done");
    expect(railStateBetween(item(0, "done"), item(1, "todo"))).toBe("todo");
    expect(railStateBetween(item(0, "todo"), item(1, "current"))).toBe("todo");
  });

  it("passe en erreur dès qu'un bout est en erreur", () => {
    expect(railStateBetween(item(0, "done"), item(1, "error"))).toBe("error");
    expect(railStateBetween(item(0, "error"), item(1, "current"))).toBe("error");
  });

  it("reste pointillé vers une étape réservée", () => {
    expect(railStateBetween(item(0, "done"), item(1, "locked"))).toBe("todo");
  });

  it("laisse les deux segments autour d'une étape sautée en pointillé", () => {
    // Saut de la 1 à la 3 : la 2 n'a jamais été atteinte.
    const [un, deux, trois] = [item(0, "done"), item(1, "todo"), item(2, "current")];
    expect(railStateBetween(un, deux)).toBe("todo");
    expect(railStateBetween(deux, trois)).toBe("todo");
  });

  it("traite un bout absent comme non atteint", () => {
    expect(railStateBetween(undefined, item(0, "done"))).toBe("todo");
    expect(railStateBetween(item(0, "done"), undefined)).toBe("todo");
  });
});

/**
 * Validation d'une étape — c'est elle qui porte la garde de soumission finale.
 *
 * Le balayage par `componentType` n'est pas décoratif : `categorizedCheckbox`
 * retombait sur le défaut générique `""` alors que son schéma attend
 * `{ list, sublist }`. Une étape le contenant était donc jugée invalide À VIE,
 * et la garde en faisait un mur : formulaire impossible à envoyer, sans que rien
 * ne soit signalé à l'écran.
 */
describe("isSubFormValid", () => {
  // Types LEGACY réels (ceux de la table de `mapCoFormTypeToComponentType`) :
  // un type inconnu produirait `componentType: "unknown"`, donc AUCUNE entrée
  // de schéma — le test passerait sans rien prouver.
  const TYPES: [string, string][] = [
    ["text", "text"],
    ["textarea", "textarea"],
    ["radio", "tpls.forms.cplx.radioNew"],
    ["checkbox", "tpls.forms.cplx.checkboxNew"],
    ["multiRadio", "tpls.forms.cplx.multiRadio"],
    ["multiCheckboxPlus", "tpls.forms.cplx.multiCheckboxPlus"],
    ["categorizedCheckbox", "tpls.forms.cplx.categorizedCheckbox"],
    ["evaluation", "tpls.forms.evaluation.evaluation"],
    ["commonTable", "tpls.forms.evaluation.commonTableV2"],
    ["finder", "tpls.forms.cplx.finder"],
    ["uploader", "tpls.forms.uploader"],
    ["timeSlots", "tpls.forms.cplx.timeSlots"],
    ["dynamicFields", "tpls.forms.cplx.dynamicFields"],
    ["simpleTable", "tpls.forms.cplx.simpleTable"],
    ["select", "tpls.forms.select"],
    ["location", "tpls.forms.cplx.address"],
  ];

  it("les types du tableau sont bien reconnus (sinon le test ne prouve rien)", () => {
    for (const [attendu, type] of TYPES) {
      expect(etapeAvec(type).fields[0].componentType).toBe(attendu);
    }
  });

  const etapeAvec = (type: string, isRequired = false): SubFormFields => {
    const form = {
      _id: { $id: "f" }, id: "f", name: "T", created: 0, creator: "u", type: "form",
      inputs: {
        e1: {
          id: "e1", name: "Étape", formParent: "f",
          inputs: { champ: { type, label: "Champ", position: "0", ...(isRequired ? { isRequired: true } : {}) } },
        },
      },
    } as unknown as Parameters<typeof parseCoFormFields>[0];
    return parseCoFormFields(form)[0];
  };

  it.each(TYPES)("juge valide une étape neuve dont le champ %s n'est pas requis", (_ct, type) => {
    expect(isSubFormValid(etapeAvec(type), undefined)).toBe(true);
  });

  it("juge invalide une étape neuve dont un champ requis est vide", () => {
    expect(isSubFormValid(etapeAvec("text", true), undefined)).toBe(false);
  });

  it("ignore les champs que l'utilisateur ne voit pas", () => {
    const etape = etapeAvec("text", true);
    expect(isSubFormValid(etape, undefined)).toBe(false);
    expect(isSubFormValid(etape, undefined, [etape.fields[0].name])).toBe(true);
  });
});

describe("invalidSteps", () => {
  const deuxEtapes = (): SubFormFields[] => {
    const form = {
      _id: { $id: "f" }, id: "f", name: "T", created: 0, creator: "u", type: "form",
      inputs: {
        e1: { id: "e1", name: "Un", formParent: "f", inputs: { a: { type: "text", label: "A", position: "0", isRequired: true } } },
        e2: { id: "e2", name: "Deux", formParent: "f", inputs: { b: { type: "text", label: "B", position: "0" } } },
      },
    } as unknown as Parameters<typeof parseCoFormFields>[0];
    return parseCoFormFields(form);
  };

  it("liste l'étape jamais visitée dont un champ est requis, pas celle qui est facultative", () => {
    const etapes = deuxEtapes();
    expect(invalidSteps(etapes, {}).map((s) => s.subFormId)).toEqual(["e1"]);
  });

  it("ne liste plus une étape une fois renseignée", () => {
    const etapes = deuxEtapes();
    const champ = etapes[0].fields[0].name;
    expect(invalidSteps(etapes, { e1: { [champ]: "rempli" } })).toEqual([]);
  });
});

describe("firstErrorStep", () => {
  it("rend la première étape à corriger, ou null", () => {
    expect(firstErrorStep([item(0, "done"), item(1, "error"), item(2, "error")])?.index).toBe(1);
    expect(firstErrorStep([item(0, "done"), item(1, "todo")])).toBeNull();
  });
});
