import { describe, expect, it } from "vitest";
import { diagnoseAacChoose } from "./diagnoseAacChoose";

/** Formulaire AAC (Fédération des CAE) : la sélection vit en `aapStep2`. */
const AAC = { byStep: { aapStep1: ["titre", "description"], aapStep2: ["choose", "decide"], aapStep3: ["financer"] } };
/** Formulaire AAP (OCECO d'Open Atlas) : des votes, aucune sélection. */
const AAP = { byStep: { aapStep1: ["titre"], aapStep2: ["decide"], aapStep3: ["financer"] } };

describe("diagnoseAacChoose", () => {
  it("AAC déclaré au bon chemin : rien à dire", () => {
    expect(diagnoseAacChoose(AAC, "answers.aapStep2.choose")).toBeNull();
  });

  it("AAP sans `choose`, formulaire sans sélection : rien à dire", () => {
    expect(diagnoseAacChoose(AAP, undefined)).toBeNull();
    expect(diagnoseAacChoose(AAP, "  ")).toBeNull();
  });

  it("AAC dont la config oublie `choose` : signalé, avec le chemin à déclarer", () => {
    const finding = diagnoseAacChoose(AAC, undefined);
    expect(finding).toMatchObject({ kind: "non-declaree", formPath: "answers.aapStep2.choose" });
    expect(finding?.message).toContain('déclarer "answers.aapStep2.choose"');
  });

  it("préfixe `answers.` oublié : signalé comme ignoré", () => {
    expect(diagnoseAacChoose(AAC, "aapStep2.choose")).toMatchObject({ kind: "mal-formee", declared: "aapStep2.choose" });
    expect(diagnoseAacChoose(AAC, "answers.aapStep2")).toMatchObject({ kind: "mal-formee" });
  });

  it("chemin qui ne désigne aucune question : annuaire vide, le bon chemin est proposé", () => {
    expect(diagnoseAacChoose(AAC, "answers.aapStep3.choose")).toMatchObject({
      kind: "introuvable",
      formPath: "answers.aapStep2.choose",
    });
  });

  it("`choose` déclaré sur un AAP : introuvable, et c'est la clé qu'il faut retirer", () => {
    const finding = diagnoseAacChoose(AAP, "answers.aapStep2.choose");
    expect(finding).toMatchObject({ kind: "introuvable", formPath: null });
    expect(finding?.message).toContain("retirer la clé");
  });
});
