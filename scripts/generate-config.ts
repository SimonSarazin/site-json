import { existsSync, writeFileSync } from "node:fs";
import { demoSiteConfig } from "../src/data/demo-site";

/**
 * Génère un squelette de config (le site démo validé) vers un chemin EXPLICITE.
 *
 *   tsx scripts/generate-config.ts <chemin-sortie> [--force]
 *
 * Garde-fou : refuse d'écraser un fichier existant sans `--force`. L'ancienne
 * version écrasait SILENCIEUSEMENT `config.prod.json` (sortie codée en dur) — un
 * `npm run build:config` malencontreux remplaçait la vraie config prod par le démo.
 */
const args = process.argv.slice(2);
const force = args.includes("--force");
const out = args.find((a) => !a.startsWith("--"));

if (!out) {
  console.error("Usage : tsx scripts/generate-config.ts <chemin-sortie> [--force]");
  process.exit(2);
}
if (existsSync(out) && !force) {
  console.error(`✋  ${out} existe déjà — relance avec --force pour l'écraser.`);
  process.exit(1);
}

writeFileSync(out, JSON.stringify(demoSiteConfig, null, 2) + "\n", "utf-8");
console.log(`✅  Config démo générée → ${out}`);
