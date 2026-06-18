/**
 * Audit (non bloquant) de la qualité des fichiers de config référencés par
 * `sites.json`. Complète les invariants STRICTS de
 * `tests/preflight/config-integrity.test.ts` par des contrôles « soft » :
 *
 *   - traductions manquantes (LocalizedString incomplète vs meta.languages),
 *   - liens internes morts (pas de page du config ni de route module connue),
 *   - liens INERTES (`#` seul = placeholder sans destination ; exclut les
 *     parents de nav qui utilisent `#` comme toggle de dropdown),
 *   - locales présentes mais non déclarées dans meta.languages,
 *   - bloc `theme` absent ou sans couleurs,
 *   - ASSETS manquants (image/logo/favicon → fichier absent de public/),
 *   - CLÉS STRIPPÉES par Zod (posées dans le config mais inconnues du schéma
 *     → config mort silencieux, ex. un `variant` ignoré par le composant),
 *   - PRÉREQUIS modules (searchPro/searchProStatic sans `baseParams`).
 *
 * Chaque constat porte {category, path, message, severity, fixability} —
 * `fixability` pilote le flux de réparation de l'assistant config (doc/26) :
 * `auto` (lot mécanique) · `proposer` (choix humain) · `suggestion` (opt-in).
 *
 * Constats ASSUMÉS : `.audit-baseline.json` (versionné, à la racine) — clés =
 * fichier de config, valeurs = [{category, path}]. Un constat assumé est
 * reporté à part et n'échoue pas `--strict`.
 *
 * Usage :
 *   npm run audit:config                      → tous les configs, rapport humain
 *   npm run audit:config -- --file <x.json>   → un seul config
 *   npm run audit:config -- --json            → sortie structurée (assistant/CI)
 *   npm run audit:config -- --strict          → exit 1 si constat non assumé
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SiteConfig } from "../src/types/site-schema";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const STRICT = argv.includes("--strict");
const JSON_OUT = argv.includes("--json");
const fileArgIdx = argv.indexOf("--file");
const ONLY_FILE = fileArgIdx >= 0 ? argv[fileArgIdx + 1] : undefined;

const LOCALES = ["fr", "en", "es", "de"];
// Routes servies par les modules (pas des pages du JSON) → liens internes valides.
const KNOWN_ROUTE_PREFIXES = ["/profil", "/login", "/register", "/recover-password", "/ampli", "/coform"];
// Clés portant des chemins d'images/fichiers locaux (relevé des configs réels).
const ASSET_KEYS = new Set([
  "favicon", "logo", "logoImage", "backgroundImage", "image", "src",
  "imageSrc", "featuredImage", "avatar", "bannerImage", "beforeImage", "afterImage",
]);

type Fixability = "auto" | "proposer" | "suggestion";
interface Finding {
  category: string;
  path: string;
  message: string;
  severity: "warn" | "info";
  fixability: Fixability;
}

const baselinePath = path.join(ROOT, ".audit-baseline.json");
const baseline: Record<string, { category: string; path: string }[]> = fs.existsSync(baselinePath)
  ? JSON.parse(fs.readFileSync(baselinePath, "utf-8"))
  : {};

const sites = JSON.parse(fs.readFileSync(path.join(ROOT, "sites.json"), "utf-8")) as {
  config: string;
}[];
const sitesConfigs = new Set(sites.map((s) => s.config));
const allConfigs = [...new Set(["config.prod.json", ...sites.map((s) => s.config)])].filter((f) =>
  fs.existsSync(path.join(ROOT, f)),
);
const configs = ONLY_FILE ? [ONLY_FILE].filter((f) => fs.existsSync(path.join(ROOT, f))) : allConfigs;
if (ONLY_FILE && configs.length === 0) {
  console.error(`✗ introuvable : ${ONLY_FILE}`);
  process.exit(2);
}
// Configs prod ORPHELINES (hors --file) : sur disque mais ni défaut ni sites.json.
const orphans = ONLY_FILE
  ? []
  : fs
      .readdirSync(ROOT)
      .filter((f) => /^config\.prod.*\.json$/.test(f) && f !== "config.prod.json" && !sitesConfigs.has(f));

const isLocalizedString = (v: unknown): v is Record<string, string> =>
  !!v &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  Object.keys(v).length > 0 &&
  Object.keys(v).every((k) => LOCALES.includes(k)) &&
  Object.values(v).every((x) => typeof x === "string");

function walk(node: unknown, fn: (n: unknown, p: (string | number)[]) => void, p: (string | number)[] = []) {
  fn(node, p);
  if (Array.isArray(node)) node.forEach((v, i) => walk(v, fn, [...p, i]));
  else if (node && typeof node === "object")
    for (const [k, v] of Object.entries(node)) walk(v, fn, [...p, k]);
}

/** Clés du RAW absentes du PARSED (strippées par Zod) — remonte la clé racine du sous-arbre. */
function strippedKeys(raw: unknown, parsed: unknown, p: (string | number)[] = [], out: string[] = []): string[] {
  if (Array.isArray(raw) && Array.isArray(parsed)) {
    raw.forEach((v, i) => strippedKeys(v, parsed[i], [...p, i], out));
    return out;
  }
  if (raw && parsed && typeof raw === "object" && typeof parsed === "object" && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      if (!(k in (parsed as Record<string, unknown>))) out.push([...p, k].join("."));
      else strippedKeys(v, (parsed as Record<string, unknown>)[k], [...p, k], out);
    }
  }
  return out;
}

