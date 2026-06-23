/**
 * Cartographie des fonctions — outil régénérable (chantier dédupe/mutualisation).
 *
 * Fait remonter, CLASSÉS et actionnables, trois signaux sur les fonctions de
 * `src/` (l'outil cartographie, il NE refactore PAS) :
 *
 *   1. DOUBLONS à fusionner   — fonctions au corps identique/quasi (toDate×3,
 *      getLocation×4…), regroupées et classées `identical | quasi | different`.
 *   2. GÉNÉRIQUES à mutualiser — fonctions pures (sans JSX/hook) vivant dans un
 *      module/feature, candidates à une promotion vers `src/helpers|lib`.
 *   3. CODE MORT / sur-exporté — via `knip` (exports/fichiers non référencés).
 *
 * Approche HYBRIDE : ts-morph (inventaire AST + hash de corps + références) +
 * `knip` (code mort). jscpd écarté (binaire natif incompatible avec la glibc de
 * l'hôte) → la détection de doublons se fait au grain FONCTION via hash de corps
 * normalisé, plus précis pour notre unité d'action (la fonction).
 *
 * Sortie (versionnée) : `doc/cartographie-fonctions/{functions.json, RAPPORT.md}`.
 * Bruts knip : `.audit/cartographie/` (gitignored).
 *
 * Usage :
 *   npm run map:functions                       → écrit l'artefact + résumé
 *   npm run map:functions -- --json             → dump structuré sur stdout
 *   npm run map:functions -- --scope src/modules/cagnotte   → restreint l'analyse
 *   npm run map:functions -- --refs             → calcule l'usage cross-module (lent)
 *   npm run map:functions -- --skip-knip        → sans la passe code mort (itération rapide)
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Project, SyntaxKind, Node } from "ts-morph";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const JSON_OUT = argv.includes("--json");
const USE_REFS = argv.includes("--refs");
const SKIP_KNIP = argv.includes("--skip-knip");
const scopeIdx = argv.indexOf("--scope");
const SCOPE = scopeIdx >= 0 ? argv[scopeIdx + 1].replace(/\/+$/, "") : "src";

const OUT_DIR = path.join(ROOT, "doc/cartographie-fonctions");
const RAW_DIR = path.join(ROOT, ".audit/cartographie");

/*───────────────────────────────────────────────────────────────*/
/* Couches (où vit le code partagé vs feature)                   */
/*───────────────────────────────────────────────────────────────*/
const SHARED_DIRS = new Set(["helpers", "utils", "lib", "hooks", "constants", "types"]);

function layerOf(rel: string): string {
  const seg = rel.split("/"); // ex. src/modules/cagnotte/...
  if (seg[0] !== "src") return "other";
  if (seg[1] === "modules") return `module:${seg[2] ?? "?"}`;
  if (SHARED_DIRS.has(seg[1])) return `shared:${seg[1]}`;
  return `feature:${seg[1] ?? "?"}`;
}
const isShared = (layer: string) => layer.startsWith("shared:");

/*───────────────────────────────────────────────────────────────*/
/* Normalisation / hash / similarité de corps                    */
/*───────────────────────────────────────────────────────────────*/
function normalizeBody(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, " ") // blocs /* */
    .replace(/\/\/[^\n]*/g, " ") // lignes //
    .replace(/\s+/g, " ")
    .trim();
}
function tokenize(norm: string): string[] {
  return norm.match(/[A-Za-z_$][\w$]*|\d+|[^\s\w]/g) ?? [];
}
function hashOf(norm: string): string {
  return crypto.createHash("sha1").update(norm).digest("hex").slice(0, 12);
}
/** Jaccard du multiset de tokens (0..1) — sert à classer quasi vs different. */
function similarity(a: string[], b: string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 1 : inter / union;
}

/*───────────────────────────────────────────────────────────────*/
/* Inventaire des fonctions (AST)                                */
/*───────────────────────────────────────────────────────────────*/
interface FnRec {
  id: string;
  name: string;
  file: string; // relatif au ROOT
  line: number;
  layer: string;
  exported: boolean;
  kind: "function" | "arrow" | "method";
  loc: number;
  generic: boolean; // pur : sans JSX ni hook
  isHook: boolean;
  tokens: number;
  hash: string;
  _tokens: string[]; // interne (non sérialisé)
  _node: Node; // interne (refs)
}

