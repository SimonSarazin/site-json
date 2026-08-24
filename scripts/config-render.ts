/**
 * Vérifie qu'une config REND vraiment — l'angle mort que ni `config:validate`
 * (Zod) ni `audit:config` (statique) ne voient : une config PARFAITEMENT valide
 * peut servir une page blanche. Mesure de référence : une page `sections: []`
 * passe validate + préflight et sert un HTTP 200 de ~100 Ko … sans une seule
 * section. Le poids de la réponse ne prouve RIEN (shell + config inline +
 * scripts Vite pèsent déjà 100 Ko) — seul le HTML rendu le prouve.
 *
 * L'outil démarre le VRAI serveur SSR de dev sur cette config, requête chaque
 * `pages[].path` et compare le déclaré au rendu.
 *
 * Ce que « rendu » veut dire ici (vérifié sur le HTML réel, cf. SectionRenderer) :
 *   - `SiteRenderer` rend UN `<div data-section-index="i" data-section-type="T">`
 *     par section déclarée, dans l'ordre → l'appariement se fait sur le COUPLE
 *     (rang, type), pas sur un multi-ensemble de types. C'est ce qui distingue
 *     les sections de page des sections IMBRIQUÉES : `tabs`/`gridLayout` rendent
 *     un wrapper sans `data-section-index`, mais `cagnotte-layout` en pose un
 *     AVEC un index qui repart à 0 — un simple comptage de types le confondrait
 *     avec une section de page.
 *   - React 19 streame : le shell contient d'abord le FALLBACK Suspense
 *     (`data-loading-section`) + `<template id="B:x">`, puis le contenu réel
 *     arrive plus loin dans `<div hidden id="S:y">` avec un `$RC("B:x","S:y")`.
 *     → `data-loading-section` est donc présent sur TOUTES les pages saines :
 *       le prendre pour un marqueur d'échec (l'intuition naturelle) donne 100 %
 *       de faux positifs. Le vrai marqueur d'échec, c'est un `B:x` SANS `$RC`
 *       correspondant : la frontière n'a jamais résolu → skeleton infini.
 *     → les identifiants de frontière sont en base 32, PAS en décimal : au-delà
 *       de la 10e frontière d'une page React émet `B:a`, `B:b`, … Une regex en
 *       `\d+` décroche à partir de la 11e et rapporte « rendue mais vide » des
 *       sections parfaitement rendues (mesuré : 5 faux positifs sur 15 sections).
 *   - le contenu est mesuré en DESCENDANT les frontières : le segment d'un
 *     conteneur (`gridLayout`, `cagnotte-layout`) ne contient lui-même que les
 *     fallbacks de ses enfants, dont le texte n'arrive qu'au segment suivant.
 *     Sans descente récursive, un conteneur seul sur sa page = « page blanche ».
 *   - une section peut résoudre en rendant RIEN (client-only, props sans
 *     contenu) : comptée « vide », signalée, mais jamais fautive à elle seule ;
 *     une page n'échoue que si AUCUNE de ses sections n'a de contenu.
 *   - un type inconnu du SectionRenderer ne pose PAS de wrapper (il rend
 *     « not implemented yet ») → détecté comme type déclaré mais absent.
 *
 * Deux garde-fous contre le fait de CRIER AU LOUP (un outil qui se trompe est
 * un outil qu'on désactive) :
 *   - le serveur de DEV 404 tout ce qui commence par `/manifest`, `/favicon`,
 *     `/sw` (filtre fichiers statiques) alors que le serveur de PROD ne filtre
 *     que par extension. Une page `/manifeste` (cas réel, nos-commune) est donc
 *     morte en dev et vivante en prod : signalée en AVERTISSEMENT, jamais en
 *     échec. Les préfixes sont DÉRIVÉS des deux serveurs, pas recopiés.
 *   - une page derrière un garde d'auth (`page.auth`, `middleware`) est rendue
 *     ici en anonyme : son vide n'est pas un verdict, c'est un angle mort.
 *
 * Un garde-fou apparemment paranoïaque mais empirique : le script vérifie que
 * le serveur qui répond est bien LE SIEN (comparaison de `window.__CONFIG__`).
 * Un serveur zombie d'une session précédente écoutant le même port renvoyait
 * silencieusement le HTML d'un AUTRE site — un rapport « tout vert » sur une
 * config qui n'avait jamais été chargée.
 *
 * Usage :
 *   npx tsx scripts/config-render.ts <config.json> [--json] [--port <n>]
 *
 * Sortie / exit :
 *   0 = toutes les pages répondent 200 et rendent au moins une section ;
 *   1 = au moins une page vide, tronquée, non-200 ou avec des sections absentes ;
 *   2 = erreur d'usage, config illisible, ou serveur qui ne démarre pas.
 */
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, type ChildProcess } from "node:child_process";
import { isGatedPage } from "../src/lib/pageAccess";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// 5173 = `npm run dev`, 5188 = serveur des tests d'intégration : on part au-dessus
// pour ne jamais parler à (ni tuer) un serveur qui n'est pas le nôtre.
const DEFAULT_PORT = 5190;
const PORT_SCAN_MAX = 20;
const STARTUP_TIMEOUT_MS = 120_000;
const WARMUP_ATTEMPTS = 6;
const REQUEST_TIMEOUT_MS = 45_000;
const KILL_GRACE_MS = 5_000;

