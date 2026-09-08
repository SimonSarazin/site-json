import { describe, expect, it } from "vitest";
import { resolveAacConfig } from "./resolveAacConfig";

/** Fabrique un doc `inputs` d'étape à partir d'une map inputKey → type. */
function step(inputs: Record<string, string>) {
  return {
    inputs: Object.fromEntries(
      Object.entries(inputs).map(([k, type]) => [k, { type }])
    ),
  };
}

describe("resolveAacConfig", () => {
  it("dispatch 4 étapes : éval=step2, financement=step3, suivi=step4 (par nombre, sans indice hint)", () => {
    const form = {
      aapType: "aac",
      config: "cfg1",
      subForms: ["aapStep1", "aapStep2", "aapStep3", "aapStep4"],
      inputs: {
        aapStep1: step({ titre: "text", depense: "tpls.forms.ocecoform.newDepenseList" }),
        aapStep2: step({ q2: "text" }),
        aapStep3: step({ q3: "text" }),
        aapStep4: step({ q4: "text" }),
      },
    };
    const cfg = resolveAacConfig("f1", form);
    expect(cfg.steps.map((s) => s.key)).toEqual([
      "aapStep1",
      "aapStep2",
      "aapStep3",
      "aapStep4",
    ]);
    expect(cfg.roles.depenseStepKey).toBe("aapStep1");
    expect(cfg.roles.evalStepKey).toBe("aapStep2");
    expect(cfg.roles.financementStepKey).toBe("aapStep3");
    expect(cfg.roles.suiviStepKey).toBe("aapStep4");
  });

  it("dispatch 5 étapes : éval=step3, financement=step4, suivi=step5", () => {
    const form = {
      subForms: ["aapStep1", "aapStep2", "aapStep3", "aapStep4", "aapStep5"],
      inputs: {
        aapStep1: step({ titre: "text" }),
        aapStep2: step({ q2: "text" }),
        aapStep3: step({ q3: "text" }),
        aapStep4: step({ q4: "text" }),
        aapStep5: step({ q5: "text" }),
      },
    };
    const cfg = resolveAacConfig("f1", form);
    expect(cfg.roles.evalStepKey).toBe("aapStep3");
    expect(cfg.roles.financementStepKey).toBe("aapStep4");
    expect(cfg.roles.suiviStepKey).toBe("aapStep5");
  });

  it("résout depenseStepKey/financement/suivi par SCAN des clés d'input (pas par indice)", () => {
    // Ordre volontairement « exotique » : le scan doit primer sur le count.
    const form = {
      subForms: ["aapStep1", "aapStep2", "aapStep3", "aapStep4"],
      inputs: {
        aapStep1: step({ titre: "text", depense: "tpls.forms.ocecoform.newDepenseList" }),
        aapStep2: step({ choose: "chooseProposal", decide: "multiDecide" }),
        aapStep3: step({ financer: "tpls.forms.ocecoform.newDepenseList", generateproject: "generateprojectbtn" }),
        aapStep4: step({ suivredepense: "suiviFromBudget" }),
      },
    };
    const cfg = resolveAacConfig("f1", form);
    expect(cfg.roles.depenseStepKey).toBe("aapStep1");
    expect(cfg.roles.evalStepKey).toBe("aapStep2");
    expect(cfg.roles.financementStepKey).toBe("aapStep3");
    expect(cfg.roles.suiviStepKey).toBe("aapStep4");
  });

  it("subForms OBJET (fallback config) quand form.subForms est absent", () => {
    const form = { inputs: { aapStep1: step({ titre: "text" }) } };
    const config = {
      subForms: { aapStep1: { name: "Le commun" }, aapStep2: { name: "Bilan" } },
    };
    const cfg = resolveAacConfig("f1", form, config);
    expect(cfg.steps.map((s) => s.key)).toEqual(["aapStep1", "aapStep2"]);
    expect(cfg.steps[0].name).toBe("Le commun");
  });

  it("priorité des critères : evaluationCriteria locale (activateLocalCriteria) surcharge la config", () => {
    const form = {
      subForms: ["aapStep1", "aapStep2", "aapStep3", "aapStep4"],
      inputs: { aapStep1: step({ titre: "text" }) },
      evaluationCriteria: {
        activateLocalCriteria: true,
        criterions: [{ label: "Impact", coeff: "2" }],
      },
    };
    const config = {
      subForms: { aapStep2: { params: { config: { criterions: [{ label: "Autre", coeff: 1 }] } } } },
    };
    const cfg = resolveAacConfig("f1", form, config);
    expect(cfg.criteriaSource).toBe("formParent");
    expect(cfg.criteria).toEqual([{ label: "Impact", coeff: 2, note: undefined, fieldKey: undefined }]);
  });

  it("critères depuis la config quand activateLocalCriteria est faux ; coeff string coercé", () => {
    const form = {
      subForms: ["aapStep1", "aapStep2", "aapStep3", "aapStep4"],
      inputs: { aapStep1: step({ titre: "text" }) },
      evaluationCriteria: { activateLocalCriteria: false, criterions: [] },
    };
    const config = {
      subForms: {
        aapStep2: {
          params: { config: { criterions: [{ label: "Faisabilité", coeff: "3", note: "0" }] } },
        },
      },
    };
    const cfg = resolveAacConfig("f1", form, config);
    expect(cfg.criteriaSource).toBe("config");
    expect(cfg.criteria[0]).toEqual({ label: "Faisabilité", coeff: 3, note: 0, fieldKey: undefined });
  });

  it("coerce les rôles CSV (form) et array (config), et les flags 'true'", () => {
    const form = {
      subForms: ["aapStep1"],
      inputs: { aapStep1: step({ titre: "text" }) },
      params: { aapStep1: { canEdit: "Financeur, Evaluateur", canRead: "Financeur", haveEditingRules: "true" } },
      onlymemberaccess: "true",
      oneAnswerPerPers: false,
    };
    const cfg = resolveAacConfig("f1", form);
    expect(cfg.steps[0].canEdit).toEqual(["Financeur", "Evaluateur"]);
    expect(cfg.steps[0].canRead).toEqual(["Financeur"]);
    expect(cfg.steps[0].haveEditingRules).toBe(true);
    expect(cfg.gates.onlyMemberAccess).toBe(true);
    expect(cfg.gates.oneAnswerPerPers).toBe(false);
    expect(cfg.gates.active).toBe(true); // actif par défaut
  });

  it("parse les campagnes déclarées sur l'aapConfig (isolation par campagne)", () => {
    const form = { subForms: ["aapStep1"], inputs: { aapStep1: step({ titre: "text" }) } };
    const config = {
      campagne: {
        "66f39fc17d3dc140bc52a221": {
          name: "Campagne 2025",
          campType: "doublonnage",
          campFinanc: 500,
          campPorteur: "org123",
          activated: true,
          startDate: "2025-01-01",
          cofinancedate: "2025-02-01",
          panierdate: "2025-03-01",
        },
      },
    };
    const cfg = resolveAacConfig("f1", form, config);
    expect(cfg.campaigns).toHaveLength(1);
    expect(cfg.campaigns[0]).toMatchObject({
      id: "66f39fc17d3dc140bc52a221",
      name: "Campagne 2025",
      type: "doublonnage",
      montantDisponibleDoublonnage: 500,
      porteur: "org123",
      activee: true,
    });
    expect(cfg.campaigns[0].dates).toMatchObject({
      debut: "2025-01-01",
      debutCofinancement: "2025-02-01",
      ouverturePaiement: "2025-03-01",
    });
  });

  it("expose configId, aapType et un objet stable même sur entrée vide", () => {
    const cfg = resolveAacConfig("f1", {});
    expect(cfg.formId).toBe("f1");
    expect(cfg.configId).toBeNull();
    expect(cfg.steps).toEqual([]);
    expect(cfg.criteria).toEqual([]);
    expect(cfg.criteriaSource).toBe("none");
    expect(cfg.campaigns).toEqual([]);
    expect(cfg.roles.depenseStepKey).toBeNull();
  });
});

