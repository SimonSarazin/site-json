import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Preflight — invariants STRICTS d'intégrité des configs (au-delà du schéma Zod).
 *
 * Ne contient que des règles vraies sur TOUTES les configs aujourd'hui → elles
 * bloquent une régression future sans casser le build actuel :
 *  - `meta` cohérent (languages non vide, defaultLang ∈ languages),
 *  - aucune valeur de `LocalizedString` vide,
 *  - liens externes (http/https) bien formés.
 *
 * Les contrôles « soft » avec un backlog pré-existant dans les configs démo
 * (traductions incomplètes, liens internes morts, locales non déclarées, theme
 * absent) sont dans le script d'audit `npm run audit:config` (rapport visible,
 * non bloquant) — voir `scripts/audit-config.mjs`.
 *
 * Itère sur les configs réellement référencées par `sites.json`.
 */
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const LOCALES = ["fr", "en", "es", "de"];

const sites: Array<{ slug: string; config: string }> = JSON.parse(
  fs.readFileSync(path.join(PROJECT_ROOT, "sites.json"), "utf-8")
);
const uniqueConfigs = [...new Set(sites.map((s) => s.config))];

/** Un objet dont toutes les clés sont des locales et toutes les valeurs des strings. */
function isLocalizedString(v: unknown): v is Record<string, string> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const keys = Object.keys(v as object);
  return (
    keys.length > 0 &&
    keys.every((k) => LOCALES.includes(k)) &&
    Object.values(v as object).every((x) => typeof x === "string")
  );
}

function walk(
  node: unknown,
  fn: (n: unknown, p: Array<string | number>) => void,
  p: Array<string | number> = []
): void {
  fn(node, p);
  if (Array.isArray(node)) node.forEach((v, i) => walk(v, fn, [...p, i]));
  else if (node && typeof node === "object")
    for (const [k, v] of Object.entries(node)) walk(v, fn, [...p, k]);
}

const preview = (items: string[], n = 12): string =>
  `\n  ${items.slice(0, n).join("\n  ")}${items.length > n ? `\n  … (+${items.length - n})` : ""}`;

describe("Preflight — Config integrity", () => {
  for (const cf of uniqueConfigs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any = JSON.parse(fs.readFileSync(path.resolve(PROJECT_ROOT, cf), "utf-8"));

    describe(cf, () => {
      test("meta : languages non vide et defaultLang ∈ languages", () => {
        expect(
          Array.isArray(raw.meta?.languages) && raw.meta.languages.length > 0,
          "meta.languages absent ou vide"
        ).toBe(true);
        expect(
          raw.meta.languages,
          `meta.defaultLang "${raw.meta?.defaultLang}" absent de meta.languages [${raw.meta.languages.join(", ")}]`
        ).toContain(raw.meta?.defaultLang);
      });

      test("aucune valeur de LocalizedString vide", () => {
        const empties: string[] = [];
        walk(raw, (n, p) => {
          if (isLocalizedString(n))
            for (const [l, v] of Object.entries(n)) if (v === "") empties.push(`${p.join(".")}[${l}]`);
        });
        expect(empties, `LocalizedString vide(s):${preview(empties)}`).toHaveLength(0);
      });

      test("liens externes (http/https) bien formés", () => {
        const bad: string[] = [];
        walk(raw, (n, p) => {
          if (!n || typeof n !== "object" || Array.isArray(n)) return;
          for (const key of ["href", "url", "link", "path"]) {
            const v = (n as Record<string, unknown>)[key];
            if (typeof v !== "string") continue;
            if (/^https?:\/\//.test(v) || v.startsWith("//")) {
              try {
                new URL(v.startsWith("//") ? `https:${v}` : v);
              } catch {
                bad.push(`${p.join(".")}.${key}=${v}`);
              }
            }
          }
        });
        expect(bad, `URL externe(s) invalide(s):${preview(bad)}`).toHaveLength(0);
      });
    });
  }
});