/*───────────────────────── Sorties ─────────────────────────*/
/**
 * Écriture SYNCHRONE. `process.exit()` tronque un stdout redirigé vers un PIPE
 * au-delà du buffer noyau (mesuré : 65 536 octets sur 500 000 écrits) parce que
 * `console.log` y est asynchrone — un `--json` un peu gros arrivait coupé dans
 * le `jq` de l'appelant. EPIPE (lecteur qui ferme, ex. `| head`) est avalé : le
 * laisser remonter tuait le script AVANT son `finally`, laissant le serveur SSR
 * orphelin sur son port (constaté).
 */
const sleepSlot = new Int32Array(new SharedArrayBuffer(4));
function writeFd(fd: 1 | 2, text: string): void {
  const buf = Buffer.from(text, "utf8");
  let off = 0;
  // BOUCLE obligatoire : redirigé vers un pipe, le fd est en mode non bloquant
  // et `writeSync` fait des écritures PARTIELLES (ou lève EAGAIN) sans rien
  // signaler. Un seul appel s'arrêtait pile au buffer du pipe — 65 536 octets,
  // mesuré — et le `--json` arrivait coupé chez l'appelant.
  while (off < buf.length) {
    try {
      off += fs.writeSync(fd, buf, off);
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === "EPIPE") return; // lecteur fermé (`| head`) : rien à signaler
      if (code !== "EAGAIN") throw e;
      Atomics.wait(sleepSlot, 0, 0, 5); // pipe pleine : seul sommeil possible entre deux writeSync
    }
  }
}
const out = (line: string) => writeFd(1, line + "\n");
const err = (line: string) => writeFd(2, line + "\n");

/*───────────────────────── Arguments ─────────────────────────*/
const argv = process.argv.slice(2);
const JSON_OUT = argv.includes("--json");

/** Journal de progression : sur stderr en mode --json pour garder stdout parsable. */
const log = (msg: string) => (JSON_OUT ? err(msg) : out(msg));

/**
 * Échec fatal APRÈS démarrage du serveur : `process.exit()` court-circuite le
 * `finally` (et laisserait un serveur orphelin sur le port) — on remonte donc
 * une erreur jusqu'au catch, qui laisse l'arrêt propre s'exécuter.
 */
class Fatal extends Error {
  constructor(
    readonly code: number,
    readonly lines: string[],
  ) {
    super(lines[0] ?? "erreur fatale");
  }
}

function usage(msg: string): never {
  err(`✗ ${msg}`);
  err("Usage : npx tsx scripts/config-render.ts <config.json> [--json] [--port <n>]");
  err(`  (chemin absolu, ou relatif à ${ROOT})`);
  process.exit(2);
}

// Parsing explicite : `--port=5199` était silencieusement ignoré (l'option
// n'étant reconnue que sous la forme `--port 5199`), et une option inconnue
// passait sans bruit — deux façons de croire tester ce qu'on ne teste pas.
let startPort = DEFAULT_PORT;
const positional: string[] = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith("--")) {
    positional.push(a);
    continue;
  }
  if (a === "--json") continue;
  const eq = a.indexOf("=");
  const name = eq >= 0 ? a.slice(0, eq) : a;
  if (name !== "--port") usage(`option inconnue : « ${a} »`);
  const raw = eq >= 0 ? a.slice(eq + 1) : argv[++i];
  const n = Number(raw);
  if (!raw || !Number.isInteger(n) || n < 1024 || n > 65535) usage(`--port invalide : « ${raw ?? ""} »`);
  startPort = n;
}
const CONFIG_ARG = positional[0];
if (!CONFIG_ARG) usage("config manquante");