const project = new Project({
  tsConfigFilePath: path.join(ROOT, "tsconfig.app.json"),
  skipAddingFilesFromTsConfig: true,
});
project.addSourceFilesAtPaths([
  `${SCOPE}/**/*.ts`,
  `${SCOPE}/**/*.tsx`,
  `!${SCOPE}/**/*.test.ts`,
  `!${SCOPE}/**/*.test.tsx`,
  `!${SCOPE}/**/*.d.ts`,
]);

function hasJsx(node: Node): boolean {
  return (
    node.getDescendantsOfKind(SyntaxKind.JsxElement).length > 0 ||
    node.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).length > 0 ||
    node.getDescendantsOfKind(SyntaxKind.JsxFragment).length > 0
  );
}
function callsHook(node: Node): boolean {
  return node
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((c) => /^use[A-Z]/.test(c.getExpression().getText()));
}

const fns: FnRec[] = [];
let autoId = 0;

function record(
  name: string,
  file: string,
  line: number,
  exported: boolean,
  kind: FnRec["kind"],
  bodyText: string,
  endLine: number,
  node: Node,
): void {
  const norm = normalizeBody(bodyText);
  const toks = tokenize(norm);
  const isHook = /^use[A-Z]/.test(name);
  const generic = !hasJsx(node) && !isHook && !callsHook(node);
  fns.push({
    id: `f${autoId++}`,
    name,
    file,
    line,
    layer: layerOf(file),
    exported,
    kind,
    loc: Math.max(1, endLine - line + 1),
    generic,
    isHook,
    tokens: toks.length,
    hash: hashOf(norm),
    _tokens: toks,
    _node: node,
  });
}

for (const sf of project.getSourceFiles()) {
  const file = path.relative(ROOT, sf.getFilePath());
  // 1. Déclarations de fonctions (y compris imbriquées : getLocation dans un composant).
  for (const fn of sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)) {
    const name = fn.getName();
    const body = fn.getBodyText();
    if (!name || body == null) continue;
    record(name, file, fn.getStartLineNumber(), fn.isExported(), "function", body, fn.getEndLineNumber(), fn);
  }
  // 2. const x = (…) => … | function(…) {…}
  for (const vd of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    const init = vd.getInitializer();
    if (!init || !(Node.isArrowFunction(init) || Node.isFunctionExpression(init))) continue;
    const name = vd.getName();
    const bodyNode = init.getBody();
    if (!name || !bodyNode) continue;
    const body = Node.isBlock(bodyNode) ? (bodyNode.getText().slice(1, -1)) : bodyNode.getText();
    const stmt = vd.getVariableStatement();
    record(name, file, vd.getStartLineNumber(), !!stmt?.isExported(), "arrow", body, init.getEndLineNumber(), init);
  }
}

/*───────────────────────────────────────────────────────────────*/
/* Signal 1 — doublons (clusters de corps + clusters de noms)     */
/*───────────────────────────────────────────────────────────────*/
const MIN_TOKENS = 10; // corps trop court → bruit (return null, etc.)

// a) Corps identiques (même hash) sur ≥2 fichiers distincts.
const byHash = new Map<string, FnRec[]>();
for (const f of fns) {
  if (f.tokens < MIN_TOKENS) continue;
  (byHash.get(f.hash) ?? byHash.set(f.hash, []).get(f.hash)!).push(f);
}
const duplicateBodies = [...byHash.values()]
  .filter((g) => new Set(g.map((f) => f.file)).size >= 2)
  .map((g) => ({
    names: [...new Set(g.map((f) => f.name))],
    count: g.length,
    tokens: g[0].tokens,
    defs: g.map((f) => ({ name: f.name, at: `${f.file}:${f.line}`, layer: f.layer })),
  }))
  .sort((a, b) => b.count - a.count || b.tokens - a.tokens);

// b) Clusters de NOM (même identifiant, ≥2 fichiers) → classés identical/quasi/different.
const byName = new Map<string, FnRec[]>();
for (const f of fns) (byName.get(f.name) ?? byName.set(f.name, []).get(f.name)!).push(f);

function classify(group: FnRec[]): "identical" | "quasi" | "different" {
  if (new Set(group.map((f) => f.hash)).size === 1) return "identical";
  let maxSim = 0;
  for (let i = 0; i < group.length; i++)
    for (let j = i + 1; j < group.length; j++)
      maxSim = Math.max(maxSim, similarity(group[i]._tokens, group[j]._tokens));
  return maxSim >= 0.5 ? "quasi" : "different";
}

/** Noms INCIDENTS (handlers/renderers locaux) : un même nom dans N fichiers
 *  n'est PAS un doublon à fusionner mais une convention UI → exclus des
 *  clusters affichés et des candidats à mutualiser. */
