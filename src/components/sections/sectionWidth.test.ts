import { describe, it, expect } from "vitest";
import { sectionMaxWidthClass } from "./sectionWidth";

describe("sectionMaxWidthClass", () => {
  it("sans valeur : la largeur historique de la section", () => {
    expect(sectionMaxWidthClass(undefined, "max-w-4xl")).toBe("max-w-4xl");
    expect(sectionMaxWidthClass(undefined)).toBe("");
  });

  it("valeur connue : la classe correspondante", () => {
    expect(sectionMaxWidthClass("5xl", "max-w-4xl")).toBe("max-w-5xl");
    expect(sectionMaxWidthClass("full")).toBe("max-w-full");
  });

  it("valeur inconnue : repli, jamais une classe inventée", () => {
    expect(sectionMaxWidthClass("42xl", "max-w-4xl")).toBe("max-w-4xl");
  });
});