// Absolu tel quel, relatif résolu depuis la racine du repo (même règle que audit-config.ts).
const configPath = path.isAbsolute(CONFIG_ARG) ? CONFIG_ARG : path.join(ROOT, CONFIG_ARG);
if (!fs.existsSync(configPath)) usage(`introuvable : ${configPath}`);
if (!fs.statSync(configPath).isFile()) usage(`n'est pas un fichier : ${configPath}`);
/** Étiquette : relative si la config est DANS le repo, absolue sinon (brouillon /tmp). */
const configLabel = configPath.startsWith(ROOT + path.sep) ? path.relative(ROOT, configPath) : configPath;

/*───────────────────────── Lecture config ─────────────────────────*/
interface SectionLike {
  type: string;
  id?: string;
  props?: Record<string, unknown>;
  visibility?: unknown;
  condition?: unknown;
  visibleIf?: unknown;
}
interface PageLike {
  path: string;
  title?: Record<string, string>;
  sections?: SectionLike[];
  auth?: { required?: boolean; roles?: string[] };
  middleware?: string[];
}
interface ConfigLike {
  meta?: { title?: Record<string, string> };
  pages?: PageLike[];
}

let config: ConfigLike;
try {
  config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as ConfigLike;
} catch (e) {
  usage(`JSON illisible (${(e as Error).message})`);
}
const pages = config.pages ?? [];
if (pages.length === 0) usage("config sans `pages` — rien à rendre");
/** Le serveur monte les routes sur `path.replace(/^\/+/, "")` : une page peut être déclarée sans slash. */
const urlPath = (p: string) => (p.startsWith("/") ? p : `/${p}`);

/** Lit une clé du .env (le serveur le charge aussi, mais on veut l'AFFICHER). */
function readDotEnv(key: string): string | undefined {
  const p = path.join(ROOT, ".env");
  if (!fs.existsSync(p)) return undefined;
  for (const line of fs.readFileSync(p, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=(.*)$/);
    if (m && m[1] === key) return m[2].trim().replace(/^["']|["']$/g, "");
  }
  return undefined;
}

// Slug d'entité : celui de sites.json si la config y est enregistrée (sinon le
// site booterait sur l'entité d'un AUTRE site, héritée de .env).
function resolveSlug(): { slug: string; origin: string } {
  const sitesPath = path.join(ROOT, "sites.json");
  if (fs.existsSync(sitesPath)) {
    const sites = JSON.parse(fs.readFileSync(sitesPath, "utf-8")) as { slug: string; config: string }[];
    const hit = sites.find((s) => s.config === configLabel);
    if (hit) return { slug: hit.slug, origin: "sites.json" };
  }
  const inherited = process.env.VITE_SLUG ?? readDotEnv("VITE_SLUG");
  return { slug: inherited ?? "default", origin: inherited ? ".env (config hors sites.json)" : "défaut" };
}
const { slug, origin: slugOrigin } = resolveSlug();

/*───────────────────────── Filtre statique DEV-only ─────────────────────────*/
/**
 * Préfixes d'URL que le serveur de DEV 404 mais que la PROD sert : le middleware
 * « fichiers statiques inexistants » de `dev-server.js` coupe `/manifest*`,
 * `/favicon*`, `/sw*` avant le SSR, là où `prod-server.js` ne filtre que par
 * extension. Une page config `/manifeste` est donc morte en dev et vivante en
 * prod. DÉRIVÉ des deux serveurs (la constante figée aurait dérivé avec eux) :
 * on lit ce qui suit le dernier `next()` avant le `res.status(404)` du bloc.
 */
function devOnly404Prefixes(): string[] {
  const prefixes = (file: string): Set<string> => {
    const p = path.join(ROOT, "server", file);
    const found = new Set<string>();
    if (!fs.existsSync(p)) return found;
    const src = fs.readFileSync(p, "utf-8");
    const stop = src.indexOf("res.status(404)");
    if (stop < 0) return found;
    const from = src.lastIndexOf("next()", stop);
    for (const m of src.slice(from < 0 ? 0 : from, stop).matchAll(/startsWith\(["']([^"']+)["']\)/g)) found.add(m[1]);
    return found;
  };
  const prod = prefixes("prod-server.js");
  return [...prefixes("dev-server.js")].filter((x) => !prod.has(x));
}
const DEV_ONLY_404 = devOnly404Prefixes();

/*───────────────────────── Port libre ─────────────────────────*/
/** Bind test + appel HTTP : un zombie peut répondre sur un port que le bind accepte. */
async function isPortUsable(port: number): Promise<boolean> {
  const bindable = await new Promise<boolean>((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port, "0.0.0.0");
  });
  if (!bindable) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 1_500);
  try {
    await fetch(`http://127.0.0.1:${port}/`, { signal: ctrl.signal });
    return false; // quelqu'un répond déjà là
  } catch {
    return true;
  } finally {
    clearTimeout(timer);
  }
}

