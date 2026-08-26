/**
 * Garde de dérive des formulaires costum (`config.costumForms.*`).
 *
 * POURQUOI : un document `costumForms` déclare des champs à la main, alors que la liste réelle des champs
 * d'un costum vit en BASE et bouge sans que le dépôt ne change. `config:validate` (Zod) voit qu'une entrée
 * est bien FORMÉE, jamais si le champ EXISTE ; `audit:config` traque les références mortes INTERNES ;
 * `config:probe` interroge le backend mais sur les PÉRIMÈTRES de données. Aucun ne compare les champs.
 * Constaté le 2026-07-30 : `recepisseDeclaration` avait disparu de la config costum SSBE et restait déclaré
 * au formulaire, sans que rien ne le signale.
 *
 * PRINCIPE — ne RIEN réimplémenter. La résolution d'une clé serveur (`path`, `serializeGroups`,
 * `renderOnly` hérité des `WIDGET_DEFAULTS`) est de la logique VIVANTE ; la recopier créerait une seconde
 * source de vérité, donc un candidat à la dérive — précisément la famille de bug qu'on traque. Les deux
 * côtés de la comparaison sont donc DEMANDÉS au code réel :
 *   - ÉMIS      : `compileCostumSchema(doc)` (le compilateur du moteur de formulaire) → descripteur, dont
 *                 on lit `renderOnly` et `path` déjà résolus.
 *   - AUTORISÉ  : `_allowedFieldsCache` d'un brouillon construit dans le scope costum — c'est la lib qui
 *                 calcule l'union « SCHEMA_CONSTANTS + schéma costum », y compris les schémas VIRTUAL_*
 *                 qui ne sont PAS au contrat. Recopier cette union était impossible sans la fausser.
 *
 * Ce cadrage a été trouvé à la dure : quatre référentiels successifs ont donné 95, 87, 25 puis 11 faux
 * positifs, et le premier accusé était toujours `tiers-lieux` — le formulaire le mieux construit du dépôt,
 * simplement parce qu'il exerce le plus la couche de mapping. Une garde mal calibrée accuse le meilleur
 * code : elle est désinstallée dans la semaine. D'où les TROIS catégories ci-dessous, et pas deux.
 *
 * Usage :  npx tsx scripts/costum-form-drift.ts [--json]
 *          npm run config:costum-drift
 * Sortie : exit 2 si au moins un FANTÔME non assumé ; 0 sinon (les autres catégories informent).
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

/** Requiert `resolveCostumScope`, exporté par la lib à partir de la version qui suit 1.0.169. */
const LIB = "@communecter/cocolight-api-client";

/**
 * Écarts VOULUS, à motiver. Clé = `<id du costumForm>.<champ>`. Keyée par SLUG et jamais par `_id` :
 * un ré-import recrée les éléments avec de nouveaux identifiants (vécu le 2026-07-30 sur parent62).
 *
 * À AJOUTER LE JOUR OÙ CETTE TABLE SE REMPLIT : une empreinte de la logique de résolution
 * (`WIDGET_DEFAULTS`, `ADDRESS_KEYS`, construction du payload), sur le modèle du tripwire de
 * `clean-baseline.json` côté backend — hash normalisé + `--sync`. Sa raison d'être est d'INVALIDER cette
 * table : si la résolution change, un écart accepté hier peut ne plus être le même écart. Tant que la
 * table est vide, l'empreinte ne protège rien — le reste de la garde est sans état et se recalcule
 * intégralement à chaque exécution, donc rien d'autre ne peut se périmer.
 */
const ASSUMES: Record<string, string> = {
  // "sport-sante-bienetre-organizations.recepisseDeclaration": "motif + date + qui a tranché",
};

/** Document `costumForms` tel qu'il est écrit dans le config, avant compilation. */
type CostumFormDoc = { costumSlug?: string; collection?: string; fields?: Record<string, unknown> };

type Verdict = {
  file: string; id: string; costumSlug: string; collection: string;
  fantomes: string[]; nonExposes: string[]; nonResolus: string[];
};

export type { Verdict };

/** Fichiers de config du dépôt (ceux que `sites.json` référence + les `config.*.json` versionnés). */
function configFiles(): string[] {
  return readdirSync(ROOT).filter((f) => /^config\..*\.json$/.test(f)).sort();
}

