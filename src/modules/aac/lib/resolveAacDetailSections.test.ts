import { describe, expect, it } from "vitest";
import { resolveAacDetailSections } from "./resolveAacDetailSections";
import type { AacFormMeta } from "./formMeta";

const meta = (): AacFormMeta => ({
  formId: "f1",
  byId: {
    q_modele: { id: "q_modele", stepKey: "aapStep1", label: "Modèle économique", componentType: "textarea", options: [] },
    q_gouv: { id: "q_gouv", stepKey: "aapStep1", label: "Gouvernance", componentType: "textarea", options: [] },
    q_eval: { id: "q_eval", stepKey: "aapStep2", label: "Évaluation", componentType: "textarea", options: [] },
    tags: { id: "tags", stepKey: "aapStep1", label: "Mots-clés", componentType: "tags", options: [] },
  },
  byStep: { aapStep1: ["q_modele", "q_gouv", "tags"], aapStep2: ["q_eval"] },
  order: ["q_modele", "q_gouv", "tags", "q_eval"],
  mapping: {},
}) as unknown as AacFormMeta;

describe("resolveAacDetailSections", () => {
  it("ne rend rien sans déclaration — la fiche ne devine pas ses blocs", () => {
    expect(resolveAacDetailSections(meta(), undefined)).toEqual([]);
    expect(resolveAacDetailSections(meta(), [])).toEqual([]);
    expect(resolveAacDetailSections(null, [{ id: "a", field: "answers.aapStep1.q_modele" }])).toEqual([]);
  });

  it("résout l'étape et l'id, et garde l'ordre déclaré", () => {
    const out = resolveAacDetailSections(meta(), [
      { id: "gouvernance", field: "answers.aapStep1.q_gouv" },
      { id: "modele", field: "answers.aapStep1.q_modele" },
    ]);
    expect(out.map((s) => s.id)).toEqual(["gouvernance", "modele"]);
    expect(out[0].field.stepKey).toBe("aapStep1");
    expect(out[0].field.id).toBe("q_gouv");
    expect(out[0].field.path).toBe("answers.aapStep1.q_gouv");
  });

  it("sans titre en config, l'intitulé vient de LA QUESTION", () => {
    const [s] = resolveAacDetailSections(meta(), [{ id: "modele", field: "answers.aapStep1.q_modele" }]);
    expect(s.title).toBe("Modèle économique");
  });

  it("un titre en config l'emporte sur le libellé de la question", () => {
    const [s] = resolveAacDetailSections(
      meta(),
      [{ id: "modele", title: { fr: "Business model" }, field: "answers.aapStep1.q_modele" }],
      (v) => (v && typeof v === "object" ? String((v as { fr?: string }).fr ?? "") : "")
    );
    expect(s.title).toBe("Business model");
  });

  /**
   * Le repli ultime est l'id de SECTION, pas la clé de question : le premier est
   * un slug choisi par l'auteur de la config (« modele »), la seconde une clé
   * opaque (« aapStep1lpvinn7ld70wbk7w339 »).
   */
  it("une question inconnue reste rendue, intitulée par l'id de section", () => {
    const [s] = resolveAacDetailSections(meta(), [{ id: "modele", field: "answers.aapStep1.q_absente" }]);
    expect(s.title).toBe("modele");
    expect(s.field.stepKey).toBe("aapStep1");
    expect(s.field.id).toBe("q_absente");
  });

  it("écarte les chemins illisibles plutôt que d'en fabriquer un", () => {
    const out = resolveAacDetailSections(meta(), [
      { id: "a", field: "answers.q_modele" },
      { id: "b", field: "" },
      { id: "c", field: "answers..q_modele" },
      { id: "ok", field: "answers.aapStep1.q_modele" },
    ]);
    expect(out.map((s) => s.id)).toEqual(["ok"]);
  });

  it("écarte les id vides et les doublons — une ancre par bloc", () => {
    const out = resolveAacDetailSections(meta(), [
      { id: "modele", field: "answers.aapStep1.q_modele" },
      { id: "modele", field: "answers.aapStep1.q_gouv" },
      { id: "  ", field: "answers.aapStep1.q_gouv" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].field.id).toBe("q_modele");
  });

  /**
   * Même garde que `resolveAacCardFields` : `tags` existe à la racine ET comme
   * question. Un chemin racine ne doit pas emprunter le libellé de l'homonyme.
   */
  it("un chemin racine n'emprunte pas les métadonnées d'une question homonyme", () => {
    const [s] = resolveAacDetailSections(meta(), [{ id: "motscles", field: "tags" }]);
    expect(s.field.stepKey).toBeNull();
    // Pas « Mots-clés » : le libellé de la question homonyme n'est pas emprunté.
    expect(s.title).toBe("motscles");
  });

  it("porte kicker et icône quand ils sont déclarés", () => {
    const [s] = resolveAacDetailSections(meta(), [
      { id: "modele", kicker: { fr: "Économie" }, icon: "Layers", field: "answers.aapStep1.q_modele" },
    ], (v) => (v && typeof v === "object" ? String((v as { fr?: string }).fr ?? "") : ""));
    expect(s.kicker).toBe("Économie");
    expect(s.icon).toBe("Layers");
  });
});
