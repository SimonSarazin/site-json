import { describe, it, expect } from "vitest";
import { toText } from "./toText";

describe("toText — champ texte potentiellement en forme inattendue", () => {
  it("string non vide, espaces retirés", () => {
    expect(toText("  Bonjour  ")).toBe("Bonjour");
  });

  it("string vide ou faite d'espaces → null", () => {
    expect(toText("")).toBeNull();
    expect(toText("   ")).toBeNull();
  });

  it("valeur non textuelle (objet, nombre, null, undefined) → null, jamais levée en React child", () => {
    expect(toText({ fr: "Bonjour" })).toBeNull();
    expect(toText(42)).toBeNull();
    expect(toText(null)).toBeNull();
    expect(toText(undefined)).toBeNull();
  });
});
