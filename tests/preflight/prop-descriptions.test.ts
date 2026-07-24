import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  resolveBlockSchema,
  resolveJsonSchemaPath,
  type JsonSchemaNode,
} from "../../scripts/lib/config-blocks";
import { PROP_DESCRIPTIONS, BLOCK_NOTES } from "../../scripts/lib/prop-descriptions";

/**
 * Garde-fou du registre de sémantique (scripts/lib/prop-descriptions.ts,
 * fusionné au dump par config:schema) : une entrée dont le chemin ne résout
 * plus dans le schéma Zod réel est une entrée MORTE → ce test échoue.
 * C'est la contrepartie de la décision « registre séparé plutôt que
 * .describe() inline » (commentaire/refonte-assistant-config.md, axe A3).
 */

function dump(selector: string): JsonSchemaNode {
  const schema = resolveBlockSchema(selector);
  expect(schema, `sélecteur "${selector}" du registre inconnu de config-schema`).toBeDefined();
  return z.toJSONSchema(schema!, { unrepresentable: "any" }) as JsonSchemaNode;
}

describe("registre prop-descriptions ⇄ schéma (garde-fou)", () => {
  it("chaque chemin du registre résout dans le JSON Schema de son bloc (pas d'entrée morte)", () => {
    for (const [selector, descs] of Object.entries(PROP_DESCRIPTIONS)) {
      const json = dump(selector);
      for (const path of Object.keys(descs)) {
        expect(
          resolveJsonSchemaPath(json, path).length,
          `entrée morte : ${selector} → ${path}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("chaque note de bloc pointe un sélecteur valide et n'est pas vide", () => {
    for (const [selector, notes] of Object.entries(BLOCK_NOTES)) {
      expect(resolveBlockSchema(selector), `sélecteur de note "${selector}"`).toBeDefined();
      for (const note of notes) expect(note.trim().length, `note vide sur ${selector}`).toBeGreaterThan(10);
    }
  });

  it("les descriptions sont substantielles et tiennent en une phrase", () => {
    for (const [selector, descs] of Object.entries(PROP_DESCRIPTIONS)) {
      for (const [path, desc] of Object.entries(descs)) {
        expect(desc.trim().length, `desc trop courte : ${selector} → ${path}`).toBeGreaterThan(15);
        expect(desc.length, `desc trop longue (>220) : ${selector} → ${path}`).toBeLessThanOrEqual(220);
      }
    }
  });

  it("couverture des blocs chauds (informative)", () => {
    const hot = ["header", "footer", "theme", "commandPalette", "section:searchPro", "section:searchProStatic", "section:agenda"];
    const lines = hot.map((s) => `${s.padEnd(28)} ${Object.keys(PROP_DESCRIPTIONS[s] ?? {}).length} descriptions`);
    console.log(`\nCouverture prop-descriptions :\n${lines.join("\n")}`);
    // Ratchet minimal : les blocs chauds ne doivent pas retomber à zéro.
    for (const s of hot) {
      expect(Object.keys(PROP_DESCRIPTIONS[s] ?? {}).length, `bloc chaud sans description : ${s}`).toBeGreaterThan(0);
    }
  });
});
