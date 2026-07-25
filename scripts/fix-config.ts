/**
 * Applique des corrections à un config, ADRESSÉES PAR LES CHEMINS D'AUDIT.
 *
 * Pourquoi pas un « --fix auto » : après reclassement, aucune catégorie n'est
 * sûrement automatisable. `cle-strippee` a trois lectures (config mort / trou de
 * schéma / clé transmise au backend), `locale-extra` en a deux (déclarer la
 * locale ou purger les valeurs — sur commune-transparente, purger détruirait 68
 * VRAIES traductions). L'automatisation utile n'est donc pas de deviner : c'est
 * d'appliquer FIABLEMENT et EN LOT ce que l'assistant a décidé, sur les chemins
 * que l'audit lui a donnés, avec revalidation Zod avant écriture.
 *
 * Usage :
 *   npx tsx scripts/fix-config.ts <config.json> --set <patch.json> [--dry-run]
 *   npx tsx scripts/fix-config.ts <config.json> --add-locale <l>   [--dry-run]
 *   npx tsx scripts/fix-config.ts <config.json> --strip-locale <l> [--dry-run]
 *
 * `patch.json` : { "<chemin d'audit>": <valeur> | null }  (null = suppression)
 *   { "pages.0.sections.1.props.headline[en]": "Our network",
 *     "header.nav.2.path": "/contact",
 *     "pages.3.sections.0.props.legacyKey": null }
 * Le chemin est celui du constat d'audit, tel quel — segments pointés, index de
 * tableau numériques, suffixe `[locale]` pour une entrée de LocalizedString.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SiteConfig } from "../src/types/site-schema";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const FORCE = argv.includes("--force");

function optionValue(name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

const SET = optionValue("--set");
const ADD_LOCALE = optionValue("--add-locale");
const STRIP_LOCALE = optionValue("--strip-locale");
const target = argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--set" && argv[i - 1] !== "--add-locale" && argv[i - 1] !== "--strip-locale");

if (!target || (!SET && !ADD_LOCALE && !STRIP_LOCALE)) {
  console.error("Usage : fix-config.ts <config.json> <--set <patch.json> | --add-locale <l> | --strip-locale <l>> [--dry-run]");
  process.exit(2);
}

const configPath = path.isAbsolute(target) ? target : path.join(ROOT, target);
if (!fs.existsSync(configPath)) {
  console.error(`✗ introuvable : ${configPath}`);
  process.exit(2);
}

const raw = fs.readFileSync(configPath, "utf-8");
const config = JSON.parse(raw) as Record<string, unknown>;

interface Change {
  path: string;
  before: unknown;
  after: unknown;
}
const changes: Change[] = [];

const LOCALES = ["fr", "en", "es", "de"];
const isLocalized = (v: unknown): v is Record<string, string> =>
  !!v &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  Object.keys(v).length > 0 &&
  Object.keys(v).every((k) => LOCALES.includes(k)) &&
  Object.values(v).every((x) => typeof x === "string");

/**
 * Résout le PARENT d'un chemin d'audit et la clé finale. Refuse de créer les
 * niveaux intermédiaires : un chemin fautif doit échouer bruyamment, pas semer
 * une clé morte que le runtime ignorerait en silence.
 */
function resolveParent(root: unknown, dotted: string): { parent: Record<string, unknown>; key: string } {
  const m = /^(.*?)(?:\[(\w+)\])?$/.exec(dotted);
  const segments = (m?.[1] ?? dotted).split(".");
  const localeKey = m?.[2];
  const lastSegment = segments.pop();
  if (!lastSegment) throw new Error(`chemin vide`);
  let cur: unknown = root;
  for (const seg of segments) {
    cur = (cur as Record<string, unknown> | undefined)?.[seg];
    if (cur === undefined || cur === null) throw new Error(`segment « ${seg} » introuvable`);
  }
  if (localeKey) {
    const node = (cur as Record<string, unknown>)[lastSegment];
    if (!node || typeof node !== "object") throw new Error(`« ${lastSegment} » n'est pas une LocalizedString`);
    return { parent: node as Record<string, unknown>, key: localeKey };
  }
  return { parent: cur as Record<string, unknown>, key: lastSegment };
}