async function pickPort(): Promise<number> {
  for (let p = startPort; p < startPort + PORT_SCAN_MAX; p++) if (await isPortUsable(p)) return p;
  usage(`aucun port libre entre ${startPort} et ${startPort + PORT_SCAN_MAX - 1}`);
}

/*───────────────────────── Serveur SSR ─────────────────────────*/
let child: ChildProcess | null = null;
const serverErrors: string[] = [];

function rememberStderr(chunk: string): void {
  for (const line of chunk.split("\n")) {
    const l = line.trim();
    if (!l) continue;
    if (!/error|erreur|failed|échec|cannot|ECONN|EADDR|undefined is not/i.test(l)) continue;
    // Bruit connu et sans effet sur le rendu : sourcemaps absentes des paquets
    // publiés, port HMR déjà pris par un `npm run dev` en parallèle.
    if (/source-?\s?map|\.map\b|ExperimentalWarning|Debugger|WebSocket server error/i.test(l)) continue;
    if (serverErrors.includes(l)) continue;
    if (serverErrors.length < 12) serverErrors.push(l.slice(0, 300));
  }
}

async function stopServer(): Promise<void> {
  const proc = child;
  child = null;
  if (!proc || proc.exitCode !== null) return;
  await new Promise<void>((resolve) => {
    const done = setTimeout(() => {
      try {
        proc.kill("SIGKILL");
      } catch {
        /* déjà mort */
      }
      resolve();
    }, KILL_GRACE_MS);
    proc.once("exit", () => {
      clearTimeout(done);
      resolve();
    });
    proc.kill("SIGTERM");
  });
}

// Ne JAMAIS laisser un serveur orphelin derrière soi (il squatterait le port et
// — pire — répondrait à la session suivante à la place du bon serveur).
// `exit` couvre le cas que les signaux ne couvrent pas : exception non
// rattrapée, `process.exit()` d'un chemin d'erreur, fin normale interrompue.
process.on("exit", () => {
  if (child && child.exitCode === null) {
    try {
      child.kill("SIGKILL");
    } catch {
      /* déjà mort */
    }
  }
});
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
  process.on(sig, () => {
    void stopServer().then(() => process.exit(sig === "SIGINT" ? 130 : 143));
  });
}

async function fetchText(url: string, timeoutMs: number): Promise<{ status: number; body: string } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const body = await res.text();
    return { status: res.status, body };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Démarre + attend un `</html>` complet (le 1er rendu Vite compile ~15 s). */
async function startServer(port: number): Promise<string> {
  const baseUrl = `http://127.0.0.1:${port}`;
  // `SITE_CONFIG_JSON` est le tier 1 de résolution du serveur : s'il traîne dans
  // l'environnement appelant, il écrase SITE_CONFIG_PATH et on testerait une
  // AUTRE config sans le savoir.
  const env = { ...process.env, PORT: String(port), SITE_CONFIG_PATH: configPath, VITE_SLUG: slug, NODE_ENV: "development" };
  delete env.SITE_CONFIG_JSON;
  child = spawn("node", ["server/dev-server.js"], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
  let exited = false;
  child.once("exit", (code) => {
    exited = true;
    if (code) rememberStderr(`le serveur s'est arrêté (code ${code})`);
  });
  child.stderr?.on("data", (d: Buffer) => rememberStderr(d.toString()));
  child.stdout?.on("data", (d: Buffer) => {
    const s = d.toString();
    if (/SSR Error|Impossible de lire|invalide/i.test(s)) rememberStderr(s);
  });

  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline && !exited) {
    const res = await fetchText(baseUrl, 30_000);
    if (res && res.body.includes("</html>")) return baseUrl;
    await sleep(1_000);
  }
  if (exited) return "";
  // Le serveur répond mais pas encore un HTML complet : quelques relances.
  for (let i = 0; i < WARMUP_ATTEMPTS; i++) {
    const res = await fetchText(baseUrl, 30_000);
    if (res && res.body.includes("</html>")) return baseUrl;
    await sleep(2_000);
  }
  return "";
}

/*───────────────────────── Analyse du HTML ─────────────────────────*/
type Verdict = "ok" | "vide" | "ko" | "erreur" | "dev-only" | "auth";
/** Verdicts qui font échouer l'outil (les autres sont des avertissements). */
const FAILING: ReadonlySet<Verdict> = new Set<Verdict>(["vide", "ko", "erreur"]);

interface RenderedSection {
  index: number;
  type: string;
  /** Toutes les frontières Suspense de la section ont résolu (`$RC`). */
  resolved: boolean;
  /** Longueur du texte visible produit, frontières descendues (0 = n'affiche rien en SSR). */
  textLength: number;
  empty: boolean;
}

