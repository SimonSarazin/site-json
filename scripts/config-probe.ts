/**
 * Sonde RÉSEAU des périmètres de données déclarés dans une config de site.
 *
 * POURQUOI : `config:validate` (Zod) et `audit:config` sont STATIQUES. Ils
 * voient qu'un `baseParams` EXISTE — jamais ce qu'il VAUT. Une coquille dans un
 * `sourceKey`, un `defaultFilters` qui ne matche aucun document, un
 * `defaultTypes` oublié : la config reste parfaitement valide, l'audit reste
 * vert, et la page de recherche sort VIDE en production sans le moindre signal.
 * Cet outil est le seul qui pose la question au backend, et le seul qui
 * distingue « périmètre faux » (0 résultat) de « backend en rade » (erreur) —
 * confondre les deux, c'est corriger une config qui n'avait rien.
 *
 * FIDÉLITÉ : aucun payload n'est réécrit ici. Ils sont construits par les MÊMES
 * fonctions que l'application (`buildSearchPayload`, `canonicalSearchProStaticBaseParams`,
 * `buildAgendaListParams`, `buildObservatoryBaseParams`, `fetchFilterEntities`),
 * appelés sur la MÊME entité costum (résolue par slug, comme `initApi`). Une
 * sonde qui n'appelle pas comme l'app ne prouve rien : elle déplacerait
 * seulement le doute.
 *
 * LE SLUG EST LA MOITIÉ DU RÉSULTAT : un `baseParams` sans `sourceKey` est
 * auto-scopé par le SDK au costum COURANT (`_withCostumContext`). Sondé sous un
 * autre costum, le même config passe de « 3 OK » à « 1 VIDE ». La provenance du
 * slug est donc AFFICHÉE et avertie dès qu'elle est incertaine (config absent de
 * `sites.json` → repli VITE_SLUG ; ou plusieurs slugs partageant le config) :
 * un verdict sûr de lui sur le mauvais costum est pire que pas de verdict.
 *
 * Usage :
 *   npx tsx scripts/config-probe.ts <config.json> [--json] [--slug <slug>]
 *
 *   <config.json>  chemin ABSOLU, ou relatif à la racine du repo (même
 *                  comportement que `audit-config.ts --file`).
 *   --slug         force le costum interrogé ; sinon déduit du `sites.json`
 *                  (par nom de fichier, brouillons hors repo compris), sinon
 *                  VITE_SLUG (env ou .env).
 *
 * Sorties / codes :
 *   0  tous les périmètres renvoient au moins un résultat
 *   1  au moins un périmètre est VIDE (le défaut cherché)
 *   2  erreur d'usage, config illisible, backend injoignable, ou périmètre en
 *      erreur backend (une erreur ne vaut PAS un périmètre vide : rien n'est
 *      prouvé). JAMAIS 1 pour un défaut d'outil : l'appelant doit pouvoir lire
 *      « 1 » comme « la config est en cause », sans ambiguïté.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Cocolight from "@communecter/cocolight-api-client";
import { buildSearchPayload, type SearchBaseParamsInput } from "../src/modules/search/lib/buildSearchPayload";
import { canonicalSearchProStaticBaseParams } from "../src/modules/search/lib/canonicalBaseParams";
import { agendaListIndexStep, buildAgendaListParams, type AgendaBaseParams } from "../src/modules/agenda/lib/buildAgendaParams";
import { buildObservatoryBaseParams } from "../src/modules/observatoire/hooks/useObservatoryItemsQuery";
import { fetchFilterEntities } from "../src/modules/search/hooks/useFilterEntities";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ─── Arguments ────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const JSON_OUT = argv.includes("--json");
const slugArgIdx = argv.indexOf("--slug");
const SLUG_ARG = slugArgIdx >= 0 ? argv[slugArgIdx + 1] : undefined;
const CONFIG_ARG = argv.filter((a, i) => !a.startsWith("--") && !(slugArgIdx >= 0 && i === slugArgIdx + 1))[0];

/** Sortie fatale : en `--json` on reste PARSABLE (l'assistant lit stdout). */
function fatal(message: string, hint?: string): never {
  if (JSON_OUT) console.log(JSON.stringify({ error: message, hint: hint ?? null }, null, 2));
  else {
    console.error(`✗ ${message}`);
    if (hint) console.error(`  ${hint}`);
  }
  process.exit(2);
}

