import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

/**
 * Garde des GARDES DE PAGE : ce que les configs du parc déclarent en matière d'accès doit
 * réellement produire un effet.
 *
 * Deux pièges, tous deux SILENCIEUX, qui ont chacun fermé ou ouvert une page sans le moindre signal :
 *
 *  1. `page.auth.roles` teste des clés BRUTES de `me.serverData.roles`. Le SDK ne connaît que
 *     `superAdmin` et `adminPlatform` ; tout autre nom rend le test faux pour TOUT LE MONDE,
 *     superAdmin compris. `config.prod.json` déclarait `roles: ["admin"]` sur son `/admin` :
 *     la page refusait l'accès à l'univers entier. Préférer `auth.access`.
 *  2. `page.middleware` est un tableau de noms libres résolus par `registry[mw]?.(…)` — l'optional
 *     chaining fait qu'un nom inconnu ne déclenche RIEN. Une page qui se croit protégée ne l'est
 *     pas. (La description lue par l'assistant de config annonçait `admin-required`, qui n'existe
 *     pas : le nom réel est `admin-only`.)
 */

const RACINE = path.resolve(__dirname, "../..");

/** Clés de rôle que le SDK peuple réellement sur `me.serverData.roles`. */
const ROLES_REELS = new Set(["superAdmin", "adminPlatform"]);
/** Noms présents dans le registre de `src/hooks/usePageGuards.ts`. */
const MIDDLEWARES_REELS = new Set(["auth-required", "admin-only", "redirect-if-authenticated"]);

interface PageLike {
  path?: string;
  auth?: { required?: boolean; roles?: string[]; access?: string; mode?: string };
  middleware?: string[];
}

const CONFIGS = fs
  .readdirSync(RACINE)
  .filter((f) => /^config\.prod(\..+)?\.json$/.test(f))
  .map((f) => ({
    nom: f,
    pages: (JSON.parse(fs.readFileSync(path.join(RACINE, f), "utf-8")).pages ?? []) as PageLike[],
  }));

describe("gardes de page — ce qui est déclaré doit avoir un effet", () => {
  it("le parc est bien découvert", () => {
    expect(CONFIGS.length).toBeGreaterThan(5);
  });

  it("aucun `auth.roles` ne cite un rôle que le SDK ne peuple pas", () => {
    const fautifs: string[] = [];
    for (const { nom, pages } of CONFIGS) {
      for (const p of pages) {
        for (const r of p.auth?.roles ?? []) {
          if (!ROLES_REELS.has(r)) fautifs.push(`${nom} · ${p.path} · roles: "${r}"`);
        }
      }
    }
    expect(
      fautifs,
      `Rôle inconnu du SDK : le test \`roles[r] === true\` sera faux pour TOUT LE MONDE.\n` +
        `Rôles réels : ${[...ROLES_REELS].join(", ")}. Préférer \`auth.access\` ("siteAdmin" | "superAdmin").\n` +
        fautifs.join("\n"),
    ).toEqual([]);
  });

  it("aucun `middleware` ne cite un nom absent du registre", () => {
    const fautifs: string[] = [];
    for (const { nom, pages } of CONFIGS) {
      for (const p of pages) {
        for (const mw of p.middleware ?? []) {
          if (!MIDDLEWARES_REELS.has(mw)) fautifs.push(`${nom} · ${p.path} · middleware: "${mw}"`);
        }
      }
    }
    expect(
      fautifs,
      `Nom hors registre : \`registry[mw]?.()\` l'ignore SANS erreur — la page n'est pas gardée.\n` +
        `Noms réels : ${[...MIDDLEWARES_REELS].join(", ")}.\n` +
        fautifs.join("\n"),
    ).toEqual([]);
  });

  it("`auth.mode` ne prend que les trois valeurs du contrat", () => {
    const fautifs: string[] = [];
    for (const { nom, pages } of CONFIGS) {
      for (const p of pages) {
        const m = p.auth?.mode;
        if (m !== undefined && !["prompt", "redirect", "hide"].includes(m)) {
          fautifs.push(`${nom} · ${p.path} · mode: "${m}"`);
        }
      }
    }
    expect(fautifs, `Mode inconnu — le moteur retombe sur "prompt".\n${fautifs.join("\n")}`).toEqual([]);
  });

  it("le registre du code et la liste attendue ici ne divergent pas", () => {
    // Verrou de miroir : si quelqu'un ajoute un middleware sans l'inscrire ici, la garde du
    // point précédent le refuserait à tort dans toutes les configs.
    const src = fs.readFileSync(path.join(RACINE, "src/hooks/usePageGuards.ts"), "utf-8");
    const registre = src.slice(src.indexOf("const registry"), src.indexOf("export function usePageGuards"));
    const noms = [...registre.matchAll(/^\s{2}"([a-z-]+)":/gm)].map((m) => m[1]);
    expect(new Set(noms)).toEqual(MIDDLEWARES_REELS);
  });
});