const isIncidentalName = (n: string) => /^(handle|on)[A-Z]/.test(n) || /^render/.test(n);

const nameClusters = [...byName.entries()]
  .filter(([, g]) => new Set(g.map((f) => f.file)).size >= 2)
  .map(([name, g]) => ({
    name,
    count: g.length,
    classe: classify(g),
    defs: g.map((f) => ({ at: `${f.file}:${f.line}`, layer: f.layer, exported: f.exported })),
  }))
  .sort((a, b) => {
    const order = { identical: 0, quasi: 1, different: 2 };
    return order[a.classe] - order[b.classe] || b.count - a.count;
  });

/*───────────────────────────────────────────────────────────────*/
/* Signal 2 — génériques à mutualiser                            */
/*───────────────────────────────────────────────────────────────*/
const duplicatedIds = new Set(
  duplicateBodies.flatMap((d) => fns.filter((f) => d.defs.some((x) => x.at === `${f.file}:${f.line}`)).map((f) => f.id)),
);

// Candidats : fonctions GÉNÉRIQUES (sans JSX/hook) en couche feature/module,
// soit DUPLIQUÉES (copie/colle → factoriser+partager), soit exportées depuis un
// `utils/`|`helpers/` de module (prêtes à promouvoir, ex. dataTransform). Les
// handlers locaux et les exports « API interne au module » non dupliqués sont
// exclus (signal trop large sinon : 200+ faux candidats).
let sharingCandidates = fns
  .filter((f) => {
    if (!f.generic || isShared(f.layer) || f.layer === "other" || f.tokens < MIN_TOKENS) return false;
    if (isIncidentalName(f.name)) return false;
    const dir = f.file.split("/").slice(0, -1).join("/");
    const inUtilDir = /\/(utils|helpers)$/.test(dir);
    return duplicatedIds.has(f.id) || (f.exported && inUtilDir);
  })
  .map((f) => {
    const dir = f.file.split("/").slice(0, -1).join("/");
    const inUtilDir = /\/(utils|helpers)$/.test(dir);
    const duplicated = duplicatedIds.has(f.id);
    // Home suggéré : primitive courte → helpers ; sinon glue → lib.
    const suggestedHome = f.loc <= 12 ? "src/helpers/" : "src/lib/";
    return {
      name: f.name,
      at: `${f.file}:${f.line}`,
      layer: f.layer,
      loc: f.loc,
      exported: f.exported,
      duplicated,
      inUtilDir,
      suggestedHome,
      crossModuleRefs: undefined as number | undefined,
      _node: f._node,
    };
  });

// --refs : usage cross-module réel (lent : language service). Hors défaut.
if (USE_REFS) {
  for (const c of sharingCandidates) {
    try {
      const refNodes = (c._node as unknown as { findReferencesAsNodes?: () => Node[] }).findReferencesAsNodes?.() ?? [];
      const defModule = c.layer;
      const cross = new Set<string>();
      for (const r of refNodes) {
        const rl = layerOf(path.relative(ROOT, r.getSourceFile().getFilePath()));
        if (rl !== defModule) cross.add(`${rl}`);
      }
      c.crossModuleRefs = cross.size;
    } catch {
      c.crossModuleRefs = undefined;
    }
  }
}
sharingCandidates = sharingCandidates.sort(
  (a, b) => Number(b.duplicated) - Number(a.duplicated) || (b.crossModuleRefs ?? 0) - (a.crossModuleRefs ?? 0) || b.loc - a.loc,
);
const sharingOut = sharingCandidates.map(({ _node, ...rest }) => rest);

/*───────────────────────────────────────────────────────────────*/
/* Signal 3 — code mort (knip)                                   */
/*───────────────────────────────────────────────────────────────*/
interface DeadExport { file: string; name: string; line: number }
let deadExports: DeadExport[] = [];
let deadFiles: string[] = [];
let knipError: string | null = null;

