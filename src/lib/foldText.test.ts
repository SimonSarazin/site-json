import { describe, it, expect } from "vitest";
import { foldText } from "./foldText";

/**
 * Le repli décide si deux noms sont « le même » : trop lâche il crie au doublon à tort, trop
 * strict il laisse passer « La Plume à loup » à côté de « La Plume à Loup » — le cas réel qui a
 * motivé la détection de doublons du formulaire tiers-lieu.
 */
describe("foldText", () => {
  it("ignore casse, accents, ponctuation et espaces multiples", () => {
    const attendu = "la plume a loup";
    expect(foldText("La Plume à Loup")).toBe(attendu);
    expect(foldText("la plume a loup")).toBe(attendu);
    expect(foldText("  La  Plume-à-Loup ! ")).toBe(attendu);
  });

  it("ramène les variantes d'apostrophe au même repli", () => {
    expect(foldText("L'Archipel")).toBe(foldText("L’Archipel"));
    expect(foldText("L'Archipel")).toBe("l archipel");
  });

  it("garde les chiffres (deux lieux numérotés restent distincts)", () => {
    expect(foldText("Le 104")).toBe("le 104");
    expect(foldText("Le 104")).not.toBe(foldText("Le 105"));
  });

  it("chaîne vide pour une valeur absente ou non textuelle", () => {
    expect(foldText(undefined)).toBe("");
    expect(foldText(null)).toBe("");
    expect(foldText({})).toBe("");
    expect(foldText("   ")).toBe("");
    expect(foldText("—")).toBe("");
  });

  it("accepte un nombre (code postal numérique)", () => {
    expect(foldText(97430)).toBe("97430");
  });
});