interface PageReport {
  path: string;
  status: number;
  bytes: number;
  truncated: boolean;
  declared: string[];
  /** Types sortis du dénominateur : masqués en SSR par design (auth/permissions). */
  conditional: string[];
  rendered: RenderedSection[];
  missing: string[];
  /** Frontières jamais résolues → skeleton infini côté visiteur. */
  stuck: string[];
  failed: string[];
  notImplemented: string[];
  verdict: Verdict;
  notes: string[];
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const uniqTypes = (list: RenderedSection[]) => [...new Set(list.map((s) => s.type))];

/**
 * Section volontairement masquée en SSR (cf. CLAUDE.md gotcha 10) : condition
 * `auth`/`permissions`. Filet PROSPECTIF — le schéma `Section` ne porte pas
 * encore `visibility` (seuls les NavItem l'ont), aucune config n'en a ; le jour
 * où il l'aura, l'exiger au rendu serait un faux positif.
 */
function isSsrHidden(section: SectionLike): boolean {
  const candidates = [
    section.visibility,
    section.condition,
    section.visibleIf,
    section.props?.visibility,
    section.props?.condition,
  ];
  return candidates.some(
    (c) =>
      isRecord(c) &&
      ((typeof c.auth === "string" && c.auth !== "any") || (Array.isArray(c.permissions) && c.permissions.length > 0)),
  );
}

/**
 * Page derrière un garde d'accès. Le prédicat vient de `src/lib/pageAccess.ts` — le MÊME que
 * celui qui décide de ne pas sérialiser les sections (SiteRenderer), de poser `robots: noindex`
 * (Seo) et d'exclure la page du sitemap. Une copie locale a existé ici : elle est supprimée pour
 * que le gate et le moteur ne puissent pas diverger.
 */
const isAuthGuarded = (page: PageLike): boolean => isGatedPage(page as never);

/** Texte visible d'un fragment (scripts/styles retirés) — mesure « ça affiche quelque chose ». */
function visibleText(fragment: string): string {
  return fragment
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MEDIA_RE = /<(img|svg|iframe|video|canvas|input|button|picture|source)\b/i;
// Identifiants de frontière/segment React : base 32 (`B:0`…`B:9`, `B:a`, `B:10`…),
// jamais décimaux — d'où `[^"]+` plutôt qu'un `\d+` qui décroche à la 11e.
const BOUNDARY_TPL_RE = /<template id="(B:[^"]+)"/g;
const SEGMENT_OPEN_RE = /<div hidden id="(S:[^"]+)">/g;
const RC_RE = /\$RC\("(B:[^"]+)","(S:[^"]+)"\)/g;

/** Contenu différé du stream : quelle frontière a résolu, et avec quel HTML. */
interface Stream {
  boundarySegment: Map<string, string>;
  segment: Map<string, string>;
}

function indexStream(html: string): Stream {
  const boundarySegment = new Map<string, string>();
  const scriptAt = new Map<string, number>();
  for (const m of html.matchAll(RC_RE)) {
    boundarySegment.set(m[1], m[2]);
    scriptAt.set(m[2], m.index ?? 0);
  }
  const opens = [...html.matchAll(SEGMENT_OPEN_RE)];
  const segment = new Map<string, string>();
  opens.forEach((m, i) => {
    const from = (m.index ?? 0) + m[0].length;
    // Fin = le plus proche entre le `$RC` du segment et l'ouverture du suivant
    // (React peut grouper plusieurs segments avant leurs scripts).
    const to = Math.min(opens[i + 1]?.index ?? html.length, scriptAt.get(m[1]) ?? html.length);
    segment.set(m[1], html.slice(from, Math.max(from, to)));
  });
  return { boundarySegment, segment };
}

interface Collected {
  text: string;
  media: boolean;
  stuck: string[];
}

/**
 * Contenu réel d'une section : le fragment du shell PLUS le contenu différé de
 * chaque frontière qu'il contient, récursivement. Sans cette descente, un
 * conteneur (`gridLayout`, `cagnotte-layout`) ne « contient » que les skeletons
 * de ses enfants — texte vide — et une page qui n'a que lui passe pour blanche.
 */
function collect(fragment: string, stream: Stream, seen: Set<string>, depth = 0): Collected {
  let text = visibleText(fragment);
  let media = MEDIA_RE.test(fragment);
  const stuck: string[] = [];
  if (depth < 12) {
    for (const m of fragment.matchAll(BOUNDARY_TPL_RE)) {
      const segId = stream.boundarySegment.get(m[1]);
      if (!segId) {
        stuck.push(m[1]);
        continue;
      }
      if (seen.has(segId)) continue;
      seen.add(segId);
      const inner = collect(stream.segment.get(segId) ?? "", stream, seen, depth + 1);
      if (inner.text) text += (text ? " " : "") + inner.text;
      media ||= inner.media;
      stuck.push(...inner.stuck);
    }
  }
  return { text, media, stuck };
}

function analysePage(page: PageLike, status: number, html: string): PageReport {
  const sections = page.sections ?? [];
  const declared = sections.map((s) => s.type);
  const conditional = sections.filter(isSsrHidden).map((s) => s.type);
  const notes: string[] = [];
  const rendered: RenderedSection[] = [];
  const missing: string[] = [];
  const stuck = new Set<string>();

  const truncated = !html.includes("</html>");
  const mainOpen = /<main\b[^>]*id="main"[^>]*>/.exec(html);
  if (!mainOpen && status === 200) {
    notes.push('aucun <main id="main"> dans la réponse — le rendu SSR n\'a pas eu lieu');
  }
  if (mainOpen) {
    const from = mainOpen.index + mainOpen[0].length;
    const to = html.indexOf("</main>", from);
    const main = html.slice(from, to === -1 ? html.length : to);
    const stream = indexStream(html);

    const wrappers = [...main.matchAll(/<div ([^>]*\bdata-section-type="[^"]*"[^>]*)>/g)].map((m) => {
      const attrs = m[1];
      const idx = /data-section-index="(\d+)"/.exec(attrs);
      return {
        start: m.index ?? 0,
        openEnd: (m.index ?? 0) + m[0].length,
        type: /data-section-type="([^"]*)"/.exec(attrs)?.[1] ?? "",
        index: idx ? Number(idx[1]) : undefined,
      };
    });

    // Appariement STRICT (rang, type) dans l'ordre du document : `SiteRenderer`
    // rend `index={i}` pour la i-ème section déclarée. Un conteneur imbriquant
    // ses propres sections indexées (cagnotte-layout repart à 0) ne peut donc
    // plus être pris pour une section de page.
    let cursor = 0;
    const slots = declared.map((type, i) => {
      for (let k = cursor; k < wrappers.length; k++) {
        if (wrappers[k].index === i && wrappers[k].type === type) {
          cursor = k + 1;
          return wrappers[k];
        }
      }
      return undefined;
    });

    for (const [i, slot] of slots.entries()) {
      if (!slot) {
        missing.push(declared[i]);
        continue;
      }
      const nextStart = slots.slice(i + 1).find((s) => s !== undefined)?.start ?? main.length;
      const found = collect(main.slice(slot.openEnd, nextStart), stream, new Set());
      for (const b of found.stuck) stuck.add(b);
      rendered.push({
        index: i,
        type: slot.type,
        resolved: found.stuck.length === 0,
        textLength: found.text.length,
        empty: found.stuck.length === 0 && found.text.length === 0 && !found.media,
      });
    }
  } else {
    missing.push(...declared);
  }

  // React SSR échappe les guillemets (`&quot;`) et insère un séparateur
  // `<!-- -->` entre texte statique et expression : chercher la chaîne JSX
  // telle qu'écrite dans SectionRenderer ne matcherait JAMAIS le HTML réel.
  const uniq = (v: string[]) => [...new Set(v)];
  const failed = uniq([...html.matchAll(/Failed to load section:\s*(?:<!-- -->)?([\w-]+)/g)].map((m) => m[1]));
  const notImplemented = uniq(
    [
      ...html.matchAll(
        /Section type (?:&quot;|&#34;|")(?:<!-- -->)?([^<&"]+)(?:<!-- -->)?(?:&quot;|&#34;|") not implemented yet/g,
      ),
    ].map((m) => m[1]),
  );

  const countable = declared.length - conditional.length;
  const withContent = rendered.filter((r) => r.resolved && !r.empty).length;
  const emptyOnes = rendered.filter((r) => r.empty);
  if (emptyOnes.length)
    notes.push(
      `rendues mais SANS contenu SSR : ${uniq(emptyOnes.map((r) => r.type)).join(", ")} (client-only ou props vides ?)`,
    );
  if (conditional.length) notes.push(`hors dénominateur (auth/permissions, masquées en SSR) : ${conditional.join(", ")}`);

  let verdict: Verdict = "ok";
  if (status !== 200 || truncated || !mainOpen) verdict = "erreur";
  else if (declared.length === 0) verdict = "vide";
  else if (missing.length || stuck.size || failed.length || notImplemented.length) verdict = "ko";
  else if (countable > 0 && withContent === 0) verdict = "ko";

  // Deux requalifications en AVERTISSEMENT — voir l'en-tête : ce sont des
  // angles morts de la méthode, pas des défauts de la config.
  const devPrefix = DEV_ONLY_404.find((p) => urlPath(page.path).startsWith(p));
  if (status === 404 && devPrefix) {
    verdict = "dev-only";
    notes.push(
      `404 du filtre statique DEV-only (« ${devPrefix}* » dans server/dev-server.js) — le serveur de prod, lui, ne filtre que par extension : la page vit en prod, mais reste morte sous \`npm run dev\``,
    );
  } else if (verdict === "ko" && !stuck.size && !failed.length && !notImplemented.length && isAuthGuarded(page)) {
    verdict = "auth";
    // Les sections d'une page gardée ne sont plus sérialisées au SSR (SiteRenderer + isGatedPage) :
    // leur absence est le comportement ATTENDU, pas un défaut de la config. La condition portait
    // auparavant `!missing.length`, écrite à l'époque où une page gardée rendait quand même tout —
    // depuis, `missing` vaut systématiquement l'intégralité des sections déclarées.
    notes.push(
      missing.length
        ? `page gardée : ses ${missing.length} section(s) sont délibérément retenues au SSR (contenu jamais servi à un anonyme)`
        : "page derrière un garde d'auth : rendue ici en anonyme, son vide n'est pas concluant",
    );
  }

  return {
    path: page.path,
    status,
    bytes: Buffer.byteLength(html),
    truncated,
    declared,
    conditional,
    rendered,
    missing,
    stuck: [...stuck],
    failed,
    notImplemented,
    verdict,
    notes,
  };
}