export function serverKeys(descriptor: {
  fields: Record<string, { renderOnly?: boolean; path?: string; widget?: string }>;
  serializeGroups?: Record<string, { serverKey?: string; params?: Record<string, unknown> }>;
}, addressKeys: readonly string[]): { emitted: Set<string>; unresolved: string[] } {
  const groups = descriptor.serializeGroups ?? {};
  // Un champ CONSOMMÉ par un groupe ne part jamais seul : c'est le `serverKey` du groupe qui part.
  const members = new Set<string>();
  const groupKeys = new Set<string>();
  for (const g of Object.values(groups)) {
    if (g?.serverKey) groupKeys.add(String(g.serverKey));
    for (const [k, v] of Object.entries(g?.params ?? {})) {
      if (/Field$/.test(k) && typeof v === "string") members.add(v);
    }
    // Le groupe `address` a des `params` VIDES : l'appartenance vit dans le codec `address:read/write`.
    // On lit `ADDRESS_KEYS` (constante exportée) plutôt que de la recopier — sinon la garde dériverait.
    if (g?.serverKey === "address") addressKeys.forEach((k) => members.add(k));
  }

  const emitted = new Set<string>();
  const unresolved: string[] = [];
  for (const [name, f] of Object.entries(descriptor.fields ?? {})) {
    if (f?.renderOnly) continue;          // hérité des WIDGET_DEFAULTS (file/image/location/eventDates) OU explicite
    if (members.has(name)) continue;      // composant d'un groupe
    const key = String(f?.path ?? name).split(".")[0];
    if (!key) { unresolved.push(name); continue; }
    emitted.add(key);
  }
  for (const k of groupKeys) emitted.add(k);
  return { emitted, unresolved };
}

