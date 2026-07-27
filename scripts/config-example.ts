/**
 * Exemples canoniques (golden snippets) des configs archétypes.
 *
 *   npm run config:example                       → archétypes + exemples + recettes de page
 *   npm run config:example -- <feature>          → affiche le snapshot + provenance
 *   npm run config:example -- --recipe <id>      → imprime la PAGE RÉELLE qui sert de
 *                                                  gabarit de composition (page-recipes.json)
 *   npm run config:example -- <feature> --write  → ré-extrait le bloc depuis la
 *                                                  config source et réécrit le snapshot
 *   npm run config:example -- --write-all        → resynchronise tous les snapshots
 *
 * Les snapshots vivent dans .claude/skills/config-assistant/examples/ et sont
 * versionnés ; tests/preflight/archetypes.test.ts échoue s'ils dérivent de leur
 * config source (→ `--write` est l'acte conscient de resynchronisation).
 */
import fs from "node:fs";
import {
  loadManifest,
  loadExamples,
  loadRecipes,
  loadConfig,
  resolveSelector,
  examplePath,
  type ExampleDoc,
} from "./lib/archetypes";

const argv = process.argv.slice(2);
const WRITE = argv.includes("--write");
const WRITE_ALL = argv.includes("--write-all");
const recipeIdx = argv.indexOf("--recipe");
const RECIPE = recipeIdx >= 0 ? argv[recipeIdx + 1] : undefined;
// L'argument de --recipe n'est pas une feature (et sans --recipe, aucun index
// n'est à exclure : recipeIdx vaut -1, pas 0).
const recipeValueIdx = recipeIdx >= 0 ? recipeIdx + 1 : -1;
const feature = argv.find((a, i) => !a.startsWith("--") && i !== recipeValueIdx);

function rewrite(doc: ExampleDoc): void {
  const extracted = resolveSelector(loadConfig(doc.source), doc.selector);
  const updated: ExampleDoc = { ...doc, snapshot: extracted };
  fs.writeFileSync(examplePath(doc.feature), `${JSON.stringify(updated, null, 2)}\n`);
  console.log(`✓ ${doc.feature} resynchronisé depuis ${doc.source} (${doc.selector})`);
}

const examples = loadExamples();

// Recette de COMPOSITION : imprime la page RÉELLE qui sert de gabarit (le
// meilleur point de départ est une page qui tourne, pas une liste de types).
if (recipeIdx >= 0) {
  const recipes = loadRecipes();
  const r = recipes.find((x) => x.id === RECIPE);
  if (!r) {
    console.error(`✗ recette inconnue : « ${RECIPE ?? ""} »`);
    console.error(`  disponibles : ${recipes.map((x) => x.id).join(", ")}`);
    process.exit(1);
  }
  console.log(`// ${r.titre}`);
  console.log(`// Quand : ${r.quand}`);
  console.log(`// Rythme : ${r.rythme}`);
  console.log(`// Page réelle : ${r.source} → ${r.path}  (${r.sequence.join(" > ")})`);
  console.log(JSON.stringify(resolveSelector(loadConfig(r.source), `pages[path=${r.path}]`), null, 2));
  process.exit(0);
}

if (WRITE_ALL) {
  if (feature) {
    console.error(`✗ --write-all ne prend pas de feature (« ${feature} » reçu) — utiliser \`-- ${feature} --write\` pour un seul snapshot`);
    process.exit(1);
  }
  for (const doc of examples) rewrite(doc);
  process.exit(0);
}

if (WRITE && !feature) {
  console.error("✗ --write exige une feature : `npm run config:example -- <feature> --write` (ou --write-all pour tout)");
  process.exit(1);
}

if (!feature) {
  const manifest = loadManifest();
  console.log("Archétypes (configs de référence, gate préflight tests/preflight/archetypes.test.ts) :\n");
  for (const a of manifest.archetypes) {
    console.log(`  ${a.slug.padEnd(24)} ${a.config.padEnd(42)} ${a.titre}${a.wip ? "  [WIP : audit non garanti]" : ""}`);
  }
  console.log("\nExemples canoniques (npm run config:example -- <feature>) :\n");
  for (const doc of examples) {
    console.log(`  ${doc.feature.padEnd(28)} ${doc.titre}  [${doc.source}]`);
  }
  console.log("\nRecettes de page (npm run config:example -- --recipe <id>) — imprime la page RÉELLE :\n");
  for (const r of loadRecipes()) {
    console.log(`  ${r.id.padEnd(24)} ${r.titre}`);
    console.log(`  ${" ".repeat(24)} ${r.sequence.join(" > ")}`);
  }
  process.exit(0);
}

const doc = examples.find((d) => d.feature === feature);
if (!doc) {
  console.error(`✗ exemple inconnu : « ${feature} » (voir \`npm run config:example\` pour la liste)`);
  process.exit(1);
}

if (WRITE) {
  rewrite(doc);
  process.exit(0);
}

console.log(`// ${doc.titre}`);
console.log(`// ${doc.description}`);
console.log(`// Source : ${doc.source} → ${doc.selector}`);
console.log(JSON.stringify(doc.snapshot, null, 2));
