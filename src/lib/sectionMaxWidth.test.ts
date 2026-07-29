import { describe, it, expect } from "vitest";
import { SECTION_MAX_WIDTH, sectionMaxWidthClass } from "./sectionMaxWidth";

/**
 * La raison d'être de ce helper est le REPLI : la config JSON n'étant jamais
 * parsée par Zod à l'exécution, une valeur hors énumération (faute de frappe,
 * échelon inventé) arrive telle quelle jusqu'ici. Sans repli, la classe
 * `max-w-undefined` n'existe pas et la section perd TOUTE largeur maximale —
 * l'échec le plus visible pour la faute la plus discrète.
 */
describe("sectionMaxWidthClass", () => {
  it("rend la classe de l'échelon demandé", () => {
    expect(sectionMaxWidthClass("5xl", "8xl")).toBe("max-w-5xl");
    expect(sectionMaxWidthClass("full", "8xl")).toBe("max-w-none");
  });

  it("absent → repli du composant appelant", () => {
    expect(sectionMaxWidthClass(undefined, "8xl")).toBe("max-w-8xl");
    expect(sectionMaxWidthClass(undefined, "7xl")).toBe("max-w-7xl");
  });

  it("🔒 valeur hors énumération → repli, JAMAIS une classe inexistante", () => {
    for (const bogus of ["5x1", "1440", "9xl", "", "max-w-5xl"]) {
      const cls = sectionMaxWidthClass(bogus, "8xl");
      expect(cls).toBe("max-w-8xl");
      expect(cls).not.toContain("undefined");
    }
  });

  it("toutes les classes sont écrites en toutes lettres (détectables par Tailwind)", () => {
    // Une classe construite à l'exécution (`max-w-${w}`) serait purgée du build :
    // le scanner de Tailwind ne lit que des littéraux dans les sources.
    for (const [echelon, cls] of Object.entries(SECTION_MAX_WIDTH)) {
      expect(cls).toMatch(/^max-w-[a-z0-9]+$/);
      expect(cls.includes("${")).toBe(false);
      expect(echelon.length).toBeGreaterThan(0);
    }
  });
});