/**
 * Les gates sont les clés RACINE du form que le legacy lit réellement. Avant
 * (review MR 53, C3/N1) : le financement était gardé par `coRemuneration` — une
 * clé qui n'existe nulle part côté PHP — et deux autres gates (`standalone`,
 * `annuaire`) dérivaient de clés fantômes : toujours `false`, ils éteignaient ce
 * qu'ils gardaient.
 */
describe("resolveAacConfig — gates (clés legacy réelles, à la racine du form)", () => {
  const base = { subForms: ["aapStep1"], inputs: { aapStep1: step({ titre: "text" }) } };

  it("`coremu` : booléen OU chaîne 'true' (parité `filter_var(FILTER_VALIDATE_BOOLEAN)`) ; absent ⇒ false", () => {
    expect(resolveAacConfig("f1", { ...base, coremu: true }).gates.coremu).toBe(true);
    expect(resolveAacConfig("f1", { ...base, coremu: "true" }).gates.coremu).toBe(true);
    expect(resolveAacConfig("f1", { ...base, coremu: "false" }).gates.coremu).toBe(false);
    expect(resolveAacConfig("f1", { ...base, coremu: false }).gates.coremu).toBe(false);
    expect(resolveAacConfig("f1", base).gates.coremu).toBe(false);
  });

  it("`coremu` se lit à la RACINE du form — ni dans `params`, ni sur l'aapConfig", () => {
    const cfg = resolveAacConfig("f1", { ...base, params: { coremu: true } }, { coremu: true });
    expect(cfg.gates.coremu).toBe(false);
  });

  it("une clé inconnue ne fabrique aucun gate : `coRemuneration`, `standalone`, `annuaire` sont ignorées", () => {
    const cfg = resolveAacConfig(
      "f1",
      { ...base, coRemuneration: true, standalone: true, annuaire: true, params: { coRemuneration: true, standalone: true, annuaire: true } },
      { coRemuneration: true }
    );
    expect(cfg.gates).not.toHaveProperty("coRemuneration");
    expect(cfg.gates).not.toHaveProperty("standalone");
    expect(cfg.gates).not.toHaveProperty("annuaire");
    // `coRemuneration: true` ne lève PAS le gate de financement : seule `coremu` le fait.
    expect(cfg.gates.coremu).toBe(false);
    expect(Object.keys(cfg.gates).sort()).toEqual([
      "active",
      "anyOnewithLinkCanAnswer",
      "canReadOtherAnswers",
      "coremu",
      "oneAnswerPerPers",
      "onlyMemberAccess",
      "showAnswers",
    ]);
  });

  it("`anyOnewithLinkCanAnswer` est un gate à part entière — il n'alimente plus un `standalone`", () => {
    const on = resolveAacConfig("f1", { ...base, anyOnewithLinkCanAnswer: "true" });
    expect(on.gates.anyOnewithLinkCanAnswer).toBe(true);
    expect(on.gates).not.toHaveProperty("standalone");
    expect(resolveAacConfig("f1", base).gates.anyOnewithLinkCanAnswer).toBe(false);
  });
});
