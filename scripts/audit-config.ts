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
 *   - ANCRES mortes (`#frag` sans id de section ni de markup correspondant),
 *   - bloc `theme` absent ou sans couleurs,
 *   - ASSETS manquants (toute valeur à extension d'image → fichier absent de
 *     public/ ; règle inversée, une whitelist de clés ratait ogImage/path),
 *   - CLÉS STRIPPÉES par Zod (posées dans le config mais inconnues du schéma
 *     → config mort silencieux, ex. un `variant` ignoré par le composant),
 *   - RÉFÉRENCES mortes (`modal`/`editModal` sans costumForm ni builtin),
 *   - ICÔNES inconnues (nom hors catalogue lucide),
 *   - PRÉREQUIS modules (searchPro/searchProStatic/agenda sans `baseParams`).
 *
 * Les trois derniers contrôles visent la même classe de défaut : un échec
 * SILENCIEUX à l'exécution (composant qui rend `null`) que ni `config:validate`
 * ni le préflight ne voient. Leurs vocabulaires sont DÉRIVÉS du code
 * (lib/code-vocabulary.ts), jamais recopiés.
 *
 * Chaque constat porte {category, path, message, severity, fixability} —
 * `fixability` pilote le flux de réparation de l'assistant config (doc/26) :
 * `auto` (lot mécanique) · `proposer` (choix humain) · `suggestion` (opt-in).
 *
 * Constats ASSUMÉS — DEUX sources, lues toutes les deux :
 *   - `.audit-baseline.json` (racine, GITIGNORÉ — état local, jamais partagé) ;
 *   - `knownFindings` de .claude/skills/config-assistant/archetypes.json
 *     (VERSIONNÉ — constats assumés PARTAGÉS des configs archétypes, avec leur
 *     `note` ; c'est aussi la référence du gate tests/preflight/archetypes.test.ts).
 * Clés = fichier de config, valeurs = [{category, path}]. Un constat assumé est
 * reporté à part (`assumed`) et n'échoue pas `--strict`.
 *
 * Usage :
 *   npm run audit:config                      → tous les configs, rapport humain
 *   npm run audit:config -- --file <x.json>   → un seul config (chemin absolu accepté)
 *   npm run audit:config -- --json            → sortie structurée (assistant/CI)
 *   npm run audit:config -- --strict          → exit 1 si constat non assumé
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SiteConfig } from "../src/types/site-schema";
import { moduleRoutePrefixes } from "./lib/module-routes";
import {
  builtinModalNames,
  tsCostumIds,
  lucideIconNames,
  mappedColorTokens,
  colorTokensUsedInCode,
} from "./lib/code-vocabulary";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const STRICT = argv.includes("--strict");
const JSON_OUT = argv.includes("--json");
const fileArgIdx = argv.indexOf("--file");
const FILE_ARG = fileArgIdx >= 0 ? argv[fileArgIdx + 1] : undefined;
// Chemin ABSOLU accepté (auditer un brouillon hors repo, ex. /tmp) ; relativisé
// s'il pointe DANS le repo pour que baseline/knownFindings (clés relatives)
// s'appliquent quand même.
const ONLY_FILE =
  FILE_ARG && path.isAbsolute(FILE_ARG) && FILE_ARG.startsWith(ROOT + path.sep)
    ? path.relative(ROOT, FILE_ARG)
    : FILE_ARG;
/** Absolu tel quel, relatif résolu depuis la racine du repo. */
const resolveConfigPath = (f: string) => (path.isAbsolute(f) ? f : path.join(ROOT, f));

const LOCALES = ["fr", "en", "es", "de"];
// Routes servies par les modules (pas des pages du JSON) → liens internes
// valides. DÉRIVÉES de src/modules/*/routes.tsx (cf. lib/module-routes.ts) :
// la constante figée qu'elles remplacent avait dérivé (/admin, /blog absents).
const KNOWN_ROUTE_PREFIXES = new Set(moduleRoutePrefixes(ROOT));
// Vocabulaires résolus par le code (cf. lib/code-vocabulary.ts).
const BUILTIN_MODALS = new Set(builtinModalNames(ROOT));
const TS_COSTUM_IDS = new Set(tsCostumIds(ROOT));
const LUCIDE_NAMES = lucideIconNames(ROOT);
// Chemins de config dont l'`icon` suit un vocabulaire MAISON, pas lucide :
// footer.contactSection a son propre iconMap (email→Mail, tel→Phone…).
const OWN_ICON_VOCABULARY = [".contactSection."];

