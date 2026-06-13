/**
 * Valide UN fichier de config de site contre le schéma Zod réel (refinements
 * inclus) et imprime les erreurs par chemin — l'outil de la boucle de
 * correction de l'assistant config (cf. doc/26-assistant-config.md), utile
 * aussi à la main.
 *
 * Usage :  npx tsx scripts/validate-config.ts <fichier.json>
 *          npm run config:validate -- config.prod.tiers-lieux.json
 * Sortie : exit 0 si valide ; exit 1 + erreurs `chemin : message` sinon.
 *
 * (Les tests préflight font la même validation mais sur TOUS les configs via
 * le runner — trop lent pour itérer fichier par fichier.)
 */
import fs from "node:fs";
import { SiteConfig } from "../src/types/site-schema";

const file = process.argv[2];
if (!file) {
  console.error("Usage : npx tsx scripts/validate-config.ts <fichier.json>");
  process.exit(2);
}
if (!fs.existsSync(file)) {
  console.error(`✗ introuvable : ${file}`);
  process.exit(2);
}

let raw: unknown;
try {
  raw = JSON.parse(fs.readFileSync(file, "utf-8"));
} catch (e) {
  console.error(`✗ JSON invalide : ${(e as Error).message}`);
  process.exit(1);
}

const result = SiteConfig.safeParse(raw);
if (result.success) {
  const pages = (raw as { pages?: { sections?: unknown[] }[] }).pages ?? [];
  const sections = pages.reduce((n, p) => n + (p.sections?.length ?? 0), 0);
  console.log(`✓ ${file} valide — ${pages.length} page(s), ${sections} section(s)`);
  process.exit(0);
}

/** Valeur à un chemin Zod dans l'input (pour contextualiser les erreurs d'union). */
function valueAt(obj: unknown, path: PropertyKey[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<PropertyKey, unknown>)[key];
  }
  return cur;
}

console.error(`✗ ${file} : ${result.error.issues.length} erreur(s)\n`);
for (const issue of result.error.issues) {
  const path = issue.path.length ? issue.path.join(".") : "(racine)";
  let detail = `${issue.message} [${issue.code}]`;
  // Les erreurs d'union (ex. type de section inconnu) ne disent pas la valeur
  // fautive — on l'ajoute (et le `type` du parent si c'est une section).
  if (issue.code === "invalid_union") {
    const received = valueAt(raw, issue.path);
    if (received !== undefined && (typeof received !== "object" || received === null)) {
      detail += ` — reçu : ${JSON.stringify(received)}`;
    } else if (received && typeof received === "object" && "type" in (received as object)) {
      detail += ` — type reçu : ${JSON.stringify((received as { type: unknown }).type)}`;
    }
  }
  console.error(`  ${path}\n    → ${detail}`);
}
process.exit(1);