if (!CONFIG_ARG) {
  fatal(
    "usage : config-probe.ts <config.json> [--json] [--slug <slug>]",
    `chemin absolu, ou relatif à ${ROOT}`,
  );
}
// `--slug --json` : sans ce garde-fou, le drapeau suivant devient le slug et on
// part interroger un costum nommé « --json » (échec tardif, message trompeur).
if (SLUG_ARG !== undefined && SLUG_ARG.startsWith("--"))
  fatal(`--slug attend un slug, pas « ${SLUG_ARG} »`, "usage : --slug <slug>");
/** Absolu tel quel, relatif résolu depuis la racine du repo (cf. audit-config.ts). */
const CONFIG_PATH = path.isAbsolute(CONFIG_ARG) ? CONFIG_ARG : path.join(ROOT, CONFIG_ARG);
if (!fs.existsSync(CONFIG_PATH)) fatal(`introuvable : ${CONFIG_PATH}`, `(chemin absolu, ou relatif à ${ROOT})`);

/**
 * Lecture JSON qui ÉCHOUE EN 2, jamais en 1 : un config mal formé remonterait
 * sinon en exception non rattrapée (exit 1 = « un périmètre est vide » dans ce
 * contrat), et l'appelant conclurait à un défaut de périmètre sur un fichier
 * que personne n'a même pu parser.
 */
function readJson(file: string, label: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (e) {
    fatal(`${label} illisible (${file}) : ${(e as Error).message}`, "JSON invalide — rien n'a été sondé");
  }
}

