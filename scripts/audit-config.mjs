#!/usr/bin/env node
/**
 * Audit (non bloquant) de la qualité des fichiers de config référencés par
 * `sites.json`. Complète les invariants STRICTS de
 * `tests/preflight/config-integrity.test.ts` par des contrôles « soft » qui ont
 * un backlog pré-existant dans les configs démo/template :
 *
 *   - traductions manquantes (LocalizedString incomplète vs meta.languages),
 *   - liens internes morts (pas de page du config ni de route module connue),
 *   - locales présentes mais non déclarées dans meta.languages,
 *   - bloc `theme` absent.
 *
 * Usage :
 *   npm run audit:config            → rapport, exit 0 (informatif)
 *   npm run audit:config -- --strict → exit 1 s'il y a au moins un constat
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STRICT = process.argv.includes("--strict");
const LOCALES = ["fr", "en", "es", "de"];
// Routes servies par les modules (pas des pages du JSON) → liens internes valides.
const KNOWN_ROUTE_PREFIXES = ["/profil", "/login", "/register", "/recover-password", "/ampli", "/coform"];

const sites = JSON.parse(fs.readFileSync(path.join(ROOT, "sites.json"), "utf-8"));
const configs = [...new Set(sites.map((s) => s.config))];

const isLocalizedString = (v) =>
  v &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  Object.keys(v).length > 0 &&
  Object.keys(v).every((k) => LOCALES.includes(k)) &&
  Object.values(v).every((x) => typeof x === "string");

function walk(node, fn, p = []) {
  fn(node, p);
  if (Array.isArray(node)) node.forEach((v, i) => walk(v, fn, [...p, i]));
  else if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) walk(v, fn, [...p, k]);
}

const preview = (items, n = 10) =>
  items.slice(0, n).map((i) => `      - ${i}`).join("\n") + (items.length > n ? `\n      … (+${items.length - n})` : "");

let totalIssues = 0;
const summary = [];

console.log("\n🔎  Audit config (advisory) — basé sur sites.json\n" + "═".repeat(60));

for (const cf of configs) {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, cf), "utf-8"));
  const langs = raw.meta?.languages ?? ["fr"];
  const pagePaths = new Set((raw.pages ?? []).map((p) => p.path));

  const missingTrad = [];
  const extraLocales = new Set();
  const deadLinks = [];

  walk(raw, (n, p) => {
    if (isLocalizedString(n)) {
      for (const l of langs) if (n[l] === undefined) missingTrad.push(`${p.join(".")}[${l}]`);
      for (const l of Object.keys(n)) if (!langs.includes(l)) extraLocales.add(l);
    }
    if (n && typeof n === "object" && !Array.isArray(n)) {
      for (const key of ["path", "href", "link", "url"]) {
        const v = n[key];
        if (typeof v !== "string" || !v.startsWith("/")) continue;
        const clean = v.split("?")[0].split("#")[0];
        const base = `/${clean.split("/")[1]}`;
        if (clean !== "/" && !pagePaths.has(clean) && !KNOWN_ROUTE_PREFIXES.includes(base))
          deadLinks.push(`${p.join(".")}.${key}=${v}`);
      }
    }
  });

  const themeMissing = !(raw.theme && typeof raw.theme === "object" && Object.keys(raw.theme).length > 0);
  const count = missingTrad.length + deadLinks.length + extraLocales.size + (themeMissing ? 1 : 0);
  totalIssues += count;
  summary.push({ cf, missingTrad: missingTrad.length, deadLinks: deadLinks.length, extraLocales: extraLocales.size, themeMissing });

  if (count === 0) {
    console.log(`\n✅  ${cf} — RAS`);
    continue;
  }
  console.log(`\n⚠️   ${cf}  (langs: ${langs.join(",")})`);
  if (missingTrad.length) console.log(`   • ${missingTrad.length} traduction(s) manquante(s):\n${preview(missingTrad)}`);
  if (deadLinks.length) console.log(`   • ${deadLinks.length} lien(s) interne(s) sans page/route:\n${preview(deadLinks)}`);
  if (extraLocales.size) console.log(`   • locale(s) hors meta.languages: ${[...extraLocales].join(", ")}`);
  if (themeMissing) console.log(`   • aucun bloc "theme" (fallback sur le CSS du site)`);
}

console.log("\n" + "═".repeat(60) + "\nRécapitulatif :");
for (const s of summary) {
  console.log(
    `  ${s.cf.padEnd(38)} trad:${String(s.missingTrad).padStart(3)}  liens:${String(s.deadLinks).padStart(3)}  ` +
      `locales+:${s.extraLocales}  theme:${s.themeMissing ? "MANQUE" : "ok"}`
  );
}
console.log(`\nTotal constats : ${totalIssues}\n`);

if (STRICT && totalIssues > 0) {
  console.error("❌  --strict : des constats advisory existent.");
  process.exit(1);
}
