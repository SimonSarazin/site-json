import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { Header, Footer } from "@/types/site-schema";
import { ListConfSchema, PreviewConfSchema } from "@/modules/search/schema";
import { sectionPreviews, chromePreviews } from "../../scripts/lib/design-previews";

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

/** Shape d'un ZodObject éventuellement enveloppé (ZodOptional/ZodDefault). */
function innerShape(schema: z.ZodType): Record<string, z.ZodType> {
  let cur: unknown = schema;
  for (let i = 0; i < 4; i++) {
    const rec = cur as { shape?: Record<string, z.ZodType>; def?: { innerType?: unknown } };
    if (rec.shape) return rec.shape;
    if (rec.def?.innerType) cur = rec.def.innerType;
    else break;
  }
  throw new Error("shape introuvable");
}

/** Types backtickés en 1re colonne des lignes de table d'une section du SKILL. */
function tableTypes(sectionHeading: string): string[] {
  const start = skill.indexOf(sectionHeading);
  expect(start, `section "${sectionHeading}" absente du SKILL`).toBeGreaterThan(-1);
  const next = skill.indexOf("### ", start + sectionHeading.length);
  const block = skill.slice(start, next === -1 ? undefined : next);
  return [...block.matchAll(/^\| `([^`]+)`/gm)].map((m) => m[1]);
}

/**
 * Colonne « surface » (2ᵉ) de chaque ligne de la table Modules, par module.
 * `tableTypes` ne lit que la 1ʳᵉ colonne : la ligne `aac` a pu annoncer une
 * section `aac` et une route `/aac/:formId` qui n'existaient pas (review MR 53,
 * H28/M5) sans que rien ne rougisse.
 */
function modulesSurface(): Map<string, string> {
  const start = skill.indexOf("### Modules");
  const next = skill.indexOf("### ", start + 1);
  const block = skill.slice(start, next === -1 ? undefined : next);
  const out = new Map<string, string>();
  for (const m of block.matchAll(/^\| `([^`]+)` \| (.+?) \| /gm)) out.set(m[1], m[2]);
  return out;
}

/** Clés de la map LazySections de SectionRenderer.tsx (lecture texte, comme section-meta.test.ts). */
function rendererTypes(): string[] {
  const src = fs.readFileSync(path.join(ROOT, "src/components/sections/SectionRenderer.tsx"), "utf-8");
  return [...src.matchAll(/^\s+"?([\w-]+)"?:\s*lazy\(/gm)].map((m) => m[1]);
}

/** Tous les `path: "…"` littéraux des `src/modules/*\/routes.tsx`, sans slash de tête (`aac/commun/:answerId`). */
function moduleRoutePaths(): string[] {
  const dir = path.join(ROOT, "src/modules");
  const out: string[] = [];
  for (const mod of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, mod.name, "routes.tsx");
    if (!mod.isDirectory() || !fs.existsSync(file)) continue;
    for (const m of fs.readFileSync(file, "utf-8").matchAll(/path:\s*"([^"]+)"/g)) out.push(m[1].replace(/^\//, ""));
  }
  return out;
}

