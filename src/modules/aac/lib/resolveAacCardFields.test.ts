import { describe, expect, it } from "vitest";
import { buildAacFormMeta } from "./formMeta";
import { parseFieldPath, resolveAacCardFields } from "./resolveAacCardFields";
import type { AacStepRoles } from "../types";

/**
 * Clés d'étape et ids de question volontairement EXOTIQUES : aucun `aapStepN`,
 * aucun id du formulaire réel. Si un jour du code en code un en dur, ces tests
 * tombent.
 */
const FORM = {
  subForms: ["etapeA", "etapeB"],
  mapping: {},
  inputs: {
    etapeA: {
      inputs: {
        q_titre: { type: "text", label: "Nom du commun", position: 1 },
        q_desc: { type: "textarea", label: "Résumé", position: 2 },
        q_theme: { type: "tpls.forms.cplx.checkboxNew", label: "Thématiques", position: 3 },
        q_matu: { type: "tpls.forms.cplx.radioNew", label: "Maturité du projet", position: 4 },
        q_img: { type: "tpls.forms.uploader", label: "Visuel", position: 5 },
        depense: { type: "tpls.forms.ocecoform.newDepenseList", label: "Budget", position: 6 },
      },
    },
    etapeB: {
      inputs: {
        choose: { type: "tpls.forms.aap.selection", label: "Sélection", position: 1 },
      },
    },
  },
  params: {
    checkboxNewq_theme: { list: ["Numérique", "Gouvernance", "Alimentation"] },
    radioNewq_matu: { list: ["Idée", "Prototype"] },
  },
};

const ROLES: AacStepRoles = {
  depenseStepKey: "etapeA",
  evalStepKey: "etapeB",
  financementStepKey: null,
  suiviStepKey: null,
};

const meta = () => buildAacFormMeta("f1", FORM);

describe("parseFieldPath", () => {
  it("rend les deux niveaux d'un chemin `answers.<étape>.<id>`", () => {
    expect(parseFieldPath("answers.aapStep1.q_x")).toEqual({
      stepKey: "aapStep1",
      id: "q_x",
    });
    expect(parseFieldPath("  answers.etapeB.choose  ")).toEqual({
      stepKey: "etapeB",
      id: "choose",
    });
  });

  it("hors du monde `answers`, c'est un chemin RACINE de profondeur libre", () => {
    expect(parseFieldPath("name")).toEqual({ stepKey: null, id: "name" });
    expect(parseFieldPath("  descriptionStr ")).toEqual({
      stepKey: null,
      id: "descriptionStr",
    });
    // Le vivier de membres d'une plateforme : ni une réponse, ni un champ plat.
    expect(parseFieldPath("links.cae")).toEqual({ stepKey: null, id: "links.cae" });
    expect(parseFieldPath("a.b.c.d")).toEqual({ stepKey: null, id: "a.b.c.d" });
  });

  it("rend null sur un `answers.*` d'une autre profondeur — c'est une faute, pas une racine", () => {
    for (const raw of [
      "answers.q_x",
      "answers.aapStep1.q_x.sous",
      "answers..q_x",
      "answers.aapStep1.",
      "answers",
      "",
      "   ",
      undefined,
      null,
      42,
    ]) {
      expect(parseFieldPath(raw), String(raw)).toBeNull();
    }
  });
});