const report: Record<string, { findings: Finding[]; assumed: Finding[] }> = {};

for (const cf of configs) {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, cf), "utf-8")) as Record<string, unknown>;
  const findings: Finding[] = [];
  const langs: string[] = (raw.meta as { languages?: string[] })?.languages ?? ["fr"];
  const pagePaths = new Set(((raw.pages as { path: string }[]) ?? []).map((pg) => pg.path));

  walk(raw, (n, p) => {
    if (isLocalizedString(n)) {
      for (const l of langs)
        if (n[l] === undefined)
          findings.push({ category: "trad", path: `${p.join(".")}[${l}]`, message: `traduction « ${l} » manquante`, severity: "warn", fixability: "proposer" });
      for (const l of Object.keys(n))
        if (!langs.includes(l))
          findings.push({ category: "locale-extra", path: `${p.join(".")}[${l}]`, message: `locale « ${l} » hors meta.languages`, severity: "info", fixability: "auto" });
    }
    if (n && typeof n === "object" && !Array.isArray(n)) {
      const rec = n as Record<string, unknown>;
      const hasNavChildren = Array.isArray(rec.children) && rec.children.length > 0;
      for (const key of ["path", "href", "link", "url"]) {
        const v = rec[key];
        if (typeof v !== "string") continue;
        // Lien inerte : `#` seul = placeholder sans destination (clic sans effet).
        // LÉGITIME sur un parent de nav (toggle du dropdown : a `children`/`megaMenu`)
        // → on ne flag que les FEUILLES (sans enfants ni megaMenu).
        if (v.trim() === "#" && !hasNavChildren && !rec.megaMenu) {
          findings.push({ category: "lien-inerte", path: `${p.join(".")}.${key}`, message: "lien « # » inerte (placeholder sans destination)", severity: "warn", fixability: "proposer" });
          continue;
        }
        if (!v.startsWith("/")) continue;
        const clean = v.split("?")[0].split("#")[0];
        const base = `/${clean.split("/")[1]}`;
        if (clean !== "/" && !pagePaths.has(clean) && !KNOWN_ROUTE_PREFIXES.includes(base) && !clean.startsWith("/images/"))
          findings.push({ category: "lien-mort", path: `${p.join(".")}.${key}`, message: `lien interne sans page/route : ${v}`, severity: "warn", fixability: "proposer" });
      }
      // Assets locaux : le fichier doit exister dans public/.
      for (const [k, v] of Object.entries(rec)) {
        if (!ASSET_KEYS.has(k) || typeof v !== "string" || v.length === 0) continue;
        if (/^(https?:|data:|blob:)/.test(v) || v.trim().startsWith("<svg")) continue;
        const rel = v.startsWith("/") ? v.slice(1) : v;
        // Ne juger que les valeurs qui RESSEMBLENT à des fichiers (extension
        // d'asset) — exclut les noms d'icône lucide ET les chemins de champ
        // CoForm (ex. ampli.props.path.image = "formKey.fieldId", pas un fichier).
        if (!/\.(png|jpe?g|gif|webp|svg|avif|ico)$/i.test(rel)) continue;
        if (!fs.existsSync(path.join(ROOT, "public", rel)))
          findings.push({ category: "asset-manquant", path: `${p.join(".")}.${k}`, message: `fichier absent de public/ : ${v}`, severity: "warn", fixability: "proposer" });
      }
    }
  });

  // Clés strippées par Zod (config mort silencieux).
  const parsed = SiteConfig.safeParse(raw);
  if (parsed.success) {
    for (const sp of strippedKeys(raw, parsed.data))
      findings.push({ category: "cle-strippee", path: sp, message: "clé inconnue du schéma — ignorée par Zod (config mort)", severity: "warn", fixability: "auto" });
  } else {
    findings.push({ category: "schema", path: "(racine)", message: "config INVALIDE — lancer npm run config:validate pour le détail", severity: "warn", fixability: "proposer" });
  }

  // Prérequis modules : recherche sans périmètre réseau.
  walk(raw.pages, (n, p) => {
    const rec = n as Record<string, unknown> | null;
    if (rec && (rec.type === "searchPro" || rec.type === "searchProStatic")) {
      const bp = (rec.props as Record<string, unknown> | undefined)?.baseParams;
      if (!bp || (typeof bp === "object" && Object.keys(bp as object).length === 0))
        findings.push({ category: "module-prereq", path: `pages.${p.join(".")}.props.baseParams`, message: `${rec.type} sans baseParams — périmètre réseau non défini`, severity: "warn", fixability: "proposer" });
    }
  });

  // État du theme.
  const tm = raw.theme as { colors?: { light?: unknown; dark?: unknown } } | undefined;
  const themeStatus = !(tm && typeof tm === "object" && Object.keys(tm).length > 0)
    ? "absent"
    : tm.colors?.light && tm.colors?.dark
      ? "complet"
      : "sans-couleurs";
  if (themeStatus !== "complet")
    findings.push({ category: "theme", path: "theme", message: themeStatus === "absent" ? "bloc theme ABSENT (couleurs via le CSS du site)" : "theme sans colors.light/dark (playbook : migration rezo-la-mer 90b5200)", severity: "info", fixability: "proposer" });

  // Baseline : sépare les constats assumés.
  const assumedEntries = baseline[cf] ?? [];
  const isAssumed = (f: Finding) => assumedEntries.some((b) => b.category === f.category && b.path === f.path);
  report[cf] = { findings: findings.filter((f) => !isAssumed(f)), assumed: findings.filter(isAssumed) };
}