describe("skill config-assistant ⇄ code (anti-dérive)", () => {
  // `default` INCLUS : ce n'est pas un design (il délègue à HeaderStandard /
  // FooterRich) mais il existe dans des configs réelles — un agent qui en
  // rencontre un doit trouver la ligne qui l'explique.
  it("la table Headers couvre exactement l'enum header.type", () => {
    const real = enumOptions(Header.shape.type);
    const documented = tableTypes("### Headers");
    expect(documented.sort()).toEqual(real.sort());
  });

  it("la table Footers couvre exactement l'enum footer.type", () => {
    const real = enumOptions(Footer.shape.type);
    const documented = tableTypes("### Footers");
    expect(documented.sort()).toEqual(real.sort());
  });

  it("la table Presenters — cartes couvre exactement l'enum card.type", () => {
    const real = enumOptions(innerShape(ListConfSchema.shape.card).type);
    const documented = tableTypes("### Presenters — cartes");
    expect(documented.sort()).toEqual(real.sort());
  });

  it("la table Presenters — previews couvre exactement l'enum preview.type", () => {
    const real = enumOptions(PreviewConfSchema.shape.type);
    const documented = tableTypes("### Presenters — previews");
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

  it("la colonne « surface » de la table Modules ne cite que des sections enregistrées", () => {
    const real = rendererTypes();
    const cited: Array<{ mod: string; type: string }> = [];
    for (const [mod, surface] of modulesSurface()) {
      // « section `x` », « sections `a`/`b`/`*-summary` » — la chaîne backtickée qui suit le mot.
      for (const m of surface.matchAll(/\bsections? ((?:`[^`]+`\s*\/?\s*)+)/g)) {
        for (const t of m[1].matchAll(/`([^`]+)`/g)) cited.push({ mod, type: t[1] });
      }
    }
    expect(cited.length).toBeGreaterThan(10);
    for (const { mod, type } of cited) {
      const re = new RegExp(`^${type.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
      expect(real.some((t) => re.test(t)), `module ${mod} : section \`${type}\` inconnue de SectionRenderer`).toBe(true);
    }
  });

  it("la colonne « surface » de la table Modules ne cite que des routes déclarées par un module", () => {
    const declared = moduleRoutePaths();
    let cited = 0;
    for (const [mod, surface] of modulesSurface()) {
      for (const m of surface.matchAll(/`(\/[^`\s]+)`/g)) {
        cited++;
        const route = m[1].replace(/^\//, "");
        // Une route imbriquée est citée par son suffixe (« + `/answer/:answerId` » sous coform).
        const ok = declared.some((p) => p === route || p.endsWith(`/${route}`));
        expect(ok, `module ${mod} : route \`${m[1]}\` déclarée par aucun src/modules/*/routes.tsx`).toBe(true);
      }
    }
    expect(cited).toBeGreaterThan(5);
  });

  it("les compteurs de stories (.design-sync/previews) cités par la skill sont exacts", () => {
    const sections = rendererTypes().length;
    const withStory = sectionPreviews(ROOT).size;
    const stories = fs.readdirSync(path.join(ROOT, ".design-sync/previews")).filter((f) => f.endsWith(".tsx")).length;
    const headers = chromePreviews(ROOT, "Header").length;
    const footers = chromePreviews(ROOT, "Footer").length;
    // « 43 des 77 sections … (les 34 sans … » — le total est déjà contrôlé par
    // section-meta.test.ts ; ici la part AVEC story et son complément (28 ≠ 77 − 43).
    expect(skill).toContain(`**${withStory} des ${sections} sections**`);
    expect(skill).toContain(`les ${sections - withStory} sans`);
    for (const m of skill.matchAll(/\b(\d+) stories\b/g)) expect(Number(m[1]), "N stories").toBe(stories);
    for (const m of skill.matchAll(/\b(\d+) headers\b/g)) expect(Number(m[1]), "N headers").toBe(headers);
    for (const m of skill.matchAll(/\b(\d+) footers\b/g)) expect(Number(m[1]), "N footers").toBe(footers);
  });

  it("les outils référencés existent (scripts npm + fichiers)", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8")) as {
      scripts: Record<string, string>;
    };
    for (const alias of ["config:validate", "config:schema", "entity:slug", "audit:config", "test:preflight", "config:costum", "admin:scaffold", "config:example", "config:init", "config:fix", "config:probe", "config:render"]) {
      expect(pkg.scripts[alias], `script npm "${alias}" référencé par la skill`).toBeDefined();
      expect(skill).toContain(alias);
    }
    // `.claude/agents/siteforge-config-auditor.md` n'est PAS dans la liste bien que
    // la skill le référence : `.claude/*` est GITIGNORÉ (.gitignore:33, seul
    // `.claude/skills/` est versionné) — l'agent est un fichier LOCAL, absent d'un
    // clone frais et d'une CI. Même doctrine que CLAUDE.md dans section-meta.test.ts.
    for (const file of ["scripts/validate-config.ts", "scripts/config-schema.ts", "scripts/entity-slug.ts", "scripts/admin-scaffold.ts", "scripts/gen-costum-config.ts", "scripts/config-example.ts", "scripts/lib/archetypes.ts", "scripts/lib/config-blocks.ts", "scripts/lib/prop-descriptions.ts", ".claude/skills/config-assistant/archetypes.json", ".claude/skills/config-assistant/examples", ".claude/skills/config-assistant/references/formulaires-costum.md", ".claude/skills/config-assistant/references/admin.md", ".claude/skills/config-assistant/references/theme.md", ".claude/skills/config-assistant/page-recipes.json", "scripts/lib/design-previews.ts", "scripts/lib/presenter-options.ts", "scripts/lib/module-routes.ts", "scripts/lib/code-vocabulary.ts", "scripts/config-init.ts", "scripts/fix-config.ts", "scripts/config-probe.ts", "scripts/config-render.ts", ".design-sync/previews", ".design-sync/config.json", ".design-sync/conventions.md", ".design-sync/NOTES.md", "src/modules/search/components/SearchCard.tsx", "src/modules/search/components/Preview.tsx", "src/styles/shared.css", "doc/26-assistant-config.md", "doc/30-module-admin.md"]) {
      expect(fs.existsSync(path.join(ROOT, file)), `fichier ${file}`).toBe(true);
    }
  });

  it("aucun ancien nom de section nommé par site dans la skill", () => {
    for (const stale of ["hero-tiers-lieux", "hero-rezo-la-mer", "hero-ssbe", "title-with-filters-rezo-la-mer", "cta-rezo-la-mer"]) {
      expect(skill).not.toContain(stale);
    }
  });
});
