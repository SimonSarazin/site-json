#!/usr/bin/env node
/**
 * SURFACE DES CONFIGS — index inverse « clé de config → sites qui la consomment ».
 *
 * Le problème couvert : modifier une surface partagée (schéma, résolveur, widget) impacte des sites
 * dont on ne touche pas la config, sans que rien ne le signale. Premier réflexe AVANT de toucher une
 * clé : `npm run config:surface -- --key <nom>` → qui est exposé, à quels chemins.
 *
 * Modes :
 *   node scripts/config-surface.mjs --key editModalMatch   # sites + chemins complets pour ces clés
 *   node scripts/config-surface.mjs --write                # régénère docs/CONFIG-SURFACE.md
 *   node scripts/config-surface.mjs --check                # échoue si le doc committé est périmé (CI)
 *   node scripts/config-surface.mjs                        # résumé stdout (top clés multi-sites)
 *
 * Détecter + signaler, jamais muter en silence — même philosophie que les gardes parité du backend.
 * L'étage 2 du mécanisme (comportement résolu par site) vit dans
 * tests/preflight/effective-config.test.ts ; ce script est l'étage 1 (exposition statique).
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOC = join(ROOT, "docs", "CONFIG-SURFACE.md");

const args = process.argv.slice(2);
const keyQuery = args.includes("--key") ? args[args.indexOf("--key") + 1] : null;
const WRITE = args.includes("--write");
const CHECK = args.includes("--check");

/** Clés purement éditoriales, sans effet runtime — exclues de l'index. */
const IGNORE = new Set(["_comment", "fr", "en"]);

const configs = readdirSync(ROOT)
  .filter((f) => /^config\.prod\..+\.json$/.test(f))
  .sort()
  .map((f) => ({
    site: f.replace(/^config\.prod\./, "").replace(/\.json$/, ""),
    doc: JSON.parse(readFileSync(join(ROOT, f), "utf8")),
  }));

/** index : clé → site → Set(chemins). Les indices de tableau sont normalisés en `[]`. */
const index = new Map();
function walk(node, path, site) {
  if (Array.isArray(node)) {
    for (const v of node) walk(v, path + "[]", site);
    return;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (IGNORE.has(k)) continue;
      let bySite = index.get(k);
      if (!bySite) index.set(k, (bySite = new Map()));
      let paths = bySite.get(site);
      if (!paths) bySite.set(site, (paths = new Set()));
      paths.add(path ? `${path}.${k}` : k);
      walk(v, path ? `${path}.${k}` : k, site);
    }
  }
}
for (const { site, doc } of configs) walk(doc, "", site);

if (keyQuery) {
  const names = [...index.keys()].filter((k) => k === keyQuery || k.toLowerCase().includes(keyQuery.toLowerCase()));
  if (names.length === 0) {
    console.log(`aucune clé ne matche « ${keyQuery} »`);
    process.exit(1);
  }
  for (const name of names.sort()) {
    const bySite = index.get(name);
    console.log(`\n■ ${name} — ${bySite.size} site(s)`);
    for (const [site, paths] of [...bySite.entries()].sort()) {
      for (const p of [...paths].sort()) console.log(`  ${site.padEnd(24)} ${p}`);
    }
  }
  process.exit(0);
}

/** Le doc : une table clé → nb sites → sites, triée par exposition décroissante puis alpha. */
function renderDoc() {
  const rows = [...index.entries()]
    .map(([k, bySite]) => ({ k, sites: [...bySite.keys()].sort() }))
    .sort((a, b) => b.sites.length - a.sites.length || a.k.localeCompare(b.k));
  const lines = [
    "# Surface des configs — clé → sites exposés",
    "",
    "Généré par `npm run config:surface -- --write` (CI : `--check`). NE PAS éditer à la main.",
    "Usage : avant de modifier la sémantique d'une clé ou son consommateur,",
    "`npm run config:surface -- --key <nom>` donne les chemins complets par site.",
    "",
    `${configs.length} configs scannées : ${configs.map((c) => c.site).join(", ")}.`,
    "",
    "| clé | sites | lesquels |",
    "|---|---|---|",
  ];
  for (const { k, sites } of rows) {
    const which = sites.length === configs.length ? "TOUS" : sites.join(", ");
    lines.push(`| \`${k}\` | ${sites.length} | ${which} |`);
  }
  return lines.join("\n") + "\n";
}

const doc = renderDoc();
if (WRITE) {
  writeFileSync(DOC, doc);
  console.log(`✓ ${index.size} clés écrites dans docs/CONFIG-SURFACE.md`);
} else if (CHECK) {
  let current = "";
  try { current = readFileSync(DOC, "utf8"); } catch { /* absent = périmé */ }
  if (current !== doc) {
    console.error("✖ docs/CONFIG-SURFACE.md périmé — lancer `npm run config:surface -- --write`.");
    process.exit(1);
  }
  console.log("✓ docs/CONFIG-SURFACE.md à jour.");
} else {
  const multi = [...index.entries()].filter(([, s]) => s.size > 1);
  console.log(`${index.size} clés distinctes, dont ${multi.length} multi-sites. Top exposition :`);
  for (const [k, bySite] of multi.sort((a, b) => b[1].size - a[1].size).slice(0, 25)) {
    console.log(`  ${String(bySite.size).padStart(2)} sites  ${k}`);
  }
  console.log("\n--key <nom> pour le détail ; --write pour régénérer docs/CONFIG-SURFACE.md");
}