type Fixability = "auto" | "proposer" | "suggestion";
interface Finding {
  category: string;
  path: string;
  message: string;
  severity: "warn" | "info";
  fixability: Fixability;
  /** Renseignée sur les constats ASSUMÉS : pourquoi le choix est délibéré. */
  note?: string;
  /**
   * Valeur fautive telle qu'elle est dans le config. Évite de rouvrir un
   * fichier de 267 à 431 Ko pour savoir ce qu'on corrige.
   */
  value?: string;
  /**
   * Contexte suffisant pour AGIR sans relire le fichier. Pour `trad` : les
   * traductions déjà présentes (traduire depuis `fr` sans rien rouvrir).
   */
  sibling?: Record<string, string>;
  /**
   * Constats qui relèvent d'UNE SEULE décision. Les 123 `locale-extra` du parc
   * sont 3 décisions (une par config), pas 123 corrections.
   */
  groupKey?: string;
}

interface AssumedEntry {
  category: string;
  path: string;
  note?: string;
}

const baselinePath = path.join(ROOT, ".audit-baseline.json");
const baseline: Record<string, AssumedEntry[]> = fs.existsSync(baselinePath)
  ? JSON.parse(fs.readFileSync(baselinePath, "utf-8"))
  : {};

// Constats assumés PARTAGÉS des archétypes (versionnés dans le manifest de la
// skill). Sans cette lecture, l'audit ressortait à chaque passage un choix
// explicitement assumé et l'assistant re-proposait de le « corriger ».
const manifestPath = path.join(ROOT, ".claude/skills/config-assistant/archetypes.json");
const knownFindings: Record<string, AssumedEntry[]> = {};
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
    archetypes?: { config: string; knownFindings?: AssumedEntry[] }[];
  };
  for (const a of manifest.archetypes ?? [])
    if (a.knownFindings?.length) knownFindings[a.config] = a.knownFindings;
}

const STATUS_TOKENS_USED = colorTokensUsedInCode(ROOT);

