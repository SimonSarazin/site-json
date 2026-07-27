import { describe, it, expect } from "vitest";
import { loadRecipes, loadManifest, loadConfig, pageSectionTypes } from "../../scripts/lib/archetypes";

/**
 * Gate des recettes de COMPOSITION de page
 * (.claude/skills/config-assistant/page-recipes.json). Une recette ne décrit pas
 * une composition idéale : elle DÉSIGNE une page vivante d'une config archétype.
 * Si cette page change ou disparaît, la recette ment → ce test casse.
 *
 * Réparation : soit la page a évolué et la recette suit (mettre `sequence` à
 * jour, relire `rythme`), soit la recette doit pointer une autre page.
 */

const recipes = loadRecipes();
const archetypeConfigs = new Set(loadManifest().archetypes.map((a) => a.config));

describe("recettes de page ⇄ pages réelles des archétypes", () => {
  it("il y a des recettes et leurs id sont uniques", () => {
    expect(recipes.length).toBeGreaterThan(0);
    expect(new Set(recipes.map((r) => r.id)).size).toBe(recipes.length);
  });

  it("chaque recette pointe une config ARCHÉTYPE (donc tenue fraîche par le gate d'audit)", () => {
    for (const r of recipes) {
      expect(archetypeConfigs, `source de la recette « ${r.id} »`).toContain(r.source);
    }
  });

  it("chaque page citée existe et sa séquence de sections est EXACTEMENT celle annoncée", () => {
    for (const r of recipes) {
      const actual = pageSectionTypes(loadConfig(r.source), r.path);
      expect(actual, `page ${r.path} absente de ${r.source} (recette « ${r.id} »)`).toBeDefined();
      expect(actual, `séquence de « ${r.id} » (${r.source} ${r.path})`).toEqual(r.sequence);
    }
  });

  it("chaque recette porte de quoi décider (quand + rythme rédigés)", () => {
    for (const r of recipes) {
      expect(r.quand.length, `« ${r.id} » : champ quand`).toBeGreaterThan(30);
      expect(r.rythme.length, `« ${r.id} » : champ rythme`).toBeGreaterThan(60);
    }
  });
});
