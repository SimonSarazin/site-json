import { describe, it, expect } from "vitest";
import { sectionBadgeClass } from "./sectionBadge";

describe("sectionBadgeClass", () => {
  it("par défaut : l'étiquette inclinée, la signature graphique historique", () => {
    expect(sectionBadgeClass()).toContain("-rotate-4");
    expect(sectionBadgeClass("badge")).toBe(sectionBadgeClass());
    expect(sectionBadgeClass("forme-inconnue")).toBe(sectionBadgeClass());
  });

  it("`pill` : la même pastille en arrondi droit, jamais inclinée", () => {
    expect(sectionBadgeClass("pill")).toContain("rounded-full");
    expect(sectionBadgeClass("pill")).not.toContain("-rotate-4");
  });

  it("les deux formes restent distinctes (une recopie les ferait diverger)", () => {
    expect(sectionBadgeClass("pill")).not.toBe(sectionBadgeClass("badge"));
  });
});
