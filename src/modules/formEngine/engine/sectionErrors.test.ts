import { describe, it, expect } from "vitest";
import { hasErrorAt } from "./sectionErrors";

describe("hasErrorAt (détection d'erreur de step, finding F)", () => {
  it("clé plate présente → true", () => {
    expect(hasErrorAt({ aps_name: { type: "custom", message: "validation.required" } }, "aps_name")).toBe(true);
  });

  it("clé plate absente → false", () => {
    expect(hasErrorAt({ aps_name: { message: "x" } }, "name")).toBe(false);
  });

  it("nom POINTÉ → erreur imbriquée RHF résolue (le simple `in` raterait)", () => {
    const errors = { preferences: { isOpenData: { type: "custom", message: "validation.required" } } };
    expect(hasErrorAt(errors, "preferences.isOpenData")).toBe(true);
    // garde anti-régression : la vérif plate échouerait
    expect("preferences.isOpenData" in errors).toBe(false);
  });

  it("chemin pointé partiellement présent → false (pas de feuille)", () => {
    expect(hasErrorAt({ preferences: {} }, "preferences.isOpenData")).toBe(false);
  });

  it("traversée à travers un non-objet → false (pas de crash)", () => {
    expect(hasErrorAt({ a: "scalar" }, "a.b.c")).toBe(false);
  });
});