// ─── Backend & costum ─────────────────────────────────────────────────────
function readDotEnv(key: string): string | undefined {
  const p = path.join(ROOT, ".env");
  if (!fs.existsSync(p)) return undefined;
  for (const line of fs.readFileSync(p, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1] === key) return m[2].replace(/^["']|["']$/g, "");
  }
  return undefined;
}

const baseURL =
  process.env.VITE_BASE_URL_BACKEND ?? readDotEnv("VITE_BASE_URL_BACKEND") ?? "http://localhost:3000";

/** D'où vient le costum interrogé — déterminant pour la confiance à accorder au verdict. */
type SlugSource = "--slug" | "sites.json" | "VITE_SLUG";
interface SlugResolution {
  slug: string;
  source: SlugSource;
  /** Autres slugs de `sites.json` pointant le MÊME config (non sondés). */
  siblings: string[];
}

/**
 * Le slug ne vit PAS dans la config : c'est `sites.json` (ou VITE_SLUG) qui le
 * porte. On matche par NOM DE FICHIER pour qu'un brouillon copié hors repo
 * (ex. /tmp) reste rattaché à son costum.
 *
 * Les deux replis sont INCERTAINS et doivent le dire (cf. `warnings`) :
 *  - config absent de `sites.json` → on hérite du VITE_SLUG du `.env` LOCAL,
 *    c'est-à-dire du costum d'un site sans rapport ;
 *  - plusieurs slugs partagent un config (les 6 communes de
 *    commune-transparente) → un seul est sondé, les autres ne sont pas couverts.
 */
function resolveSlug(): SlugResolution | undefined {
  const sitesPath = path.join(ROOT, "sites.json");
  const base = path.basename(CONFIG_PATH);
  let siblings: string[] = [];
  if (fs.existsSync(sitesPath)) {
    const sites = readJson(sitesPath, "sites.json") as { slug: string; config: string }[];
    siblings = sites.filter((s) => path.basename(s.config) === base).map((s) => s.slug);
  }
  if (SLUG_ARG) return { slug: SLUG_ARG, source: "--slug", siblings: siblings.filter((s) => s !== SLUG_ARG) };
  if (siblings.length > 0) return { slug: siblings[0], source: "sites.json", siblings: siblings.slice(1) };
  const envSlug = process.env.VITE_SLUG ?? readDotEnv("VITE_SLUG");
  return envSlug ? { slug: envSlug, source: "VITE_SLUG", siblings: [] } : undefined;
}

const resolution = resolveSlug();
if (!resolution)
  fatal(
    `aucun slug de costum pour ${path.basename(CONFIG_PATH)}`,
    "→ passer --slug <slug>, ou enregistrer le config dans sites.json",
  );
const slug = resolution.slug;

/** Avertissements NON bloquants qui qualifient le verdict (jamais l'exit code). */
const warnings: string[] = [];
if (resolution.source === "VITE_SLUG")
  warnings.push(
    `${path.basename(CONFIG_PATH)} n'est pas dans sites.json : le costum « ${slug} » vient de VITE_SLUG (env/.env) ` +
      `et n'a probablement RIEN à voir avec ce config. Un baseParams sans sourceKey est auto-scopé à CE costum ` +
      `→ les comptes ci-dessous ne prouvent rien sur le site visé. Rejouer avec --slug <le vrai slug>.`,
  );
if (resolution.siblings.length > 0)
  warnings.push(
    `${resolution.siblings.length + 1} slugs partagent ce config (${[slug, ...resolution.siblings].join(", ")}) — ` +
      `seul « ${slug} » est sondé. Les autres costums ont leurs propres données : rejouer avec --slug pour chacun.`,
  );

// ─── Collecte des périmètres ──────────────────────────────────────────────
/** Un `baseParams` de la config + son contexte (nœud porteur, type de section). */
interface Perimeter {
  /** Chemin JSON pointant le `baseParams` (ex. pages.7.sections.1.props.baseParams). */
  path: string;
  /** Type déclaré le plus proche en remontant : section (`searchProStatic`…) ou groupe de filtre (`entityList`). */
  ownerType: string;
  /** Nœud qui PORTE `baseParams` (les `props` d'une section) — y lire `dimensions`, `searchVariant`, `filterBy`. */
  owner: Record<string, unknown>;
  baseParams: Record<string, unknown>;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

/**
 * Collecte GÉNÉRIQUE : tout nœud portant un `baseParams` objet, quel que soit son
 * type. Une liste blanche de types de sections raterait le prochain module —
 * et rate déjà les `filterGroups[].baseParams` (dropdown de filtre alimenté par
 * une recherche, donc un périmètre à part entière).
 */
function collect(node: unknown, at: (string | number)[], lastType: string, out: Perimeter[]): void {
  if (Array.isArray(node)) {
    node.forEach((v, i) => collect(v, [...at, i], lastType, out));
    return;
  }
  if (!isRecord(node)) return;
  // Le `type` du nœud COURANT prime : un groupe `entityList` porte lui-même son type.
  const ownerType = typeof node.type === "string" ? node.type : lastType;
  if (isRecord(node.baseParams))
    out.push({ path: [...at, "baseParams"].join("."), ownerType, owner: node, baseParams: node.baseParams });
  for (const [k, v] of Object.entries(node)) {
    if (k === "baseParams") continue; // pas de sous-périmètre dans un périmètre
    collect(v, [...at, k], ownerType, out);
  }
}

const rawConfig = readJson(CONFIG_PATH, "config");
const collected: Perimeter[] = [];
collect(rawConfig, [], "(racine)", collected);

/**
 * `baseParams` que l'APPLICATION ne lit JAMAIS → à écarter, pas à sonder.
 * `FiltersSection` (et le prefetch SSR) ne consomment le `baseParams` d'un
 * groupe de filtre QUE pour `type: "entityList"` ; ailleurs c'est du config
 * mort (relevé par `audit:config`, pas par une sonde réseau). Le sonder
 * reviendrait à crier au loup sur un périmètre que personne n'interroge — et un
 * outil qui crie au loup n'est plus lu.
 */
function unreadReason(p: Perimeter): string | undefined {
  if (p.path.includes(".filterGroups.") && p.ownerType !== "entityList")
    return `groupe de filtre sans type: "entityList" — l'app ne lit ce baseParams que pour ce type (config mort)`;
  return undefined;
}

const ignored = collected
  .map((p) => ({ path: p.path, type: p.ownerType, reason: unreadReason(p) }))
  .filter((x): x is { path: string; type: string; reason: string } => x.reason !== undefined);
const perimeters = collected.filter((p) => !unreadReason(p));

// Rien à sonder : on ne touche PAS au réseau (un site vitrine sans recherche
// n'a pas à échouer parce que son slug est absent du backend interrogé).
if (perimeters.length === 0) {
  if (JSON_OUT)
    // `entity: null` et non absent : la forme de sortie reste la MÊME dans les
    // deux branches (l'appelant lit un champ, pas une exception de clé).
    console.log(JSON.stringify({ config: CONFIG_PATH, backend: baseURL, slug, slugSource: resolution.source, slugSiblings: resolution.siblings, warnings, entity: null, perimeters: [], ignored, summary: { total: 0, ok: 0, empty: 0, error: 0 } }, null, 2));
  else {
    console.log(`\n🛰️   Sonde des périmètres — ${path.basename(CONFIG_PATH)}\n     aucun baseParams sondable dans ce config — rien à sonder`);
    for (const i of ignored) console.log(`     (ignoré) ${i.path} — ${i.reason}`);
    console.log("");
  }
  process.exit(0);
}

// ─── Client anonyme + entité costum ───────────────────────────────────────
/**
 * Interface minimale de l'entité costum (duck-typing, comme `useFilterEntities`) :
 * la recherche du site part TOUJOURS de l'entité résolue par slug, jamais d'un
 * endpoint nu — c'est elle qui porte le scope costum (`_withCostumContext`).
 */
interface ProbeEntity {
  searchCostum(payload: Record<string, unknown>, opts?: { variant: string }): Promise<ProbePage>;
  searchEventsCostum(payload: Record<string, unknown>): Promise<ProbePage>;
  serverData?: Record<string, unknown>;
  getEntityType?: () => string;
}
interface ProbePage {
  results?: unknown[];
  count?: { total?: number };
}

const tokenStorageStrategy =
  await Cocolight.tokenStorageStrategy.createDefaultMultiServerTokenStorageStrategy("memory");
const client = new Cocolight.ApiClient({ baseURL, tokenStorageStrategy });
// Le SDK loggue (pino + transport pino-pretty) sur STDOUT — ce qui rendrait
// `--json` INPARSABLE, et noierait le rapport humain sous les retries. Le
// transport tourne dans un worker (fd 1 direct) : impossible d'intercepter
// `process.stdout.write`. On coupe donc le logger à la source ; le rapport de
// la sonde reste la seule sortie, et les erreurs sont rapportées par `detail`.
const sdkLogger = (client as unknown as { _logger?: { level: string } })._logger;
if (sdkLogger) sdkLogger.level = "silent";
const api = new Cocolight.Api(null, client);

let entity: ProbeEntity;
try {
  const resolved = await api.entitySlug(slug);
  if (!resolved) throw new Error("entité non résolue");
  entity = resolved as unknown as ProbeEntity;
} catch (e) {
  fatal(
    `costum « ${slug} » non résolu sur ${baseURL} : ${(e as Error).message}`,
    "backend injoignable, ou slug absent de CE backend (--slug pour en viser un autre) — AUCUN périmètre n'a pu être testé",
  );
}

const entityServerData = entity.serverData ?? {};
const entityName = typeof entityServerData.name === "string" ? entityServerData.name : "?";
const entityKind = entity.getEntityType?.() ?? "?";

// ─── Construction des appels (mêmes fonctions que l'app) ──────────────────
type Method = "searchCostum" | "searchEventsCostum" | "searchCostum (filtre entityList)";

interface Probe {
  perimeter: Perimeter;
  method: Method;
  /** Résumé du scope affiché quand le périmètre sort vide (là où chercher la coquille). */
  scope: Record<string, unknown>;
  run: () => Promise<number>;
  /** Renseigné quand l'app elle-même ne lancerait AUCUN appel (0 garanti, sans réseau). */
  noCall?: string;
}

/** Champs qui décident du périmètre — le reste (projection, tri, pagination) ne filtre rien. */
function scopeOf(bp: Record<string, unknown>): Record<string, unknown> {
  const keys = ["sourceKey", "notSourceKey", "defaultTypes", "defaultFilters", "filters", "locality", "costumSlug", "contextId", "contextType"];
  const out: Record<string, unknown> = {};
  for (const k of keys) if (bp[k] !== undefined) out[k] = bp[k];
  return out;
}

/**
 * Message d'erreur EXPLOITABLE : `ApiValidationError` porte le détail dans
 * `messages` (le `message` seul dit « Request validation failed » et n'aide en
 * rien). Une valeur refusée par le schéma du SDK — un `defaultTypes` inconnu,
 * typiquement — casse la recherche de la MÊME façon dans l'app : le détail est
 * la moitié du diagnostic.
 */
function describeError(e: unknown): string {
  const err = e as { message?: string; messages?: unknown; validationErrors?: unknown };
  const extra = err.messages ?? err.validationErrors;
  const detail = extra === undefined ? "" : ` — ${JSON.stringify(extra).slice(0, 300)}`;
  return `${err.message ?? String(e)}${detail}`;
}

/** `count.total` quand le backend le renvoie, sinon la taille de la page reçue. */
const countOf = (page: ProbePage): number =>
  typeof page.count?.total === "number" ? page.count.total : (page.results?.length ?? 0);

function planProbe(p: Perimeter): Probe {
  const bp = p.baseParams;

  // agenda → searchEventsCostum. Mode LISTE volontairement (pas la fenêtre
  // calendrier de l'onglet « À venir ») : un agenda peut légitimement n'avoir
  // aucun event à venir alors que son périmètre est juste. On sonde le
  // PÉRIMÈTRE, pas la fenêtre temporelle.
  if (p.ownerType === "agenda") {
    const agendaBp = bp as AgendaBaseParams;
    const payload = buildAgendaListParams(agendaListIndexStep(agendaBp), {}, agendaBp);
    return {
      perimeter: p,
      method: "searchEventsCostum",
      scope: scopeOf(bp),
      run: async () => countOf(await entity.searchEventsCostum(payload)),
    };
  }

  // filterGroups[].baseParams (`entityList`) → alimente un dropdown de filtre
  // via `fetchFilterEntities` : vide = filtre vide, donc périmètre à sonder.
  if (p.ownerType === "entityList") {
    const filterBy = typeof p.owner.filterBy === "string" ? p.owner.filterBy : "slug";
    // `useFilterEntitiesQuery` est `enabled: !!options.defaultTypes?.length` :
    // sans types, l'app ne requête PAS et le filtre reste vide. Appeler quand
    // même donnerait un « OK » sur un dropdown vide en production.
    const hasTypes = Array.isArray(bp.defaultTypes) && bp.defaultTypes.length > 0;
    return {
      perimeter: p,
      method: "searchCostum (filtre entityList)",
      scope: scopeOf(bp),
      noCall: hasTypes ? undefined : "groupe entityList sans defaultTypes — la query est désactivée (enabled), le filtre reste vide",
      run: async () => {
        const options = await fetchFilterEntities(
          entity as unknown as Parameters<typeof fetchFilterEntities>[0],
          bp as unknown as Parameters<typeof fetchFilterEntities>[1],
          filterBy,
        );
        return options.length;
      },
    };
  }

  // Sections de recherche → searchCostum. Chaque famille normalise ses
  // baseParams AVANT `buildSearchPayload`, exactement comme son composant.
  let normalized: Record<string, unknown>;
  // Gardes des composants qui DÉSACTIVENT la requête : les reproduire est tout
  // l'intérêt de la sonde — ce sont des vides que le backend ne dira jamais.
  //  - SearchPro : `useFilter: false` → searchType null → aucun appel (SearchPro.tsx:100) ;
  //  - DataObservatory : sans `defaultFilters`, pas de périmètre → query désactivée.
  let disabled: string | undefined;
  if (p.ownerType === "searchPro" && p.owner.useFilter === false)
    disabled = "searchPro avec useFilter: false — searchType null, l'app ne lance jamais la requête";
  if (p.ownerType === "data-observatory" && !isRecord(bp.defaultFilters))
    disabled = "observatoire sans baseParams.defaultFilters — périmètre absent, le dashboard ne charge rien";
  if (p.ownerType === "data-observatory") {
    // Le dashboard dérive sa projection des `dimensions` et force indexStepList: 500.
    normalized = { ...buildObservatoryBaseParams(
      bp as unknown as Parameters<typeof buildObservatoryBaseParams>[0],
      (p.owner.dimensions ?? {}) as Parameters<typeof buildObservatoryBaseParams>[1],
    ) };
  } else if (p.ownerType === "cardCountCT") {
    // CardCountCTSection élargit le filtre avec le `$or` localité/slug de l'ENTITÉ.
    const or: Record<string, unknown> = { ...((bp.defaultFilters as Record<string, unknown>)?.$or as Record<string, unknown> ?? {}) };
    const localityId = (entityServerData.address as Record<string, unknown> | undefined)?.localityId;
    const entitySlug = entityServerData.slug;
    if (typeof localityId === "string") or["address.localityId"] = localityId;
    if (typeof entitySlug === "string") {
      or["source.key"] = entitySlug;
      or["source.keys"] = entitySlug;
    }
    normalized = { ...bp, indexStepList: 10, defaultFilters: { ...(bp.defaultFilters as Record<string, unknown> ?? {}), $or: or } };
  } else {
    // searchPro / searchProStatic / hero-search : forme canonique (filtres et
    // locality dynamiques VIDES — la sonde n'a ni URL ni contexte de page).
    normalized = canonicalSearchProStaticBaseParams(bp);
  }

  // Le variant SDK ne vit pas au même endroit selon la famille : `props.searchVariant`
  // pour les sections search/hero, `baseParams.variant` pour l'observatoire
  // (useObservatoryItemsQuery lit `baseParamsProp.variant`). L'ignorer ferait
  // appeler un AUTRE endpoint que l'app — tiers-lieux tourne en `navigator-tl`.
  const variant =
    typeof p.owner.searchVariant === "string"
      ? p.owner.searchVariant
      : typeof bp.variant === "string"
        ? bp.variant
        : undefined;
  const types = Array.isArray(normalized.defaultTypes) ? (normalized.defaultTypes as string[]) : undefined;
  const payload = buildSearchPayload(normalized as unknown as SearchBaseParamsInput, {
    name: "",
    tags: [],
    type: types,
    mapUsed: false,
    variant,
  });

  return {
    perimeter: p,
    method: "searchCostum",
    scope: scopeOf(normalized),
    // Sans `searchType`, `useSearchQuery` court-circuite : l'app ne fait AUCUN
    // appel et affiche 0. Le rapporter tel quel évite un appel réseau qui
    // mentirait (le backend, lui, répondrait quelque chose).
    // Le hero est le SEUL à ne pas avoir cette garde : `useAutocomplete` appelle
    // quand même, et le SDK lève sur un payload sans `searchType` — vide aussi,
    // mais pour une autre raison. Dire « l'app ne requête pas » y serait faux.
    noCall:
      disabled ??
      (payload.searchType
        ? undefined
        : p.ownerType === "hero-search"
          ? "aucun defaultTypes — l'autocomplete appelle sans searchType, le SDK lève : aucune suggestion"
          : "aucun defaultTypes — l'app ne lance jamais la requête"),
    run: async () =>
      countOf(
        variant && variant !== "default"
          ? await entity.searchCostum(payload as Record<string, unknown>, { variant })
          : await entity.searchCostum(payload as Record<string, unknown>),
      ),
  };
}

// ─── Exécution (concurrence bornée) ───────────────────────────────────────
type Status = "ok" | "vide" | "erreur";
interface Result {
  path: string;
  type: string;
  method: Method;
  status: Status;
  count: number | null;
  scope: Record<string, unknown>;
  detail?: string;
}

/** 4 en vol : assez pour ne pas sérialiser 20 appels de ~150 ms, assez peu pour ne pas marteler. */
const CONCURRENCY = 4;

async function runAll(probes: Probe[]): Promise<Result[]> {
  const results = new Array<Result>(probes.length);
  let cursor = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const i = cursor++;
      if (i >= probes.length) return;
      const probe = probes[i];
      const base = {
        path: probe.perimeter.path,
        type: probe.perimeter.ownerType,
        method: probe.method,
        scope: probe.scope,
      };
      if (probe.noCall) {
        results[i] = { ...base, status: "vide", count: 0, detail: probe.noCall };
        continue;
      }
      try {
        const count = await probe.run();
        results[i] = { ...base, status: count > 0 ? "ok" : "vide", count };
      } catch (e) {
        results[i] = { ...base, status: "erreur", count: null, detail: describeError(e) };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, probes.length) }, worker));
  return results;
}