// ─── Sortie ───────────────────────────────────────────────────────────────
const totalActive = Object.values(report).reduce((n, r) => n + r.findings.length, 0) + orphans.length;

if (JSON_OUT) {
  console.log(JSON.stringify({ orphans, configs: report, totalActive }, null, 2));
} else {
  const preview = (items: string[], n = 10) =>
    items.slice(0, n).map((i) => `      - ${i}`).join("\n") + (items.length > n ? `\n      … (+${items.length - n})` : "");

  console.log("\n🔎  Audit config (advisory)\n" + "═".repeat(60));
  if (orphans.length) {
    console.log(`\n🗂️   ${orphans.length} config(s) prod ORPHELINE(S) (hors sites.json) :`);
    for (const o of orphans) console.log(`      - ${o}  → à enregistrer dans sites.json ou supprimer`);
  }

  for (const [cf, { findings, assumed }] of Object.entries(report)) {
    if (findings.length === 0) {
      console.log(`\n✅  ${cf} — RAS${assumed.length ? ` (${assumed.length} assumé(s))` : ""}`);
      continue;
    }
    console.log(`\n⚠️   ${cf}${assumed.length ? `  (+${assumed.length} assumé(s))` : ""}`);
    const byCat = new Map<string, Finding[]>();
    for (const f of findings) byCat.set(f.category, [...(byCat.get(f.category) ?? []), f]);
    for (const [cat, items] of byCat)
      console.log(`   • ${cat} ×${items.length} [${items[0].fixability}]\n${preview(items.map((f) => `${f.path} — ${f.message}`))}`);
  }

  console.log("\n" + "═".repeat(60) + "\nRécapitulatif :");
  for (const [cf, { findings }] of Object.entries(report)) {
    const c = (cat: string) => findings.filter((f) => f.category === cat).length;
    const theme = c("theme")
      ? findings.find((f) => f.category === "theme")!.message.includes("ABSENT")
        ? "absent"
        : "sans-couleurs"
      : "complet";
    console.log(
      `  ${cf.padEnd(38)} trad:${String(c("trad")).padStart(3)} liens:${String(c("lien-mort")).padStart(3)} inerte:${c("lien-inerte")} ` +
        `assets:${String(c("asset-manquant")).padStart(2)} strip:${String(c("cle-strippee")).padStart(2)} ` +
        `prereq:${c("module-prereq")} theme:${theme}`,
    );
  }
  console.log(`\nTotal constats actifs : ${totalActive}\n`);
}

if (STRICT && totalActive > 0) {
  console.error("❌  --strict : des constats non assumés existent.");
  process.exit(1);
}
