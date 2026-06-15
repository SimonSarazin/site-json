import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { Header, Footer } from "@/types/site-schema";

/**
 * Anti-dérive de la skill `config-assistant` (.claude/skills/config-assistant/
 * SKILL.md) : ses tables semi-stables (headers, footers, modules, outillage)
 * doivent refléter le code. Un commit qui change un enum, ajoute un module ou
 * renomme un script CASSE ce test → mettre à jour la SKILL, pas le test.
 * (Même discipline que la parité i18n — cf. doc/26-assistant-config.md.)
 */

const ROOT = path.resolve(__dirname, "../..");
const SKILL_PATH = path.join(ROOT, ".claude/skills/config-assistant/SKILL.md");
const skill = fs.readFileSync(SKILL_PATH, "utf-8");

/** Valeurs d'un ZodEnum éventuellement enveloppé (ZodDefault/ZodOptional). */
function enumOptions(schema: z.ZodType): string[] {
  let cur: unknown = schema;
  for (let i = 0; i < 4; i++) {
    const rec = cur as { options?: unknown; def?: { innerType?: unknown } };
    if (Array.isArray(rec.options)) return rec.options as string[];
    if (rec.def?.innerType) cur = rec.def.innerType;
    else break;
  }
  throw new Error("enum introuvable");
}

/** Types backtickés en 1re colonne des lignes de table d'une section du SKILL. */
function tableTypes(sectionHeading: string): string[] {
  const start = skill.indexOf(sectionHeading);
  expect(start, `section "${sectionHeading}" absente du SKILL`).toBeGreaterThan(-1);
  const next = skill.indexOf("### ", start + sectionHeading.length);
  const block = skill.slice(start, next === -1 ? undefined : next);
  return [...block.matchAll(/^\| `([^`]+)`/gm)].map((m) => m[1]);
}

describe("skill config-assistant ⇄ code (anti-dérive)", () => {
  it("la table Headers couvre exactement l'enum header.type (hors 'default')", () => {
    const real = enumOptions(Header.shape.type).filter((t) => t !== "default");
    const documented = tableTypes("### Headers");
    expect(documented.sort()).toEqual(real.sort());
  });

  it("la table Footers couvre exactement l'enum footer.type (hors 'default')", () => {
    const real = enumOptions(Footer.shape.type).filter((t) => t !== "default");
    const documented = tableTypes("### Footers");
    expect(documented.sort()).toEqual(real.sort());
  });

  it("la table Modules couvre exactement src/modules/", () => {
    const real = fs
      .readdirSync(path.join(ROOT, "src/modules"), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    const documented = tableTypes("### Modules");
    expect(documented.sort()).toEqual(real.sort());
  });

  it("les outils référencés existent (scripts npm + fichiers)", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8")) as {
      scripts: Record<string, string>;
    };
    for (const alias of ["config:validate", "config:schema", "entity:slug", "audit:config", "test:preflight"]) {
      expect(pkg.scripts[alias], `script npm "${alias}" référencé par la skill`).toBeDefined();
      expect(skill).toContain(alias);
    }
    for (const file of ["scripts/validate-config.ts", "scripts/config-schema.ts", "scripts/entity-slug.ts", "src/styles/shared.css", "doc/26-assistant-config.md"]) {
      expect(fs.existsSync(path.join(ROOT, file)), `fichier ${file}`).toBe(true);
    }
  });

  it("aucun ancien nom de section nommé par site dans la skill", () => {
    for (const stale of ["hero-tiers-lieux", "hero-rezo-la-mer", "hero-ssbe", "title-with-filters-rezo-la-mer", "cta-rezo-la-mer"]) {
      expect(skill).not.toContain(stale);
    }
  });
});
