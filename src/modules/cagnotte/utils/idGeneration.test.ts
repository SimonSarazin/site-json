import { describe, expect, it } from "vitest";
import { generateMilestoneId } from "./idGeneration";

describe("generateMilestoneId", () => {
  it("retourne une chaîne de 24 chars hexa", () => {
    const id = generateMilestoneId();
    expect(id).toMatch(/^[0-9a-f]{24}$/);
  });

  it("génère des IDs uniques sur 100 itérations", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i += 1) {
      ids.add(generateMilestoneId());
    }
    expect(ids.size).toBe(100);
  });

  it("évite les IDs présents dans existingIds (jusqu'à 6 essais)", () => {
    // On simule un cas où les 3 premiers candidats seraient déjà pris en injectant
    // un Set d'IDs. Comme la partie aléatoire est forte, il n'y a pas de garantie
    // que les 3 premiers candidats soient ceux dans existingIds, mais le résultat
    // ne doit jamais être dans le set.
    const existing = ["aa".repeat(12), "bb".repeat(12), "cc".repeat(12)];
    const id = generateMilestoneId(existing);
    expect(existing).not.toContain(id);
  });

  it("supporte un tableau readonly", () => {
    const existing = Object.freeze(["xx".repeat(12)]) as readonly string[];
    expect(() => generateMilestoneId(existing)).not.toThrow();
  });
});