/*───────────────────────── Exécution ─────────────────────────*/
const t0 = Date.now();
let exitCode = 0;

try {
  const port = await pickPort();
  log(`▶  ${configLabel} · port ${port} · slug « ${slug} » (${slugOrigin})`);
  log(`   démarrage du serveur SSR (première compilation Vite ~15 s)…`);

  const baseUrl = await startServer(port);
  const startupMs = Date.now() - t0;
  if (!baseUrl)
    throw new Fatal(2, [
      `✗ le serveur SSR n'a pas démarré (${(startupMs / 1000).toFixed(1)} s)`,
      ...serverErrors.map((e) => `   ${e}`),
    ]);
  log(`   serveur chaud en ${(startupMs / 1000).toFixed(1)} s`);

  // Garde-fou anti-zombie : le HTML servi doit porter NOTRE config.
  const probe = await fetchText(`${baseUrl}${urlPath(pages[0].path)}`, REQUEST_TIMEOUT_MS);
  const cfgMatch = probe ? /window\.__CONFIG__=([\s\S]*?)<\/script>/.exec(probe.body) : null;
  let served: ConfigLike | null = null;
  if (cfgMatch) {
    try {
      served = JSON.parse(cfgMatch[1]) as ConfigLike;
    } catch {
      log("   (window.__CONFIG__ illisible — contrôle d'identité du serveur ignoré)");
    }
  }
  if (served) {
    const paths = (c: ConfigLike) => (c.pages ?? []).map((p) => p.path).join("|");
    if (paths(served) !== paths(config))
      throw new Fatal(2, [
        `✗ le serveur qui répond sur ${baseUrl} sert une AUTRE config`,
        `   servi   : « ${Object.values(served.meta?.title ?? {})[0] ?? "?"} » · ${(served.pages ?? []).length} page(s)`,
        `   attendu : « ${Object.values(config.meta?.title ?? {})[0] ?? "?"} » · ${pages.length} page(s)`,
        `   → un serveur d'une autre session écoute ce port : relancer avec --port <autre>`,
      ]);
  }

  const reports: PageReport[] = [];
  for (const [i, page] of pages.entries()) {
    // La 1re page a déjà été requêtée par le garde-fou d'identité : on réutilise.
    const res = i === 0 && probe ? probe : await fetchText(`${baseUrl}${urlPath(page.path)}`, REQUEST_TIMEOUT_MS);
    if (!res) {
      reports.push({
        path: page.path,
        status: 0,
        bytes: 0,
        truncated: true,
        declared: (page.sections ?? []).map((s) => s.type),
        conditional: [],
        rendered: [],
        missing: (page.sections ?? []).map((s) => s.type),
        stuck: [],
        failed: [],
        notImplemented: [],
        verdict: "erreur",
        notes: ["pas de réponse (timeout ou connexion coupée)"],
      });
      continue;
    }
    reports.push(analysePage(page, res.status, res.body));
  }

  const totalMs = Date.now() - t0;
  const ko = reports.filter((r) => FAILING.has(r.verdict));
  const warn = reports.filter((r) => r.verdict !== "ok" && !FAILING.has(r.verdict));
  exitCode = ko.length ? 1 : 0;

  if (JSON_OUT) {
    out(
      JSON.stringify(
        {
          config: configLabel,
          slug,
          port,
          durationMs: totalMs,
          startupMs,
          ok: exitCode === 0,
          serverErrors,
          pages: reports,
          summary: {
            pages: reports.length,
            pagesOk: reports.length - ko.length - warn.length,
            pagesWarn: warn.length,
            pagesKo: ko.length,
            declaredSections: reports.reduce((n, r) => n + r.declared.length, 0),
            renderedWithContent: reports.reduce((n, r) => n + r.rendered.filter((s) => s.resolved && !s.empty).length, 0),
            conditionalSections: reports.reduce((n, r) => n + r.conditional.length, 0),
          },
        },
        null,
        2,
      ),
    );
  } else {
    const icon: Record<Verdict, string> = {
      ok: "✅",
      vide: "❌",
      ko: "❌",
      erreur: "❌",
      "dev-only": "⚠️ ",
      auth: "⚠️ ",
    };
    const label = (r: PageReport) => {
      if (r.verdict === "dev-only") return `HTTP 404 en dev seulement`;
      if (r.verdict === "auth") return "page protégée — non concluant en anonyme";
      if (r.verdict === "erreur") return r.status === 200 ? "réponse TRONQUÉE" : `HTTP ${r.status}`;
      if (r.verdict === "vide") return "page VIDE — aucune section déclarée";
      const bits: string[] = [];
      if (r.missing.length) bits.push(`absentes du rendu : ${r.missing.join(", ")}`);
      if (r.stuck.length)
        bits.push(
          `jamais résolues (skeleton infini) : ${uniqTypes(r.rendered.filter((s) => !s.resolved)).join(", ")}` +
            ` (${r.stuck.length} frontière(s))`,
        );
      if (r.failed.length) bits.push(`Failed to load section : ${r.failed.join(", ")}`);
      if (r.notImplemented.length) bits.push(`type inconnu du renderer : ${r.notImplemented.join(", ")}`);
      if (r.verdict === "ko" && bits.length === 0) bits.push("aucune section avec du contenu — page blanche");
      return bits.join(" · ");
    };

    out("\n🖥️   Rendu SSR réel\n" + "═".repeat(72));
    out(`config : ${configLabel}   slug : ${slug} (${slugOrigin})   port : ${port}`);
    out("─".repeat(72));
    for (const r of reports) {
      const withContent = r.rendered.filter((s) => s.resolved && !s.empty).length;
      const denom = r.declared.length - r.conditional.length;
      const ratio = `${withContent}/${denom}`;
      out(
        `  ${icon[r.verdict]} ${r.path.padEnd(24)} ${String(r.status).padStart(3)}  ${(r.bytes / 1024).toFixed(1).padStart(7)} Ko  ` +
          `sections ${ratio.padEnd(7)} ${label(r)}`,
      );
      for (const n of r.notes) out(`        ↳ ${n}`);
    }

    out("─".repeat(72));
    const declaredTotal = reports.reduce((n, r) => n + r.declared.length, 0);
    const contentTotal = reports.reduce((n, r) => n + r.rendered.filter((s) => s.resolved && !s.empty).length, 0);
    const condTotal = reports.reduce((n, r) => n + r.conditional.length, 0);
    out(
      `${reports.length} page(s) · ${reports.length - ko.length - warn.length} OK · ${warn.length} avertissement(s) · ${ko.length} en échec · ` +
        `${contentTotal}/${declaredTotal} sections avec du contenu SSR` +
        (condTotal ? ` (${condTotal} conditionnelle(s) hors dénominateur)` : ""),
    );
    out(`durée : ${(totalMs / 1000).toFixed(1)} s (dont ${(startupMs / 1000).toFixed(1)} s de démarrage)`);
    if (serverErrors.length) {
      out("\nerreurs remontées par le serveur :");
      for (const e of serverErrors) out(`   ${e}`);
    }
    out(
      exitCode === 0
        ? "\n✅  la config REND : chaque page sert au moins une section avec du contenu.\n"
        : "\n❌  au moins une page ne rend pas ce que la config déclare.\n",
    );
  }
} catch (e) {
  if (e instanceof Fatal) {
    for (const l of e.lines) err(l);
    exitCode = e.code;
  } else {
    err(`✗ échec inattendu : ${(e as Error).message}`);
    for (const s of serverErrors) err(`   ${s}`);
    exitCode = 2;
  }
} finally {
  await stopServer();
}

process.exit(exitCode);
