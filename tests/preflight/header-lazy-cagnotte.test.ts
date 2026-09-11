import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Anti-régression bundle — les headers ne tirent PAS le module cagnotte en
 * statique.
 *
 * Chaque header est un chunk `lazy()` (cf. `SiteHeader.tsx`) préchargé sur
 * CHAQUE page, pour TOUS les sites. Un `import PiggyBankHeaderButton from
 * "@/modules/cagnotte/…"` y embarque la fermeture complète de la cagnotte
 * (dialog, parts, adaptateur, permissions, i18n — ~35 fichiers / 260 Ko de
 * source) même sur les sites qui n'activent ni `piggyBank` ni `pledge` : le
 * `&&` du header ne retient pas un import statique. Le patron attendu est celui
 * de `NotificationBell` : un wrapper `lazy(() => import(…))` derrière
 * `useHydrated` (`header/CagnotteHeaderButtons.tsx`).
 *
 * Le test calcule la fermeture des imports STATIQUES de chaque header (les
 * `import()` dynamiques sont exclus — c'est précisément la frontière du chunk)
 * et échoue dès qu'un fichier du module cagnotte y entre, hors `schema.ts`, que
 * `site-schema` tire de toute façon.
 */

const ROOT = path.resolve(__dirname, "../..");
const SRC = path.join(ROOT, "src");
const HEADER_DIR = path.join(SRC, "components/layout/header");

const EXT_TRAVERSED = [".ts", ".tsx", ".js", ".jsx"];
const EXT_ASSET = [".json", ".css", ".svg", ".png", ".jpg", ".webp"];

/** `import … from "x"` / `export … from "x"` / `import "x"` — jamais `import type`, jamais `import("x")`. */
const STATIC_IMPORT_RE =
  /^[ \t]*(?:import\s+(?!type\s)(?:[^;'"]*?\s)?from\s*|export\s+(?:\*|\{[^}]*\})\s*(?:as\s+\w+\s*)?from\s*|import\s*)['"]([^'"]+)['"]/gm;

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

function resolveSpecifier(fromFile: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(fromFile), spec);
  else return null; // paquet npm

  const candidates = [
    base,
    ...EXT_TRAVERSED.map((e) => base + e),
    ...EXT_ASSET.map((e) => base + e),
    ...EXT_TRAVERSED.map((e) => path.join(base, "index" + e)),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

/** Fermeture des imports statiques d'un fichier (chemins relatifs à la racine). */
function staticClosure(entry: string): string[] {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (!EXT_TRAVERSED.includes(path.extname(file))) continue;
    const src = stripComments(fs.readFileSync(file, "utf-8"));
    for (const m of src.matchAll(STATIC_IMPORT_RE)) {
      const resolved = resolveSpecifier(file, m[1]);
      if (resolved && !seen.has(resolved)) stack.push(resolved);
    }
  }
  return [...seen].map((f) => path.relative(ROOT, f)).sort();
}

const HEADERS = fs
  .readdirSync(HEADER_DIR)
  .filter((f) => /^Header[A-Z]\w*\.tsx$/.test(f) && !f.endsWith(".test.tsx"))
  .sort();

const CAGNOTTE_TOLERATED = new Set(["src/modules/cagnotte/schema.ts"]);

describe("Preflight — les headers ne tirent pas le module cagnotte en statique", () => {
  it("trouve bien les headers du dépôt", () => {
    expect(HEADERS).toContain("HeaderStandard.tsx");
    expect(HEADERS).toContain("HeaderTransparentScroll.tsx");
  });

  it("la marche suit les imports (garde-fou : une fermeture vide passerait à tort)", () => {
    const closure = staticClosure(path.join(HEADER_DIR, "HeaderStandard.tsx"));
    expect(closure.length).toBeGreaterThan(20);
    expect(closure).toContain("src/components/layout/header/CagnotteHeaderButtons.tsx");
    expect(closure).toContain("src/modules/notification/components/NotificationBell.tsx");
    // Le patron NotificationBell est respecté : l'impl reste derrière un `import()`.
    expect(closure).not.toContain("src/modules/notification/components/NotificationBellImpl.tsx");
  });

  for (const header of HEADERS) {
    it(`${header} n'embarque aucun fichier de src/modules/cagnotte (hors schema.ts)`, () => {
      const offenders = staticClosure(path.join(HEADER_DIR, header)).filter(
        (f) => f.startsWith("src/modules/cagnotte/") && !CAGNOTTE_TOLERATED.has(f),
      );
      if (offenders.length > 0) {
        console.error(
          `\n❌ ${header} tire ${offenders.length} fichier(s) cagnotte en statique — le chunk du header grossit pour TOUS les sites :\n` +
            offenders.map((f) => `  - ${f}`).join("\n") +
            "\n\nPasser par les wrappers lazy de `header/CagnotteHeaderButtons.tsx`.\n",
        );
      }
      expect(offenders).toEqual([]);
    });
  }
});
