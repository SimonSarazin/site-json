import { describe, it, expect } from "vitest";
import { isMultiDecideType, multiDecideTargetKey, resolveMultiDecide } from "./multiDecide";
import type { CoFormInputField } from "../types";

/**
 * Les cas couverts ici viennent d'un relevé sur `pixelhumain1` : 266 inputs
 * `multiDecide` sur 206 formulaires, `inputConfig.multiDecide` posé sur 136
 * d'entre eux, pointant vers 4 types distincts (dont un custom de costum).
 */

const champ = (type: string, extra: Partial<CoFormInputField> = {}): CoFormInputField =>
  ({ type, label: "Dépenses", isRequired: false, ...extra }) as CoFormInputField;

describe("isMultiDecideType", () => {
  it("détecte par SEGMENT, comme le legacy", () => {
    // `in_array("multiDecide", explode(".", $type))` — pas une égalité stricte.
    expect(isMultiDecideType("tpls.forms.ocecoform.multiDecide")).toBe(true);
    expect(isMultiDecideType("tpls.forms.multiDecide.autre")).toBe(true);
  });

  it("ne confond pas avec un type qui contient le mot sans l'isoler", () => {
    expect(isMultiDecideType("tpls.forms.aap.multiDecideur")).toBe(false);
    expect(isMultiDecideType("tpls.forms.aap.selection")).toBe(false);
    expect(isMultiDecideType(undefined)).toBe(false);
    expect(isMultiDecideType("")).toBe(false);
  });
});

describe("multiDecideTargetKey", () => {
  it("prend le dernier segment — c'est la clé réellement stockée en base", () => {
    // Relevé : `selection` 654 réponses, `evaluation` 36, `pourContre` 11,
    // tandis que la clé d'origine `decide` en compte 0.
    expect(multiDecideTargetKey("tpls.forms.aap.selection")).toBe("selection");
    expect(multiDecideTargetKey("tpls.forms.aap.evaluation")).toBe("evaluation");
    expect(multiDecideTargetKey("tpls.forms.ocecoform.pourContre")).toBe("pourContre");
    // Type custom d'un costum, présent une fois en base.
    expect(multiDecideTargetKey("custom.fondationTerritorialeDesLumieres.selection")).toBe("selection");
  });
});

describe("resolveMultiDecide", () => {
  it("laisse passer un input ordinaire sans y toucher", () => {
    const f = champ("tpls.forms.text");
    const r = resolveMultiDecide("monChamp", f, { multiDecide: "tpls.forms.aap.selection" });
    expect(r).toEqual({ key: "monChamp", field: f });
    expect(r!.field).toBe(f); // même référence : aucune copie inutile
  });

  it("substitue le type ET la clé", () => {
    // Cas réel du formulaire « Les communs des CAEs » (677e7e389058e31575550ac8) :
    // la clé est `decide`, le libellé « Dépenses », mais l'input rendu est
    // l'évaluation à tableau 2D.
    const r = resolveMultiDecide("decide", champ("tpls.forms.ocecoform.multiDecide"), {
      multiDecide: "tpls.forms.aap.selection",
    });
    expect(r).toEqual({
      key: "selection",
      field: expect.objectContaining({ type: "tpls.forms.aap.selection", label: "Dépenses" }),
    });
  });

  it("conserve la définition d'origine — seul le type change", () => {
    const r = resolveMultiDecide(
      "decide",
      champ("tpls.forms.ocecoform.multiDecide", { isRequired: true, info: "aide", width: "col-span-6" }),
      { multiDecide: "tpls.forms.ocecoform.pourContre" }
    );
    expect(r!.field).toMatchObject({ isRequired: true, info: "aide", width: "col-span-6" });
  });

  it("SANS config : l'input ne se rend pas du tout", () => {
    // Parité legacy : `multiDecide.php` n'affiche qu'un <select> gardé par
    // `if ($canEditForm)`. Un répondant ne voit rien — surtout pas un bandeau
    // « template introuvable ». 130 formulaires sont dans ce cas.
    for (const cfg of [undefined, null, {}, { multiDecide: "" }, { multiDecide: "   " }]) {
      expect(resolveMultiDecide("decide", champ("tpls.forms.ocecoform.multiDecide"), cfg)).toBeNull();
    }
  });
});