async function main(): Promise<void> {
  const asJson = process.argv.includes("--json");
  let backend = process.env.VITE_BASE_URL_BACKEND ?? "";
  if (!backend) {
    try { backend = (readFileSync(join(ROOT, ".env"), "utf8").match(/^VITE_BASE_URL_BACKEND=(.*)$/m)?.[1] ?? "").trim(); }
    catch { /* pas de .env : on retombe sur le défaut */ }
  }
  if (!backend) backend = "http://localhost:3000";

  const lib = await import(/* @vite-ignore */ LIB) as Record<string, unknown> & { default?: Record<string, unknown> };
  const { describeCostumForms, resolveCostumScope } = lib as {
    describeCostumForms: (u: unknown, s: string) => Promise<Array<{ collection: string; typeKey?: string; fields?: Array<{ name: string }> }>>;
    resolveCostumScope: (u: unknown, s: string) => Promise<Record<string, (d: unknown) => Promise<{ _allowedFieldsCache?: string[] }>>>;
  };
  if (typeof resolveCostumScope !== "function") {
    console.error("La lib installée n'exporte pas `resolveCostumScope` (ajouté après 1.0.169).\n"
      + "Pour l'essayer avant publication : `npm pack` dans la lib, puis\n"
      + "`npm install <tarball> --no-save` ici — la garde reste inchangée.");
    process.exit(3);
  }
  const { compileCostumSchema } = await import("../src/modules/profil/forms/costum/compileCostumSchema.js");
  const { ADDRESS_KEYS } = await import("../src/modules/profil/forms/costum/sharedCodecs.js");

  // `Api`/`ApiClient` sont portés par l'export PAR DÉFAUT de la lib (l'index ne les expose qu'en type).
  const root = (lib.default ?? lib) as {
    Api: new (a: null, b: unknown) => { organization: (q: { slug: string }) => Promise<unknown> };
    ApiClient: new (o: { baseURL: string }) => unknown;
  };
  // Même interrupteur que le site (`VITE_COSTUM_FORCE_LIVE`) : sans lui, la garde compare le
  // formulaire à l'artefact costum BUNDLÉ de la lib — donc à un état figé. Tout costum absent du
  // bundle, ou dont l'artefact est périmé, y apparaît alors en « fantômes » à tort.
  const forceLive = process.env.VITE_COSTUM_FORCE_LIVE === "true";
  const api = new root.Api(null, new root.ApiClient({ baseURL: backend, costumForceLive: forceLive }));
  if (forceLive) console.log("  (force-live actif : résolution costum par costum/co/resolved, bundle ignoré)\n");
  const caller = await api.organization({ slug: "franceTierslieux" });

  type Scope = { create: (coll: string, data: Record<string, unknown>) => Promise<{ _allowedFieldsCache?: string[] }> };
  const scopeCache = new Map<string, Scope>();
  const scopeFor = async (slug: string): Promise<Scope> => {
    if (!scopeCache.has(slug)) scopeCache.set(slug, await resolveCostumScope(caller, slug) as unknown as Scope);
    return scopeCache.get(slug)!;
  };
  const liveCache = new Map<string, Awaited<ReturnType<typeof describeCostumForms>>>();
  const liveFor = async (slug: string) => {
    if (!liveCache.has(slug)) liveCache.set(slug, await describeCostumForms(caller, slug));
    return liveCache.get(slug)!;
  };

  const verdicts: Verdict[] = [];
  for (const file of configFiles()) {
    let cfg: { costumForms?: Record<string, CostumFormDoc> };
    try { cfg = JSON.parse(readFileSync(join(ROOT, file), "utf8")); } catch { continue; }
    for (const [id, doc] of Object.entries(cfg.costumForms ?? {})) {
      const costumSlug = doc?.costumSlug, collection = doc?.collection;
      if (!costumSlug || !collection) continue;

      const { descriptor } = compileCostumSchema(doc);
      const { emitted, unresolved } = serverKeys(descriptor as never, ADDRESS_KEYS as readonly string[]);

      // AUTORISÉ : l'union calculée par la lib pour un brouillon de cette collection dans ce costum.
      const scope = await scopeFor(costumSlug);
      // `create(<collection au pluriel>)` plutôt que les fabriques nommées (`poi`/`organization`/…),
      // qui sont au singulier alors que le config porte le nom de collection.
      const draft = await scope.create(collection, { name: "sonde-garde" });
      const allowed = new Set<string>(draft?._allowedFieldsCache ?? []);

      // NON EXPOSÉS : champs du costum que le formulaire n'offre pas. INFORMATIF — un formulaire a le
      // droit de ne pas tout exposer.
      const descs = await liveFor(costumSlug);
      const same = descs.filter((d) => d.collection === collection);
      const d = same.find((x) => x.typeKey && id.toLowerCase().endsWith(String(x.typeKey).replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()).replace(/^-/, "").toLowerCase()))
        ?? (same.length === 1 ? same[0] : undefined);
      const costumFields = new Set<string>((d?.fields ?? []).map((f) => f.name));

      verdicts.push({
        file, id, costumSlug, collection,
        fantomes: [...emitted].filter((k) => !allowed.has(k) && !ASSUMES[`${id}.${k}`]),
        nonExposes: [...costumFields].filter((k) => !emitted.has(k)),
        nonResolus: unresolved,
      });
    }
  }

  if (asJson) { console.log(JSON.stringify(verdicts, null, 2)); }
  else {
    const nF = verdicts.reduce((a, v) => a + v.fantomes.length, 0);
    const nU = verdicts.reduce((a, v) => a + v.nonResolus.length, 0);
    console.log(`Dérive des formulaires costum — ${verdicts.length} document(s) · backend ${backend}\n`);
    for (const v of verdicts) {
      if (!v.fantomes.length && !v.nonExposes.length && !v.nonResolus.length) { console.log(`  ✅ ${v.file} :: ${v.id}`); continue; }
      console.log(`  ${v.file} :: ${v.id}  (${v.costumSlug}/${v.collection})`);
      if (v.fantomes.length) console.log(`     ❌ FANTÔMES (${v.fantomes.length}) — émis mais refusés par le serveur : ${v.fantomes.join(", ")}`);
      if (v.nonResolus.length) console.log(`     ⚠  NON RÉSOLUS (${v.nonResolus.length}) — à qualifier, PAS un défaut : ${v.nonResolus.join(", ")}`);
      if (v.nonExposes.length) console.log(`     ·  non exposés (${v.nonExposes.length}) : ${v.nonExposes.join(", ")}`);
    }
    console.log(`\n${nF} fantôme(s) · ${nU} non résolu(s)`);
    if (nF) console.log("Un fantôme est un champ que le formulaire envoie et que RIEN n'accepte : il est perdu\nsilencieusement à l'enregistrement. Soit on le retire, soit on l'inscrit dans ASSUMES avec son motif.");
  }
  process.exit(verdicts.some((v) => v.fantomes.length) ? 2 : 0);
}

await main();
