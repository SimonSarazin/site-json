import { describe, it, expect } from "vitest";
import { profileSectionOptions, sectionOptions, resolveBlockSchema } from "../../scripts/lib/config-blocks";
import fs from "node:fs";
import path from "node:path";
import type { z } from "zod";
import { Section } from "@/types/site-schema";
import SECTION_META, { SECTION_FAMILIES } from "@/components/admin/section-meta";

/**
 * Parité du catalogue SECTION_META (src/components/admin/section-meta.ts) avec
 * le code : chaque membre de la discriminatedUnion `Section` doit avoir une
 * entrée (label/desc/family) — et réciproquement, pas d'entrée morte. C'est le
 * garde-fou qui a manqué quand 15 sections de modules sont restées sans
 * description dans le catalogue servi par `config:schema sections`
 * (cf. commentaire/refonte-assistant-config.md, phase 1).
 */

const ROOT = path.resolve(__dirname, "../..");

/** Littéraux `type` des membres de la discriminatedUnion Section. */
function unionTypes(): string[] {
  const options = (Section as unknown as { options: z.ZodObject<{ type: z.ZodLiteral<string> }>[] }).options;
  return options.map((opt) => (opt.shape.type as unknown as { value: string }).value);
}

/** Clés de la map LazySections de SectionRenderer.tsx (lecture texte : le module importe React/vite-preload). */
function rendererTypes(): string[] {
  const src = fs.readFileSync(path.join(ROOT, "src/components/sections/SectionRenderer.tsx"), "utf-8");
  return [...src.matchAll(/^\s+"?([\w-]+)"?:\s*lazy\(/gm)].map((m) => m[1]);
}

describe("catalogue SECTION_META ⇄ code (anti-dérive)", () => {
  it("couvre exactement l'union Section (ni section sans description, ni entrée morte)", () => {
    expect(Object.keys(SECTION_META).sort()).toEqual(unionTypes().sort());
  });

  it("SectionRenderer enregistre exactement l'union Section", () => {
    expect(rendererTypes().sort()).toEqual(unionTypes().sort());
  });

  it("chaque entrée a un label, une desc substantielle et une family valide", () => {
    for (const [type, meta] of Object.entries(SECTION_META)) {
      expect(meta.label.trim(), `label de "${type}"`).not.toBe("");
      expect(meta.desc.trim().length, `desc de "${type}"`).toBeGreaterThan(10);
      expect(SECTION_FAMILIES, `family de "${type}"`).toContain(meta.family);
    }
  });

  it("les comptes de sections cités dans la doc sont à jour", () => {
    const real = unionTypes().length;

    /**
     * `CLAUDE.md` est GITIGNORÉ (.gitignore:32) : il est absent d'un clone frais et
     * d'une CI. Un `readFileSync` inconditionnel y faisait échouer TOUT le préflight
     * sur `ENOENT` — vérifié le 2026-07-29. On le contrôle donc s'il est présent,
     * et on l'ignore sinon.
     */
    const optional = (rel: string): string | null => {
      const p = path.join(ROOT, rel);
      return fs.existsSync(p) ? fs.readFileSync(p, "utf-8") : null;
    };

    /** `**N section types**` (CLAUDE.md) / `**N sections**` (doc et skill). */
    const sources: Array<[string, string | null, RegExp]> = [
      ["CLAUDE.md", optional("CLAUDE.md"), /\*\*(\d+) section types\*\*/g],
      ["doc/26-assistant-config.md", optional("doc/26-assistant-config.md"), /\*\*(\d+) sections\*\*/g],
      // La skill écrit « **42 des 70 sections** » : la forme `**N sections**` ne
      // matchait pas, la dérive y passait donc inaperçue. On lit les DEUX nombres.
      [
        ".claude/skills/config-assistant/SKILL.md",
        optional(".claude/skills/config-assistant/SKILL.md"),
        /\*\*\d+ des (\d+) sections\*\*/g,
      ],
    ];

    for (const [label, content, re] of sources) {
      if (content === null) continue;
      for (const m of content.matchAll(re)) {
        expect(Number(m[1]), label).toBe(real);
      }
    }
  });

  it("les sections de PROFIL sont adressables par config:schema (union séparée)", () => {
    // Elles vivent sous config.profiles.<type>.tabs[].sections[] et pèsent ~360
    // occurrences dans le parc ; `section:profile-header` répondait « type
    // inconnu ». Elles n'ont PAS d'entrée SECTION_META (qui décrit les sections
    // de PAGE) — d'où ce test distinct de la parité ci-dessus.
    const profil = profileSectionOptions();
    expect(profil.size).toBeGreaterThanOrEqual(19);
    for (const type of profil.keys()) {
      expect(type.startsWith("profile-"), `type profil inattendu : ${type}`).toBe(true);
      expect(resolveBlockSchema(`section:${type}`), `section:${type} non résolue`).toBeDefined();
    }
    // Aucun chevauchement avec les sections de page (deux catalogues distincts).
    for (const type of profil.keys()) expect(sectionOptions().has(type)).toBe(false);
  });
});
