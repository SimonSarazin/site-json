import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Preflight — intégrité des fichiers de traduction (`i18n/*.json`).
 *
 * STRICT (bloquant) sur chaque namespace :
 *  - parité des clés `fr` ↔ `en` (clé manquante d'un côté = trad non ajoutée),
 *  - aucune valeur de traduction vide,
 *  - aucun `{{placeholder}}` interpolé deux fois dans une même valeur — la
 *    marque du pluriel écrite en second placeholder (« {{count}} commun{{count}} »
 *    rendait « 3 commun3 ») ; le pluriel se déclare en `_one` / `_other`.
 *
 * Découverte automatique des namespaces (dossiers `i18n/` avec `fr.json`+`en.json`).
 */
const PROJECT_ROOT = path.resolve(__dirname, "../..");

/** Aplati récursivement les clés (objets imbriqués → `a.b.c`). */
function flatKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) keys.push(...flatKeys(v as Record<string, unknown>, key));
    else keys.push(key);
  }
  return keys;
}

/** Chemins des valeurs `""` (chaîne vide). */
function emptyValuePaths(obj: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) out.push(...emptyValuePaths(v as Record<string, unknown>, key));
    else if (v === "") out.push(key);
  }
  return out;
}

/** Chemins des valeurs qui interpolent un même `{{placeholder}}` plus d'une fois. */
function duplicatedPlaceholderPaths(obj: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push(...duplicatedPlaceholderPaths(v as Record<string, unknown>, key));
    } else if (typeof v === "string") {
      const seen = new Set<string>();
      for (const m of v.match(/\{\{\s*[\w.]+\s*\}\}/g) ?? []) {
        if (seen.has(m)) out.push(`${key} (${m})`);
        seen.add(m);
      }
    }
  }
  return out;
}

const moduleDir = path.join(PROJECT_ROOT, "src/modules");
const i18nDirs = [
  ...fs.readdirSync(moduleDir).map((m) => `src/modules/${m}/i18n`),
  "src/components/layout/i18n",
].filter(
  (d) =>
    fs.existsSync(path.join(PROJECT_ROOT, d, "fr.json")) &&
    fs.existsSync(path.join(PROJECT_ROOT, d, "en.json"))
);

const readJson = (d: string, f: string) =>
  JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, d, f), "utf-8")) as Record<string, unknown>;

describe("Preflight — Fichiers i18n", () => {
  test("au moins un namespace i18n (fr+en) est détecté", () => {
    expect(i18nDirs.length).toBeGreaterThan(0);
  });

  for (const d of i18nDirs) {
    describe(d, () => {
      const fr = readJson(d, "fr.json");
      const en = readJson(d, "en.json");
      const frKeys = new Set(flatKeys(fr));
      const enKeys = new Set(flatKeys(en));

      test("toute clé de fr.json existe dans en.json", () => {
        const onlyFr = [...frKeys].filter((k) => !enKeys.has(k));
        expect(onlyFr, `Clés présentes dans fr.json mais absentes de en.json:\n  ${onlyFr.join("\n  ")}`).toHaveLength(0);
      });

      test("toute clé de en.json existe dans fr.json", () => {
        const onlyEn = [...enKeys].filter((k) => !frKeys.has(k));
        expect(onlyEn, `Clés présentes dans en.json mais absentes de fr.json:\n  ${onlyEn.join("\n  ")}`).toHaveLength(0);
      });

      test("aucune valeur de traduction vide", () => {
        const empties = [
          ...emptyValuePaths(fr).map((k) => `fr:${k}`),
          ...emptyValuePaths(en).map((k) => `en:${k}`),
        ];
        expect(empties, `Valeur(s) i18n vide(s): ${empties.join(", ")}`).toHaveLength(0);
      });

      test("aucun placeholder interpolé deux fois dans une même valeur", () => {
        const doubles = [
          ...duplicatedPlaceholderPaths(fr).map((k) => `fr:${k}`),
          ...duplicatedPlaceholderPaths(en).map((k) => `en:${k}`),
        ];
        expect(
          doubles,
          `Placeholder répété dans une valeur (pluriel ? déclarer \`_one\` / \`_other\`): ${doubles.join(", ")}`,
        ).toHaveLength(0);
      });
    });
  }
});