function applyPatch(patch: Record<string, unknown>) {
  for (const [dotted, value] of Object.entries(patch)) {
    let parent: Record<string, unknown>;
    let key: string;
    try {
      ({ parent, key } = resolveParent(config, dotted));
    } catch (e) {
      console.error(`✗ ${dotted} : ${(e as Error).message}`);
      process.exit(1);
    }
    const before = parent[key];
    if (value === null) {
      if (!(key in parent)) {
        console.error(`✗ ${dotted} : clé absente, rien à supprimer`);
        process.exit(1);
      }
      delete parent[key];
    } else {
      parent[key] = value;
    }
    changes.push({ path: dotted, before, after: value });
  }
}

/** Purge une locale de TOUTES les LocalizedString du config. */
function stripLocale(locale: string) {
  const walk = (node: unknown, p: string[]) => {
    if (Array.isArray(node)) return node.forEach((v, i) => walk(v, [...p, String(i)]));
    if (!node || typeof node !== "object") return;
    const rec = node as Record<string, unknown>;
    if (isLocalized(rec) && locale in rec) {
      changes.push({ path: `${p.join(".")}[${locale}]`, before: rec[locale], after: null });
      delete rec[locale];
      return;
    }
    for (const [k, v] of Object.entries(rec)) walk(v, [...p, k]);
  };
  walk(config, []);
}

if (SET) {
  const patchPath = path.isAbsolute(SET) ? SET : path.join(ROOT, SET);
  if (!fs.existsSync(patchPath)) {
    console.error(`✗ patch introuvable : ${patchPath}`);
    process.exit(2);
  }
  applyPatch(JSON.parse(fs.readFileSync(patchPath, "utf-8")) as Record<string, unknown>);
}

if (ADD_LOCALE) {
  const meta = config.meta as { languages?: string[] } | undefined;
  if (!meta) {
    console.error("✗ pas de bloc meta");
    process.exit(1);
  }
  const langs = meta.languages ?? ["fr"];
  if (langs.includes(ADD_LOCALE)) {
    console.log(`• « ${ADD_LOCALE} » est déjà dans meta.languages — rien à faire`);
  } else {
    changes.push({ path: "meta.languages", before: [...langs], after: [...langs, ADD_LOCALE] });
    meta.languages = [...langs, ADD_LOCALE];
  }
}

if (STRIP_LOCALE) stripLocale(STRIP_LOCALE);

if (changes.length === 0) {
  console.log("Aucun changement.");
  process.exit(0);
}

const short = (v: unknown) => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s === undefined ? "(absent)" : s.length > 70 ? `${s.slice(0, 67)}…` : s;
};
console.log(`${changes.length} changement(s) :`);
for (const c of changes.slice(0, 40)) console.log(`  ${c.path}\n     ${short(c.before)}  ⇒  ${c.after === null ? "(supprimé)" : short(c.after)}`);
if (changes.length > 40) console.log(`  … (+${changes.length - 40})`);

// Revalidation AVANT écriture : un patch ne doit jamais laisser un config cassé.
const parsed = SiteConfig.safeParse(config);
if (!parsed.success) {
  console.error(`\n✗ le config résultant est INVALIDE (${parsed.error.issues.length} erreur(s)) — rien n'est écrit :`);
  for (const issue of parsed.error.issues.slice(0, 5)) console.error(`   ${issue.path.join(".")} — ${issue.message}`);
  if (!FORCE) process.exit(1);
  console.error("   (--force : écriture quand même)");
}

if (DRY) {
  console.log("\n--dry-run : rien n'a été écrit.");
  process.exit(0);
}

// Indentation 2 espaces + newline final : format de tous les configs du parc.
fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
const shown = configPath.startsWith(ROOT + path.sep) ? path.relative(ROOT, configPath) : configPath;
console.log(`\n✓ ${shown} mis à jour (${changes.length} changement(s)).`);
console.log("  → relancer : npm run config:validate et npm run audit:config");