const results = await runAll(perimeters.map(planProbe));
const nOk = results.filter((r) => r.status === "ok").length;
const nEmpty = results.filter((r) => r.status === "vide").length;
const nErr = results.filter((r) => r.status === "erreur").length;

// ─── Sortie ───────────────────────────────────────────────────────────────
if (JSON_OUT) {
  console.log(
    JSON.stringify(
      {
        config: CONFIG_PATH,
        backend: baseURL,
        slug,
        slugSource: resolution.source,
        slugSiblings: resolution.siblings,
        warnings,
        entity: { name: entityName, type: entityKind },
        perimeters: results,
        ignored,
        summary: { total: results.length, ok: nOk, empty: nEmpty, error: nErr },
      },
      null,
      2,
    ),
  );
} else {
  const ICON: Record<Status, string> = { ok: "✅", vide: "⛔", erreur: "❌" };
  console.log("\n🛰️   Sonde des périmètres — " + path.basename(CONFIG_PATH) + "\n" + "═".repeat(78));
  console.log(`     backend : ${baseURL}`);
  console.log(`     costum  : ${slug} (${entityKind} — ${entityName})   [source : ${resolution.source}]`);
  // AVANT les résultats : lus après, ils ne rattrapent plus la confiance déjà
  // accordée aux ✅ / ⛔ (le costum conditionne chaque compte de la liste).
  for (const w of warnings) console.log(`\n⚠️   ${w}`);
  console.log("");

  const wPath = Math.max(...results.map((r) => r.path.length));
  const wType = Math.max(...results.map((r) => r.type.length));
  const wMethod = Math.max(...results.map((r) => r.method.length));
  for (const r of results) {
    const n = r.status === "erreur" ? "erreur" : `${r.count} résultat${(r.count ?? 0) > 1 ? "s" : ""}`;
    console.log(`${ICON[r.status]}  ${r.path.padEnd(wPath)}  ${r.type.padEnd(wType)}  ${r.method.padEnd(wMethod)}  → ${n}`);
    // Un périmètre vide ne se corrige qu'en voyant les champs qui le DÉFINISSENT.
    if (r.status === "vide") console.log(`      scope : ${JSON.stringify(r.scope)}`);
    if (r.detail) console.log(`      ↳ ${r.detail}`);
  }

  // Écartés : dits, jamais tus — c'est du config mort, pas un périmètre vide.
  for (const i of ignored) console.log(`➖  ${i.path}  ${i.type}  → ignoré : ${i.reason}`);

  console.log("\n" + "═".repeat(78));
  console.log(
    `${results.length} périmètre(s) — ${nOk} OK · ${nEmpty} VIDE · ${nErr} erreur(s)` +
      (ignored.length ? ` · ${ignored.length} ignoré(s)` : ""),
  );
  if (nEmpty) console.log("⚠️   Un périmètre VIDE = page/filtre sans résultat en production.");
  if (nErr) console.log("⚠️   Une ERREUR ne prouve RIEN sur le périmètre (backend/SDK) — à rejouer.");
  for (const w of warnings) console.log(`⚠️   ${w}`);
  console.log("");
}

process.exit(nErr > 0 ? 2 : nEmpty > 0 ? 1 : 0);