const sites = JSON.parse(fs.readFileSync(path.join(ROOT, "sites.json"), "utf-8")) as {
  config: string;
  css?: string;
}[];
const sitesConfigs = new Set(sites.map((s) => s.config));
const allConfigs = [...new Set(["config.prod.json", ...sites.map((s) => s.config)])].filter((f) =>
  fs.existsSync(path.join(ROOT, f)),
);
const configs = ONLY_FILE ? [ONLY_FILE].filter((f) => fs.existsSync(resolveConfigPath(f))) : allConfigs;
if (ONLY_FILE && configs.length === 0) {
  console.error(`✗ introuvable : ${resolveConfigPath(ONLY_FILE)}`);
  console.error(`  (--file accepte un chemin absolu, ou relatif à ${ROOT})`);
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
  const raw = JSON.parse(fs.readFileSync(resolveConfigPath(cf), "utf-8")) as Record<string, unknown>;
  const findings: Finding[] = [];
  const langs: string[] = (raw.meta as { languages?: string[] })?.languages ?? ["fr"];
  const pagePaths = new Set(((raw.pages as { path: string }[]) ?? []).map((pg) => pg.path));
  const costumIds = new Set(Object.keys((raw.costumForms as Record<string, unknown>) ?? {}));

  // Cibles d'ancres possibles : tout `id` du config (sections comprises) + tout
  // id="…" posé dans du markup (sections html/customCSS) — sinon on flaguerait
  // une ancre parfaitement valide pointant dans un bloc HTML libre.
  const anchorIds = new Set<string>();
  walk(raw, (n) => {
    if (!n || typeof n !== "object" || Array.isArray(n)) return;
    for (const [k, v] of Object.entries(n as Record<string, unknown>)) {
      if (typeof v !== "string" || !v) continue;
      if (k === "id") anchorIds.add(v);
      if (v.includes('id="')) for (const m of v.matchAll(/id="([^"]+)"/g)) anchorIds.add(m[1]);
    }
  });

  walk(raw, (n, p) => {
    if (isLocalizedString(n)) {
      for (const l of langs)
        if (n[l] === undefined)
          findings.push({
            category: "trad",
            path: `${p.join(".")}[${l}]`,
            message: `traduction « ${l} » manquante`,
            severity: "warn",
            fixability: "proposer",
            // Le texte source voyage AVEC le constat : traduisible tel quel.
            sibling: { ...n },
            groupKey: `trad:${l}`,
          });
      for (const l of Object.keys(n))
        if (!langs.includes(l))
          findings.push({
            category: "locale-extra",
            path: `${p.join(".")}[${l}]`,
            message: `locale « ${l} » hors meta.languages (deux corrections possibles : ajouter « ${l} » à meta.languages, ou purger ces valeurs)`,
            severity: "info",
            // PAS `auto` : sur commune-transparente les 68 valeurs « en » sont de
            // VRAIES traductions et meta.languages ne déclare que « fr ». Purger
            // en lot détruirait le travail — c'est une décision, pas un nettoyage.
            fixability: "proposer",
            value: n[l],
            groupKey: `locale-extra:${l}`,
          });
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
          findings.push({ category: "lien-inerte", path: `${p.join(".")}.${key}`, message: "lien « # » inerte (placeholder sans destination)", severity: "warn", fixability: "proposer", value: v });
          continue;
        }
        // Ancre interne (`#frag` sur la page courante, ou `/page#frag`) : la
        // cible doit exister quelque part dans le config. Les `#` d'une URL
        // EXTERNE ne sont pas de notre ressort.
        if ((v.startsWith("#") || v.startsWith("/")) && v.includes("#")) {
          const frag = v.slice(v.indexOf("#") + 1);
          if (frag && !anchorIds.has(frag))
            findings.push({ category: "ancre-morte", path: `${p.join(".")}.${key}`, message: `ancre « #${frag} » sans cible (aucun id de section ni de markup)`, severity: "warn", fixability: "proposer", value: v });
        }
        if (!v.startsWith("/")) continue;
        const clean = v.split("?")[0].split("#")[0];
        const base = `/${clean.split("/")[1]}`;
        if (clean !== "/" && !pagePaths.has(clean) && !KNOWN_ROUTE_PREFIXES.has(base) && !clean.startsWith("/images/"))
          findings.push({ category: "lien-mort", path: `${p.join(".")}.${key}`, message: `lien interne sans page/route : ${v}`, severity: "warn", fixability: "proposer", value: v });
      }
      // Références de MODALES : `add-<id>`/`edit-<id>` doit résoudre vers un
      // costumForm du config, un costum TS, ou une modale builtin — sinon le
      // bouton rend `null` en silence (ModalRegistry.tsx:49 : un console.log).
      for (const key of ["modal", "editModal", "addModal"]) {
        const v = rec[key];
        if (typeof v !== "string" || !v || BUILTIN_MODALS.has(v)) continue;
        const id = /^(?:add|edit)-(.+)$/.exec(v)?.[1];
        if (id && (costumIds.has(id) || TS_COSTUM_IDS.has(id))) continue;
        findings.push({
          category: "ref-morte",
          path: `${p.join(".")}.${key}`,
          message: id
            ? `modale « ${v} » : ni costumForms.${id} ni costum TS — le bouton rend null`
            : `modale « ${v} » : hors registre (attendu add-<id> / edit-<id>) — le bouton rend null`,
          severity: "warn",
          fixability: "proposer",
          value: v,
        });
      }
      // Icônes lucide : un nom inconnu rend `null` depuis un useEffect (rien en
      // SSR, aucune trace) — l'icône disparaît sans que rien ne le signale.
      if (LUCIDE_NAMES.size) {
        for (const [k, v] of Object.entries(rec)) {
          if (!/icon$/i.test(k) || k.toLowerCase() === "favicon") continue;
          if (typeof v !== "string" || !v) continue;
          // SVG inline et chemins d'image ne sont pas des noms lucide.
          if (v.trim().startsWith("<") || v.includes("/") || v.includes(".")) continue;
          const at = `${p.join(".")}.${k}`;
          if (OWN_ICON_VOCABULARY.some((frag) => at.includes(frag))) continue;
          if (!LUCIDE_NAMES.has(v))
            findings.push({ category: "icone-inconnue", path: at, message: `icône « ${v} » hors catalogue lucide (1901 noms) — rendue null sans erreur`, severity: "warn", fixability: "proposer", value: v });
        }
      }
      // Assets locaux : le fichier doit exister dans public/. Règle INVERSÉE
      // (toute valeur à extension d'image, quelle que soit la clé) — la
      // whitelist de clés ratait `ogImage` (×28), `path`, `logoDark`, `iconImage`.
      for (const [k, v] of Object.entries(rec)) {
        if (typeof v !== "string" || v.length === 0) continue;
        if (/^(https?:|data:|blob:)/.test(v) || v.trim().startsWith("<svg")) continue;
        const rel = v.startsWith("/") ? v.slice(1) : v;
        // Ne juger que les valeurs qui RESSEMBLENT à des fichiers (extension
        // d'asset) — exclut les noms d'icône lucide ET les chemins de champ
        // CoForm (ex. ampli.props.path.image = "formKey.fieldId", pas un fichier).
        if (!/\.(png|jpe?g|gif|webp|svg|avif|ico)$/i.test(rel)) continue;
        if (!fs.existsSync(path.join(ROOT, "public", rel)))
          findings.push({ category: "asset-manquant", path: `${p.join(".")}.${k}`, message: `fichier absent de public/ : ${v}`, severity: "warn", fixability: "proposer", value: v });
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
    // `agenda` porte lui aussi un `baseParams` (searchEventsCostum) : sans lui,
    // l'agenda ratisse hors périmètre — et validate/preflight ne disent rien.
    if (rec && (rec.type === "searchPro" || rec.type === "searchProStatic" || rec.type === "agenda")) {
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
  // Token déclaré dans config.theme MAIS non exposé à Tailwind par le CSS du
  // site : SiteTheme l'injecte bien (`--warning`), mais sans le mapping
  // `@theme inline { --color-warning: var(--warning) }`, aucune classe
  // `bg-warning` ne résout — la couleur est écrite pour rien. On ne signale que
  // les tokens qu'un composant utilise VRAIMENT via une classe utilitaire.
  const css = sites.find((s) => s.config === cf)?.css;
  if (css) {
    const mapped = mappedColorTokens(ROOT, css);
    const light = (tm?.colors as { light?: Record<string, unknown> } | undefined)?.light ?? {};
    for (const token of Object.keys(light)) {
      if (!STATUS_TOKENS_USED.has(token) || mapped.has(token)) continue;
      findings.push({
        category: "theme-token-non-mappe",
        path: `theme.colors.light.${token}`,
        message: `« ${token} » est injecté au runtime mais src/${css}.css ne mappe pas --color-${token} : les classes bg-${token}/text-${token} ne résolvent pas sur ce site`,
        severity: "warn",
        fixability: "proposer",
        value: String(light[token]),
        groupKey: `theme-token-non-mappe:${css}`,
      });
    }
  }

  if (themeStatus !== "complet")
    findings.push({ category: "theme", path: "theme", message: themeStatus === "absent" ? "bloc theme ABSENT (couleurs via le CSS du site)" : "theme sans colors.light/dark (playbook : migration rezo-la-mer 90b5200)", severity: "info", fixability: "proposer" });

  // Constats assumés : baseline LOCALE + knownFindings VERSIONNÉS du manifest.
  const assumedEntries = [...(baseline[cf] ?? []), ...(knownFindings[cf] ?? [])];
  const assumedBy = (f: Finding) => assumedEntries.find((b) => b.category === f.category && b.path === f.path);
  report[cf] = {
    findings: findings.filter((f) => !assumedBy(f)),
    assumed: findings.filter(assumedBy).map((f) => ({ ...f, note: assumedBy(f)?.note })),
  };
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

  // Un constat assumé se lit AVEC sa raison : sinon l'assistant repropose de le corriger.
  const printAssumed = (items: Finding[]) => {
    for (const a of items)
      console.log(`   ↳ assumé · ${a.category} @ ${a.path}${a.note ? ` — ${a.note}` : ""}`);
  };

  for (const [cf, { findings, assumed }] of Object.entries(report)) {
    if (findings.length === 0) {
      console.log(`\n✅  ${cf} — RAS${assumed.length ? ` (${assumed.length} assumé(s))` : ""}`);
      printAssumed(assumed);
      continue;
    }
    console.log(`\n⚠️   ${cf}${assumed.length ? `  (+${assumed.length} assumé(s))` : ""}`);
    printAssumed(assumed);
    const byCat = new Map<string, Finding[]>();
    for (const f of findings) byCat.set(f.category, [...(byCat.get(f.category) ?? []), f]);
    for (const [cat, items] of byCat) {
      // Raisonner en DÉCISIONS, pas en occurrences : 68 `locale-extra` sur une
      // même locale = un seul arbitrage.
      const groups = new Set(items.map((f) => f.groupKey).filter(Boolean) as string[]);
      const decisions = groups.size ? `  → ${groups.size} décision(s) : ${[...groups].join(", ")}` : "";
      console.log(`   • ${cat} ×${items.length} [${items[0].fixability}]${decisions}\n${preview(items.map((f) => `${f.path} — ${f.message}`))}`);
    }
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
