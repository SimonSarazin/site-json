/**
 * Archétypes de configs + exemples canoniques (golden snippets) de l'assistant
 * de config — source unique partagée par le CLI `npm run config:example`
 * (scripts/config-example.ts) et le gate préflight
 * (tests/preflight/archetypes.test.ts).
 *
 * - `archetypes.json` (dossier du skill) désigne les configs de référence et ce
 *   qu'elles démontrent ; `knownFindings` = constats d'audit ASSUMÉS, versionnés
 *   (contrairement à `.audit-baseline.json`, gitignoré).
 * - `examples/<feature>.json` = snapshot d'un bloc réel d'une config archétype,
 *   avec sa provenance (`source` + `selector`). Le préflight ré-extrait le bloc
 *   depuis la source et échoue si le snapshot a dérivé → resynchroniser en
 *   conscience via `npm run config:example -- <feature> --write`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const SKILL_DIR = path.join(ROOT, ".claude/skills/config-assistant");
export const EXAMPLES_DIR = path.join(SKILL_DIR, "examples");
export const MANIFEST_PATH = path.join(SKILL_DIR, "archetypes.json");

export interface KnownFinding {
  category: string;
  path: string;
  note?: string;
}

export interface Archetype {
  slug: string;
  config: string;
  titre: string;
  demontre: string[];
  knownFindings: KnownFinding[];
}

export interface ArchetypesManifest {
  archetypes: Archetype[];
}

export interface ExampleDoc {
  feature: string;
  titre: string;
  description: string;
  source: string;
  selector: string;
  snapshot: unknown;
}

export function loadManifest(): ArchetypesManifest {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8")) as ArchetypesManifest;
}

export function loadConfig(file: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf-8"));
}

export function examplePath(feature: string): string {
  return path.join(EXAMPLES_DIR, `${feature}.json`);
}

export function loadExamples(): ExampleDoc[] {
  return fs
    .readdirSync(EXAMPLES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const doc = JSON.parse(fs.readFileSync(path.join(EXAMPLES_DIR, f), "utf-8")) as ExampleDoc;
      // Le fichier est adressé par `feature` (examplePath) : un décalage nom de
      // fichier ⇄ feature rendrait `--write` muet sur le mauvais fichier.
      if (`${doc.feature}.json` !== f) {
        throw new Error(`examples/${f} : champ feature « ${doc.feature} » ≠ nom de fichier (renommer l'un ou l'autre)`);
      }
      return doc;
    });
}

/**
 * Résout un sélecteur pointé dans un objet config. Grammaire par segment :
 * `cle` ou `cle[champ=valeur]` (premier élément du tableau dont `champ` vaut
 * `valeur`, comparaison en chaîne). Ex. :
 * `pages[path=/agenda].sections[id=agenda-parent62]`, `theme`,
 * `commandPalette`. Contrainte : ni les clés ni les valeurs de filtre ne
 * peuvent contenir de point (séparateur de segments).
 */
export function resolveSelector(root: unknown, selector: string): unknown {
  let cur: unknown = root;
  for (const seg of selector.split(".")) {
    const m = seg.match(/^([\w-]+)(?:\[([\w-]+)=([^\]]+)\])?$/);
    if (!m) throw new Error(`segment invalide « ${seg} » (selector « ${selector} »)`);
    const [, key, filterKey, filterVal] = m;
    cur = (cur as Record<string, unknown> | undefined)?.[key];
    if (cur === undefined) throw new Error(`clé « ${key} » introuvable (selector « ${selector} »)`);
    if (filterKey) {
      if (!Array.isArray(cur)) throw new Error(`« ${key} » n'est pas un tableau (selector « ${selector} »)`);
      const found = cur.find((item) => String((item as Record<string, unknown> | undefined)?.[filterKey]) === filterVal);
      if (found === undefined) {
        throw new Error(`aucun élément ${filterKey}=${filterVal} sous « ${key} » (selector « ${selector} »)`);
      }
      cur = found;
    }
  }
  return cur;
}
