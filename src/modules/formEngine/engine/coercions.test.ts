import { describe, expect, it } from "vitest";
import { coerceBool, coerceBoolString, coerceString } from "./coercions";
import { applyTransform } from "./transforms";

describe("coerce:boolString", () => {
  it("écrit la CHAÎNE 'true'/'false' (parité legacy form-urlencoded)", () => {
    expect(coerceBoolString(true)).toBe("true");
    expect(coerceBoolString(false)).toBe("false");
  });

  it("accepte les entrées lâches comme coerce:bool", () => {
    expect(coerceBoolString("true")).toBe("true");
    expect(coerceBoolString("oui")).toBe("true");
    expect(coerceBoolString(1)).toBe("true");
    expect(coerceBoolString("non")).toBe("false");
    expect(coerceBoolString(undefined)).toBe("false");
  });

  it("fait l'aller-retour avec coerce:bool (read)", () => {
    expect(coerceBool(coerceBoolString(true))).toBe(true);
    expect(coerceBool(coerceBoolString(false))).toBe(false);
  });

  it("comble le trou de coerce:string, qui perd les booléens", () => {
    expect(coerceString(true)).toBe(""); // ← pourquoi ce transform existe
    expect(coerceBoolString(true)).toBe("true");
  });

  it("est enregistré sous la clé 'coerce:boolString'", () => {
    expect(applyTransform("coerce:boolString", true, {})).toBe("true");
  });
});

describe("write costum : sérialisation vers la forme STOCKÉE par le legacy", () => {
  // Le legacy poste en form-urlencoded : un champ costum est stocké en CHAÎNE, quelle que soit sa
  // sémantique. Ces transforms sont la moitié ÉCRITURE, longtemps absente — d'où un formulaire qui
  // renvoyait tableaux/booléens/nombres JS contre un contrat `string`.
  it("coerce:csv normalise vers \",\" sans espace (forme majoritaire), relue à l'identique", () => {
    // l'aller-retour est stable en VALEURS, pas en octets : les deux formes stockées relisent pareil,
    // et l'écriture converge vers la majoritaire (2 989 sans espace vs 2 767 avec).
    const majoritaire = "Réception / Accueil,Buvette,Infirmerie";
    expect(applyTransform("coerce:csv", applyTransform("coerce:stringArray", majoritaire, {}), {})).toBe(majoritaire);
    const avecEspaces = "Réception / Accueil, Buvette, Infirmerie";
    expect(applyTransform("coerce:csv", applyTransform("coerce:stringArray", avecEspaces, {}), {})).toBe(majoritaire);
    expect(applyTransform("coerce:csv", ["Tennis"], {})).toBe("Tennis");
    expect(applyTransform("coerce:csv", [], {})).toBe("");            // vide → "" (efface, cf. prepElementData)
    expect(applyTransform("coerce:csv", ["  A  ", "", "B"], {})).toBe("A,B"); // trim + vides écartés
    // SÉCURITÉ : une valeur à virgule INTERNE éclaterait au split de relecture → elle part en TABLEAU
    // (forme légitime au contrat), la valeur reste EXACTE et le round-trip est sans perte.
    expect(applyTransform("coerce:csv", ["Vtt (Cross Country, Descente)"], {})).toEqual(["Vtt (Cross Country, Descente)"]);
    const mixte = applyTransform("coerce:csv", ["A, B", "C"], {});
    expect(mixte).toEqual(["A, B", "C"]);                                             // array : rien n'est altéré
    expect(applyTransform("coerce:stringArray", mixte, {})).toEqual(["A, B", "C"]);   // relecture identique
    // STABILITÉ multi-cycles : une fois en array, la valeur n'approche plus JAMAIS un join ni un split —
    // chaque cycle read→write la reproduit à l'identique (pas d'éclatement différé au save suivant).
    let v: unknown = ["Vtt (Cross Country, Descente)", "Tennis"];
    for (let cycle = 0; cycle < 3; cycle++) {
      v = applyTransform("coerce:csv", applyTransform("coerce:stringArray", v, {}), {});
      expect(v).toEqual(["Vtt (Cross Country, Descente)", "Tennis"]);
    }
  });

  it("les trois formes booléennes du parc sont distinctes et relisibles", () => {
    for (const [cle, vrai, faux] of [["coerce:boolUpper", "TRUE", "FALSE"],
      ["coerce:boolOuiNon", "Oui", "Non"], ["coerce:boolString", "true", "false"]] as const) {
      expect(applyTransform(cle, true, {})).toBe(vrai);
      expect(applyTransform(cle, false, {})).toBe(faux);
      // relecture : coerce:bool normalise la casse → l'aller-retour tient pour les trois formes
      expect(applyTransform("coerce:bool", vrai, {})).toBe(true);
      expect(applyTransform("coerce:bool", faux, {})).toBe(false);
    }
  });

  it("coerce:numString OMET le vide au lieu d'écrire \"\" (sinon l'édition efface)", () => {
    expect(applyTransform("coerce:numString", 42, {})).toBe("42");
    expect(applyTransform("coerce:numString", 0, {})).toBe("0");        // 0 est une valeur, pas un vide
    for (const vide of [undefined, null, ""]) expect(applyTransform("coerce:numString", vide, {})).toBeUndefined();
  });
});