if (!SKIP_KNIP) {
  try {
    const raw = execFileSync("npx", ["knip", "--reporter", "json", "--no-exit-code"], {
      cwd: ROOT,
      encoding: "utf-8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
    fs.mkdirSync(RAW_DIR, { recursive: true });
    fs.writeFileSync(path.join(RAW_DIR, "knip.json"), raw);
    const parsed = JSON.parse(raw) as { issues?: Array<{ file: string; exports?: Array<{ name: string; line: number }>; types?: Array<{ name: string; line: number }>; files?: Array<{ name: string }> }> };
    const inScope = (p: string) => p.startsWith(`${SCOPE}/`) || p === SCOPE || p.startsWith("src/");
    for (const iss of parsed.issues ?? []) {
      for (const ex of [...(iss.exports ?? []), ...(iss.types ?? [])])
        if (inScope(iss.file)) deadExports.push({ file: iss.file, name: ex.name, line: ex.line });
      for (const f of iss.files ?? [])
        if (inScope(f.name) && !f.name.endsWith(".css")) deadFiles.push(f.name);
    }
    deadExports = deadExports.filter((d) => d.file.startsWith("src/")).sort((a, b) => a.file.localeCompare(b.file));
    deadFiles = [...new Set(deadFiles.filter((f) => f.startsWith("src/")))].sort();
  } catch (e) {
    knipError = (e as Error).message;
  }
}

/*───────────────────────────────────────────────────────────────*/
/* Bonus — chevauchements de couches partagées                   */
/*───────────────────────────────────────────────────────────────*/
const sharedFilesByBase = new Map<string, string[]>();
for (const f of fns) {
  const seg = f.file.split("/");
  if (seg[0] === "src" && SHARED_DIRS.has(seg[1])) {
    const base = path.basename(f.file);
    (sharedFilesByBase.get(base) ?? sharedFilesByBase.set(base, []).get(base)!).push(f.file);
  }
}
const layerOverlaps = [...sharedFilesByBase.entries()]
  .map(([base, files]) => ({ base, files: [...new Set(files)] }))
  .filter((o) => o.files.length >= 2);

/*───────────────────────────────────────────────────────────────*/
/* Émission                                                      */
/*───────────────────────────────────────────────────────────────*/
let commit = "unknown";
try {
  commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT, encoding: "utf-8" }).trim();
} catch { /* hors git */ }

const inventory = fns.map((f) => ({
  name: f.name,
  file: f.file,
  line: f.line,
  layer: f.layer,
  kind: f.kind,
  exported: f.exported,
  loc: f.loc,
  generic: f.generic,
  hash: f.hash,
}));

const summary = {
  functions: fns.length,
  files: project.getSourceFiles().length,
  duplicateBodyClusters: duplicateBodies.length,
  nameClusters: nameClusters.length,
  sharingCandidates: sharingOut.length,
  deadExports: deadExports.length,
  deadFiles: deadFiles.length,
  layerOverlaps: layerOverlaps.length,
};

const result = {
  generatedFrom: commit,
  scope: SCOPE,
  summary,
  findings: { duplicateBodies, nameClusters, sharingCandidates: sharingOut, deadExports, deadFiles, layerOverlaps },
  inventory,
  ...(knipError ? { knipError } : {}),
};

if (JSON_OUT) {
  // Drain SYNCHRONE complet vers stdout : sur un PIPE, `fs.writeSync` n'écrit
  // qu'un buffer (~64 Ko) et renvoie un compte PARTIEL — et `console.log` +
  // `process.exit` tronque (flush async). On boucle jusqu'au dernier octet
  // (EAGAIN = pipe plein → on retente), puis on sort.
  const buf = Buffer.from(JSON.stringify(result, null, 2) + "\n");
  let off = 0;
  while (off < buf.length) {
    try {
      off += fs.writeSync(1, buf, off, buf.length - off);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EAGAIN") continue;
      throw e;
    }
  }
  process.exit(0);
}

// Artefact versionné : functions.json + RAPPORT.md
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "functions.json"), JSON.stringify(result, null, 2) + "\n");

const md: string[] = [];
md.push(`# Cartographie des fonctions — RAPPORT`);
md.push("");
md.push(`> Généré par \`npm run map:functions\` · scope \`${SCOPE}\` · base \`${commit}\`. NE PAS éditer à la main (régénérer).`);
md.push("");
md.push(`**Inventaire** : ${summary.functions} fonctions sur ${summary.files} fichiers. ` +
  `Doublons (corps) : ${summary.duplicateBodyClusters} clusters · Clusters de nom : ${summary.nameClusters} · ` +
  `Génériques à mutualiser : ${summary.sharingCandidates} · Code mort : ${summary.deadExports} exports + ${summary.deadFiles} fichiers · ` +
  `Chevauchements de couches : ${summary.layerOverlaps}.`);
if (knipError) md.push(`\n> ⚠️ knip indisponible (${knipError}) — section « code mort » vide. Relancer avec knip OK.`);

