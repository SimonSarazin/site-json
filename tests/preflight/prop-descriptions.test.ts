import { describe, it, expect } from "vitest";
import {
  resolveBlockSchema,
  resolveJsonSchemaPath,
  type JsonSchemaNode, dumpJsonSchema, ROOT_BLOCK_SELECTORS, sectionOptions, collapseSectionUnions } from "../../scripts/lib/config-blocks";
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
  return dumpJsonSchema(schema!);
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

  /**
   * Plancher PAR BLOC, à ne jamais descendre. L'ancien ratchet (`> 0`) laissait
   * passer une chute de 57 descriptions à 1 : il ne protégeait rien.
   * Faire MONTER ces nombres au fil des passes ; les baisser exige une raison
   * écrite dans le message de commit.
   */
  const MIN_COVERAGE: Record<string, number> = {
    admin: 25,
    auth: 17,
    commandPalette: 16,
    footer: 12,
    header: 26,
    meta: 10,
    page: 17,
    profiles: 25,
    "section:agenda": 15,
    "section:cardCountCT": 4,
    "section:data-observatory": 4,
    "section:filters": 10,
    "section:searchHeader": 10,
    "section:searchPro": 60,
    "section:searchProStatic": 72,
    "section:thematics": 2,
    theme: 11,
  };

  it("la couverture par bloc ne régresse pas (plancher chiffré)", () => {
    const lines = Object.keys(MIN_COVERAGE)
      .sort()
      .map((s) => `${s.padEnd(28)} ${Object.keys(PROP_DESCRIPTIONS[s] ?? {}).length} / min ${MIN_COVERAGE[s]}`);
    console.log(`\nCouverture prop-descriptions :\n${lines.join("\n")}`);
    for (const [selector, min] of Object.entries(MIN_COVERAGE)) {
      expect(
        Object.keys(PROP_DESCRIPTIONS[selector] ?? {}).length,
        `couverture en baisse sur « ${selector} »`,
      ).toBeGreaterThanOrEqual(min);
    }
  });

  it("aucun dump ne redevient illisible (plafond de taille)", () => {
    // Avant `reused: "ref"` + repli de l'union Section, `profiles` sortait
    // 683 Ko et `page` 509 Ko : l'outil central de la skill était inutilisable
    // sur les blocs les plus courants. Plafond large (60 Ko ≈ 15k tokens, le
    // maximum actuel étant ~40 Ko) : il n'attrape que la vraie régression.
    const CEILING = 60_000;
    const selectors = [...ROOT_BLOCK_SELECTORS, ...[...sectionOptions().keys()].map((t) => `section:${t}`)];
    const oversized = selectors
      .map((s) => {
        const schema = resolveBlockSchema(s);
        if (!schema) return null;
        const size = JSON.stringify(collapseSectionUnions(dumpJsonSchema(schema)), null, 2).length;
        return size > CEILING ? `${s} (${Math.round(size / 1000)} Ko)` : null;
      })
      .filter(Boolean);
    expect(oversized, "dumps au-dessus du plafond").toEqual([]);
  });

  it("tout bloc décrit est sous plancher (aucun bloc hors ratchet)", () => {
    // Ajouter un bloc au registre sans l'inscrire au plancher le laisserait
    // libre de régresser — le ratchet doit couvrir TOUT ce qui est décrit.
    const nonSuivis = Object.keys(PROP_DESCRIPTIONS).filter((s) => !(s in MIN_COVERAGE));
    expect(nonSuivis, "blocs décrits mais absents de MIN_COVERAGE").toEqual([]);
  });
});