describe("resolveAacCardFields", () => {
  it("construit `path` depuis la clé d'étape RÉSOLUE, pas depuis aapStepN", () => {
    const { fields } = resolveAacCardFields(meta(), ROLES);
    expect(fields.title?.path).toBe("answers.etapeA.q_titre");
    expect(fields.choose?.path).toBe("answers.etapeB.choose");
    expect(JSON.stringify(fields)).not.toContain("aapStep");
  });

  it("scan : titre par type text, description par textarea, image par uploader", () => {
    const { fields, source } = resolveAacCardFields(meta(), ROLES);
    expect(fields.title?.id).toBe("q_titre");
    expect(fields.description?.id).toBe("q_desc");
    expect(fields.image?.id).toBe("q_img");
    expect(source.title).toBe("scan");
  });

  it("scan : la maturité se trouve par le LIBELLÉ, jamais par l'id", () => {
    const { fields, source } = resolveAacCardFields(meta(), ROLES);
    expect(fields.maturity?.id).toBe("q_matu");
    expect(fields.maturity?.label).toBe("Maturité du projet");
    expect(source.maturity).toBe("scan");
  });

  it("scan : les tags sont la question multi la plus riche en options", () => {
    const { fields } = resolveAacCardFields(meta(), ROLES);
    expect(fields.tags?.id).toBe("q_theme");
    expect(fields.tags?.options).toHaveLength(3);
  });

  it("l'override de config gagne sur tout le reste", () => {
    const { fields, source } = resolveAacCardFields(meta(), ROLES, {
      title: "answers.etapeA.q_desc",
      maturity: "answers.etapeA.q_theme",
    });
    expect(fields.title?.id).toBe("q_desc");
    expect(fields.maturity?.id).toBe("q_theme");
    expect(source.title).toBe("config");
  });

  it("l'override suit l'étape de SON chemin, pas celle du rôle", () => {
    const { fields, source } = resolveAacCardFields(meta(), ROLES, {
      title: "answers.etapeB.choose",
    });
    expect(fields.title?.stepKey).toBe("etapeB");
    expect(fields.title?.path).toBe("answers.etapeB.choose");
    // Question connue ⇒ on récupère aussi son libellé réel, pas l'id en repli.
    expect(fields.title?.label).toBe("Sélection");
    expect(source.title).toBe("config");
  });

  it("un override désignant une question INCONNUE reste honoré, sur l'étape du chemin", () => {
    const { fields, source } = resolveAacCardFields(meta(), ROLES, {
      title: "answers.etapeB.q_inexistante",
    });
    expect(fields.title).toEqual({
      stepKey: "etapeB",
      id: "q_inexistante",
      path: "answers.etapeB.q_inexistante",
      label: "q_inexistante",
      options: [],
    });
    expect(source.title).toBe("config");
  });

  it("un override est honoré même quand l'étape du rôle est indérivable", () => {
    const { fields, source } = resolveAacCardFields(
      meta(),
      { ...ROLES, evalStepKey: null },
      { choose: "answers.etapeB.choose" }
    );
    expect(fields.choose?.path).toBe("answers.etapeB.choose");
    expect(source.choose).toBe("config");
  });

  it("un chemin sans point désigne un champ RACINE du document", () => {
    const { fields, source } = resolveAacCardFields(meta(), ROLES, { title: "name" });
    expect(fields.title).toEqual({
      stepKey: null,
      id: "name",
      path: "name",
      label: "name",
      options: [],
    });
    expect(source.title).toBe("config");
  });

  it("un champ racine n'emprunte pas les métadonnées d'une question homonyme", () => {
    // `depense` existe comme question sur `etapeA` ; le chemin racine vise le
    // champ pré-calculé du même nom, pas elle.
    const { fields } = resolveAacCardFields(meta(), ROLES, { depense: "depense" });
    expect(fields.depense?.stepKey).toBeNull();
    expect(fields.depense?.path).toBe("depense");
    expect(fields.depense?.label).toBe("depense"); // pas « Budget »

    const asQuestion = resolveAacCardFields(meta(), ROLES, {
      depense: "answers.etapeA.depense",
    });
    expect(asQuestion.fields.depense?.stepKey).toBe("etapeA");
    expect(asQuestion.fields.depense?.label).toBe("Budget");
  });

  it("un override MALFORMÉ est ignoré : la chaîne continue, rien n'est fabriqué", () => {
    // Seul le monde `answers` a une profondeur imposée ; ailleurs, tout chemin
    // est légitime (`links.cae`), donc rien à rejeter.
    for (const malformed of [
      "answers.q_desc",
      "answers.etapeA.q_desc.sous",
      "answers..q_desc",
      "",
    ]) {
      const { fields, source } = resolveAacCardFields(meta(), ROLES, {
        title: malformed,
      });
      expect(fields.title?.id, malformed).toBe("q_titre");
      expect(source.title, malformed).toBe("scan");
    }
  });

  it("`form.mapping` passe AVANT le scan mais APRÈS l'override", () => {
    const withMapping = buildAacFormMeta("f1", {
      ...FORM,
      mapping: { title: "answers.etapeA.q_desc" },
    });
    const { fields, source } = resolveAacCardFields(withMapping, ROLES);
    expect(fields.title?.id).toBe("q_desc");
    expect(source.title).toBe("mapping");

    const overridden = resolveAacCardFields(withMapping, ROLES, {
      title: "answers.etapeA.q_titre",
    });
    expect(overridden.fields.title?.id).toBe("q_titre");
    expect(overridden.source.title).toBe("config");
  });

  it("un `mapping` dont l'ÉTAPE ne colle pas au form est ignoré", () => {
    const wrongStep = buildAacFormMeta("f1", {
      ...FORM,
      // `q_desc` existe, mais sur `etapeA` — pas sur `etapeB`.
      mapping: { title: "answers.etapeB.q_desc" },
    });
    const { fields, source } = resolveAacCardFields(wrongStep, ROLES);
    expect(fields.title?.id).toBe("q_titre");
    expect(source.title).toBe("scan");
  });

  it("un `mapping` PÉRIMÉ (question disparue) est ignoré au profit du scan", () => {
    const stale = buildAacFormMeta("f1", {
      ...FORM,
      mapping: { title: "answers.etapeA.q_supprimee" },
    });
    const { fields, source } = resolveAacCardFields(stale, ROLES);
    expect(fields.title?.id).toBe("q_titre");
    expect(source.title).toBe("scan");
  });

  it("défaut canonique quand ni override, ni mapping, ni scan ne répondent", () => {
    const { fields, source } = resolveAacCardFields(meta(), ROLES);
    expect(fields.depense?.id).toBe("depense");
    expect(source.depense).toBe("default");
  });

  it("maturité introuvable ⇒ null, pas un champ deviné", () => {
    const noMatu = buildAacFormMeta("f1", {
      subForms: ["etapeA"],
      inputs: { etapeA: { inputs: { q_titre: { type: "text", label: "Nom" } } } },
      params: {},
    });
    const { fields, source } = resolveAacCardFields(noMatu, {
      ...ROLES,
      evalStepKey: null,
    });
    expect(fields.maturity).toBeNull();
    expect(source.maturity).toBe("none");
  });

  it("sans étape d'évaluation, `choose` est null et rien ne plante", () => {
    const { fields, source } = resolveAacCardFields(meta(), {
      ...ROLES,
      evalStepKey: null,
    });
    expect(fields.choose).toBeNull();
    expect(source.choose).toBe("none");
    expect(fields.title?.id).toBe("q_titre");
  });

  it("retombe sur la première étape connue si depenseStepKey est absent", () => {
    const { fields } = resolveAacCardFields(meta(), {
      ...ROLES,
      depenseStepKey: null,
    });
    expect(fields.title?.stepKey).toBe("etapeA");
  });

  it("form vide : tous les rôles à null, aucune exception", () => {
    const empty = buildAacFormMeta("f1", undefined);
    const { fields } = resolveAacCardFields(empty, {
      depenseStepKey: null,
      evalStepKey: null,
      financementStepKey: null,
      suiviStepKey: null,
    });
    expect(Object.values(fields).every((v) => v === null)).toBe(true);
  });
});
