#!/usr/bin/env node
/**
 * Migration des littéraux de type de section nommés par SITE vers leurs noms
 * de DESIGN/FONCTIONNALITÉ (découplage — même chantier que cartes/headers).
 *
 * Textuel mais SCOPÉ : ne remplace que les valeurs en position `"type": "…"`
 * (préserve le formatage/indentation d'origine des JSON ; ne touche jamais
 * les textes, chemins ou variants). Réutilisable pour de futures migrations
 * en adaptant MAP.
 *
 * Usage :
 *   node scripts/migrate-section-types.mjs            # applique sur les configs du repo
 *   node scripts/migrate-section-types.mjs --dry-run  # liste les remplacements sans écrire
 *   node scripts/migrate-section-types.mjs <fichiers…> # cible des fichiers explicites
 *     (ex. un config de déploiement monté hors repo — à migrer dans la même
 *      fenêtre de release : l'ancien nom échoue à la validation Zod au boot)
 */
import fs from "node:fs";
import path from "node:path";

const MAP = {
  "hero-tiers-lieux": "hero-search",
  "hero-rezo-la-mer": "hero-parallax",
  "hero-ssbe": "hero-quick-access",
  "hero-nos-communes": "hero-tinted-overlay",
  "hero-commune-transparente": "hero-entity-banner",
  "features-rezo-la-mer": "features-glass",
  "action-buttons-rezo-la-mer": "action-tiles",
  "community-rezo-la-mer": "cta-card-grid",
  "cta-rezo-la-mer": "cta-newsletter",
  "commune-transparente-actions": "expandable-actions",
  "title-with-filters-rezo-la-mer": "searchHeader",
};

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const explicit = args.filter((a) => !a.startsWith("--"));

const root = process.cwd();
const files = explicit.length
  ? explicit
  : fs
      .readdirSync(root)
      .filter((f) => /^config\..*\.json$/.test(f) || f === "site-config.json")
      .map((f) => path.join(root, f));

let totalFiles = 0;
let totalRepl = 0;

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error(`✗ introuvable : ${file}`);
    process.exitCode = 1;
    continue;
  }
  let content = fs.readFileSync(file, "utf-8");
  let fileRepl = 0;

  for (const [oldType, newType] of Object.entries(MAP)) {
    // Ancré sur la position type — jamais les textes/chemins/variants.
    const re = new RegExp(`("type"\\s*:\\s*)"${oldType}"`, "g");
    content = content.replace(re, (_, prefix) => {
      fileRepl += 1;
      return `${prefix}"${newType}"`;
    });
  }

  if (fileRepl > 0) {
    totalFiles += 1;
    totalRepl += fileRepl;
    console.log(`${dryRun ? "[dry-run] " : ""}${path.basename(file)} : ${fileRepl} remplacement(s)`);
    if (!dryRun) {
      JSON.parse(content); // garde-fou : le résultat reste du JSON valide
      fs.writeFileSync(file, content);
    }
  }
}

console.log(`\n${dryRun ? "[dry-run] " : ""}${totalRepl} remplacement(s) dans ${totalFiles} fichier(s).`);