md.push("\n## 1. À fusionner — corps identiques (≥2 fichiers)");
md.push("Même corps normalisé à plusieurs endroits → candidat fusion direct vers une source unique.\n");
if (!duplicateBodies.length) md.push("_Aucun._");
for (const d of duplicateBodies.slice(0, 60)) {
  md.push(`- **${d.names.join(" / ")}** ×${d.count} (${d.tokens} tokens) :`);
  for (const def of d.defs) md.push(`  - \`${def.at}\` _(${def.layer})_`);
}

md.push("\n## 2. Clusters de NOM (même identifiant utilitaire, ≥2 fichiers) — classés");
md.push("`identical` = fusionner · `quasi` = vérifier les différences (signature/défaut/retour) avant fusion · `different` = même nom, corps divergents → décider au cas par cas. " +
  "Les noms INCIDENTS (handlers `handle*`/`on*`, `render*`) sont exclus (convention UI, pas des doublons).\n");
const utilityClusters = nameClusters.filter((c) => !isIncidentalName(c.name));
const hiddenIncidental = nameClusters.length - utilityClusters.length;
for (const c of utilityClusters.slice(0, 120)) {
  md.push(`- **${c.name}** ×${c.count} — \`${c.classe}\``);
  for (const def of c.defs) md.push(`  - \`${def.at}\` _(${def.layer}${def.exported ? ", exporté" : ""})_`);
}
if (utilityClusters.length > 120) md.push(`- … (+${utilityClusters.length - 120}, voir functions.json)`);
md.push(`\n_(${hiddenIncidental} clusters de noms incidents handlers/render exclus de cette section.)_`);

md.push("\n## 3. À mutualiser — génériques enfouis (pures, en module/feature)");
md.push("Fonctions sans JSX ni hook vivant hors des couches partagées → candidates à promouvoir." +
  (USE_REFS ? " `crossModuleRefs` = nb de couches qui l'utilisent." : " (relancer `--refs` pour l'usage cross-module réel.)") + "\n");
for (const s of sharingOut.slice(0, 80)) {
  const tags = [s.duplicated ? "dupliquée" : null, s.inUtilDir ? "dans utils/helpers" : null, s.crossModuleRefs != null ? `cross:${s.crossModuleRefs}` : null].filter(Boolean).join(", ");
  md.push(`- **${s.name}** \`${s.at}\` _(${s.layer}, ${s.loc} loc)_ → ${s.suggestedHome}${tags ? ` — ${tags}` : ""}`);
}

md.push("\n## 4. Code mort / sur-exporté (knip — à VÉRIFIER)");
md.push("Signal heuristique : exports/fichiers sans référence statique. Vérifier les usages dynamiques (glob, lazy, inférence de type) avant suppression.\n");
md.push(`### Fichiers non référencés (${deadFiles.length})`);
for (const f of deadFiles.slice(0, 60)) md.push(`- \`${f}\``);
md.push(`\n### Exports non référencés (${deadExports.length})`);
for (const d of deadExports.slice(0, 120)) md.push(`- \`${d.file}:${d.line}\` — \`${d.name}\``);
if (deadExports.length > 120) md.push(`- … (+${deadExports.length - 120})`);

md.push("\n## 5. Chevauchements de couches partagées");
md.push("Même nom de fichier dans plusieurs dossiers partagés (helpers/utils/lib…) → vérifier l'intention (faux doublon vs vraie duplication).\n");
if (!layerOverlaps.length) md.push("_Aucun._");
for (const o of layerOverlaps) md.push(`- **${o.base}** : ${o.files.map((f) => `\`${f}\``).join(" · ")}`);

md.push("");
fs.writeFileSync(path.join(OUT_DIR, "RAPPORT.md"), md.join("\n"));

// Résumé console
console.log(`\n🗺️   Cartographie des fonctions  (scope ${SCOPE}, base ${commit})`);
console.log("═".repeat(60));
console.log(`  fonctions inventoriées        : ${summary.functions} sur ${summary.files} fichiers`);
console.log(`  doublons (corps identiques)   : ${summary.duplicateBodyClusters} clusters`);
console.log(`  clusters de nom (≥2 fichiers) : ${summary.nameClusters}`);
console.log(`  génériques à mutualiser       : ${summary.sharingCandidates}`);
console.log(`  code mort (knip)              : ${summary.deadExports} exports · ${summary.deadFiles} fichiers${knipError ? "  (knip KO)" : ""}`);
console.log(`  chevauchements de couches     : ${summary.layerOverlaps}`);
console.log("═".repeat(60));
console.log(`  → doc/cartographie-fonctions/RAPPORT.md  +  functions.json\n`);
