import { describe, it, expect } from "vitest";
import { initiales } from "./initiales";

describe("initiales", () => {
  it("prend la première lettre de chaque mot, deux au plus", () => {
    expect(initiales("Ludivine Dupire Fait")).toBe("LD");
    expect(initiales("Margaux Daron")).toBe("MD");
    expect(initiales("Sophie")).toBe("S");
  });

  it("majuscule, quelle que soit la casse saisie", () => {
    expect(initiales("ludivine dupire")).toBe("LD");
  });

  it("ignore les espaces surnuméraires plutôt que de rendre une initiale vide", () => {
    // Sans le filtre, « Jean  Paul » (double espace) rendait « J » + "" + « P ».
    expect(initiales("  Jean   Paul  ")).toBe("JP");
  });

  it("respecte `max` — c'est ce qui permettra d'aligner les avatars à une lettre", () => {
    expect(initiales("Ludivine Dupire Fait", 1)).toBe("L");
    expect(initiales("Ludivine Dupire Fait", 3)).toBe("LDF");
  });

  it("rend une chaîne vide plutôt que de planter sur une valeur absente", () => {
    expect(initiales(null)).toBe("");
    expect(initiales(undefined)).toBe("");
    expect(initiales("")).toBe("");
    expect(initiales("   ")).toBe("");
  });
});
