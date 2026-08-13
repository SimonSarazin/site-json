/**
 * Pilote les déploiements Coolify du parc depuis le dépôt.
 *
 * POURQUOI — les N sites de ce dépôt sont N applications Coolify qui pointent
 * toutes le MÊME dépôt et la MÊME branche. Coolify ne filtre les webhooks que
 * sur (dépôt, branche) : un push déclencherait donc les N. Cet outil prend le
 * contre-pied — aucune automatisation implicite, on nomme ce qu'on déploie
 * (« tout » se nomme --all), et les déploiements s'enchaînent un par un.
 *
 * La correspondance slug ↔ application ↔ domaine vit dans `sites.json`
 * (champs `coolifyApp` et `domain`). Le token, lui, reste dans le contexte du
 * CLI Coolify (`~/.config/coolify/config.json`) et n'entre jamais dans le dépôt.
 *
 * Usage :
 *   npm run deploy:status                       état du parc
 *   npm run deploy:lock -- --yes                coupe l'auto-deploy sur toutes les apps
 *   npm run deploy -- institutBleu --yes        déploie un site
 *   npm run deploy -- a b c --yes               déploie a, puis b, puis c
 *   npm run deploy -- --all --yes               déploie tout le parc (nommé explicitement)
 *   npm run deploy:rollout -- --all --yes       env en conformité PUIS déploiement, par site
 *
 * Options communes :
 *   --context <nom>   viser une instance Coolify précise
 *   --ref <rev>       référence de comparaison (défaut : origin/main, la branche
 *                     que Coolify bâtit — surtout pas le HEAD local)
 *   --json            sortie machine (status, affected, push, rollout)
 *
 * Sorties / codes :
 *   0  tout est cohérent
 *   1  le défaut cherché existe (écart de déploiement, site sans application…)
 *   2  erreur d'usage ou d'outillage (contexte absent, instance injoignable)
 */
import { execFileSync } from "node:child_process";
import {
  applicationDeployments,
  CoolifyError,
  createApplication,
  deployApplication,
  resoudrePlacement,
  getApplication,
  indexByName,
  lastSuccessfulDeployment,
  loadContext,
  listEnvs,
  patchApplication,
  runningDeployments,
  upsertEnv,
  type CoolifyApp,
  type CoolifyContext,
  type CoolifyDeployment,
} from "./lib/coolify";
import { analyserArgv } from "./lib/deploy-cli";
import { buildDuSite, cibleDnsDuServeur, masquer, variablesAttendues } from "./lib/deploy-config";
import { executerParSite } from "./lib/deploy-lot";
import { impact } from "./lib/deploy-scope";
import { atteintLaMemeCible, resoudre as resoudreDns } from "./lib/dns";
import { chargerIdentifiants, creerCname, listerZones, OvhError, rafraichirZone, trouverCname } from "./lib/ovh";
import {
  asList, coolifyDomains, loadSites, sousDomaineAmorce,
  ROOT, ZONE_AMORCE, type SiteEntry,
} from "./lib/sites";

const cmd = analyserArgv(process.argv.slice(2));
const COMMANDES = ["status", "lock", "push", "env", "affected", "rollout", "dns", "alias", "create"] as const;
type Commande = (typeof COMMANDES)[number];

const commande = cmd.commande as Commande | undefined;
const JSON_OUT = cmd.bool("--json");
const opt = (nom: string): string | undefined => cmd.valeur(nom);

function usage(): never {
  console.error(`Usage : npm run deploy:<commande> [-- options]

Commandes :
  status              état du parc : site ↔ application ↔ domaine ↔ commit déployé
  lock [--unlock]     coupe (ou rétablit) le déploiement automatique sur push
  push <sélection>    déploie les sites sélectionnés, un par un
  env <sélection> [--write]  compare (et pose) les variables des sites
  affected            quels sites les commits non déployés concernent-ils
  rollout <sélection>  met l'env en conformité PUIS déploie, par site (gate --yes unique)
  dns <slug> [--write]         vérifie/crée le CNAME d'amorce dans la zone 00.re
  alias <slug> <dom> [--write] attache un domaine propre (DNS déjà pointé)
  create <slug> [--write]      crée l'application d'un site déclaré

Sélection (push, env, rollout) : des slugs nommés, OU --all (tout le parc déployable),
OU --affected (les sites que les commits non déployés concernent) —
exactement une des trois formes.

Options :
  --all               sélection : tout le parc déployable
  --affected          sélection : les sites impactés par les commits non déployés
  --context <nom>     instance Coolify (défaut : celle marquée par défaut)
  --ref <rev>         référence de comparaison (défaut : origin/main)
  --yes               applique sans confirmation (lock, push, rollout)
  --fail-fast         push, lock, rollout : arrêt au premier échec (défaut :
                      on continue, bilan final + reprise pour les ratés)
  --no-wait           push : déclenche sans attendre la fin
  --timeout <s>       push, rollout : abandon de l'attente par site (défaut 1500)
  --server <nom>      create : serveur Coolify (sinon sites.json, sinon déduit)
  --project <nom>     create : projet Coolify (idem)
  --environment <nom> create : environnement (défaut production)
  --json              sortie machine (status, affected, push, rollout)`);
  process.exit(2);
}

/* ── Git ──────────────────────────────────────────────────────────────────── */

const git = (...args: string[]): string =>
  execFileSync("git", args, { cwd: ROOT, encoding: "utf-8" }).trim();

const resoudre = (rev: string): string | null => {
  try {
    return git("rev-parse", "--verify", "-q", `${rev}^{commit}`);
  } catch {
    return null;
  }
};

/**
 * La référence à laquelle comparer les déploiements.
 *
 * Coolify bâtit la BRANCHE DISTANTE, pas le disque : comparer au HEAD local
 * ferait passer pour « en retard » des applications parfaitement à jour dès
 * qu'on travaille sur une branche non poussée. Surchargeable par `--ref`.
 */
function reference(): { rev: string; sha: string } {
  const demande = opt("--ref");
  if (demande) {
    const sha = resoudre(demande);
    if (!sha) throw new CoolifyError(`Référence "${demande}" introuvable. Peut-être « git fetch » ?`);
    return { rev: demande, sha };
  }
  const distante = resoudre("origin/main");
  if (distante) return { rev: "origin/main", sha: distante };
  return { rev: "HEAD", sha: git("rev-parse", "HEAD") };
}

/** Nombre de commits entre le commit déployé et la référence. `null` si sha inconnu localement. */
function retard(sha: string | null, refSha: string): number | null {
  if (!sha) return null;
  if (!resoudre(sha)) return null;
  return Number(git("rev-list", "--count", `${sha}..${refSha}`));
}

/* ── Caches process ───────────────────────────────────────────────────────── */

/**
 * Un processus = une commande = UN contexte Coolify : mettre en cache la
 * lecture de sites.json et l'index des applications est sûr. `push` relisait
 * sites.json à chaque slug et `resoudreSite` refaisait un GET /applications
 * complet à chaque appel — en lot sur 9 sites, 9 allers-retours identiques.
 * Le jour où une commande bouclerait sur PLUSIEURS contextes, `_index` devrait
 * être keyé par contexte.
 */
let _sites: SiteEntry[] | undefined;
const sitesDuDepot = (): SiteEntry[] => (_sites ??= loadSites());

/** Même prédicat que `deployableSites()` (sites.ts), dérivé du cache. */
const sitesDeployables = (): SiteEntry[] => sitesDuDepot().filter((s) => Boolean(s.coolifyApp));

let _index: Promise<Map<string, CoolifyApp>> | undefined;
const indexApplications = (ctx: CoolifyContext): Promise<Map<string, CoolifyApp>> =>
  (_index ??= indexByName(ctx));

/* ── status ───────────────────────────────────────────────────────────────── */

interface Ligne {
  slug: string;
  app: string;
  uuid: string | null;
  domaines: string[];
  fqdnCoolify: string | null;
  commit: string | null;
  retard: number | null;
  ecarts: string[];
}

function analyser(
  site: SiteEntry,
  app: CoolifyApp | undefined,
  dernier: CoolifyDeployment | undefined,
  refSha: string,
): Ligne {
  const ecarts: string[] = [];
  const domaines = asList(site.domain);

  if (!app) {
    ecarts.push(`application "${site.coolifyApp}" introuvable sur l'instance`);
    return {
      slug: site.slug, app: site.coolifyApp as string, uuid: null,
      domaines, fqdnCoolify: null, commit: null, retard: null, ecarts,
    };
  }

  const attendu = coolifyDomains(site);
  const reel = app.fqdn ?? "";
  if (normaliserFqdn(reel) !== normaliserFqdn(attendu)) {
    ecarts.push(`domaine : sites.json dit "${attendu}", Coolify sert "${reel || "(aucun)"}"`);
  }

  // Le commit déployé vient de l'historique, pas de `git_commit_sha` : ce
  // dernier vaut « HEAD », la consigne de suivi de branche, pas un état.
  const commit = dernier?.commit ?? null;
  if (!commit) {
    ecarts.push("aucun déploiement abouti");
  } else {
    const r = retard(commit, refSha);
    if (r === null) ecarts.push(`commit déployé ${commit.slice(0, 8)} inconnu localement`);
    else if (r > 0) ecarts.push(`${r} commit(s) de retard`);
    return { slug: site.slug, app: app.name, uuid: app.uuid, domaines, fqdnCoolify: app.fqdn, commit, retard: r, ecarts };
  }

  return {
    slug: site.slug, app: app.name, uuid: app.uuid, domaines,
    fqdnCoolify: app.fqdn, commit, retard: null, ecarts,
  };
}

/** Compare deux FQDN Coolify indépendamment de l'ordre et des espaces. */
const normaliserFqdn = (s: string): string =>
  s.split(",").map((x) => x.trim().replace(/\/+$/, "")).filter(Boolean).sort().join(",");

async function status(ctx: CoolifyContext): Promise<number> {
  const sites = sitesDuDepot();
  const cibles = sitesDeployables();
  const index = await indexApplications(ctx);

  const ref = reference();
  const lignes = await Promise.all(
    cibles.map(async (s) => {
      const app = index.get(s.coolifyApp as string);
      const dernier = app ? await lastSuccessfulDeployment(ctx, app.uuid) : undefined;
      return analyser(s, app, dernier, ref.sha);
    }),
  );
  const sansApp = sites.filter((s) => !s.coolifyApp).map((s) => s.slug);

  // Applications qui ressemblent au parc mais que sites.json ne déclare pas.
  const declarees = new Set(cibles.map((s) => s.coolifyApp));
  const orphelines = [...index.values()]
    .filter((a) => a.name.startsWith("site-json-") && !declarees.has(a.name))
    .map((a) => a.name);

  if (JSON_OUT) {
    console.log(
      JSON.stringify({ instance: ctx.name, ref: ref.rev, refSha: ref.sha, sites: lignes, sansApp, orphelines }, null, 2),
    );
  } else {
    console.log(`Instance : ${ctx.name} (${ctx.fqdn})`);
    console.log(`Référence : ${ref.rev} @ ${ref.sha.slice(0, 8)}\n`);
    const l = (s: string, n: number) => s.padEnd(n);
    const LARGEURS = [24, 36, 10] as const;
    const marge = LARGEURS.reduce((a, b) => a + b, 0);
    console.log(l("slug", LARGEURS[0]) + l("application", LARGEURS[1]) + l("déployé", LARGEURS[2]) + "état");
    for (const x of lignes) {
      const etat = x.ecarts.length === 0 ? "✓ à jour" : `✗ ${x.ecarts[0]}`;
      console.log(
        l(x.slug, LARGEURS[0]) + l(x.app, LARGEURS[1]) + l((x.commit ?? "—").slice(0, 8), LARGEURS[2]) + etat,
      );
      for (const e of x.ecarts.slice(1)) console.log(" ".repeat(marge) + `✗ ${e}`);
    }
    // Répartition du parc — gratuite, `destination` est déjà dans la liste.
    // Un parc étalé sur plusieurs serveurs empêche `create` de déduire son
    // placement : autant le voir ici plutôt qu'au moment de créer.
    const serveurs = [
      ...new Set(
        cibles
          .map((s) => index.get(s.coolifyApp as string)?.destination?.server?.name)
          .filter((n): n is string => Boolean(n)),
      ),
    ];
    if (serveurs.length > 1) {
      console.log(`\n· parc réparti sur ${serveurs.length} serveurs : ${serveurs.join(", ")}`);
      console.log(`  create demandera --server / --project, ou les champs coolifyServer / coolifyProject.`);
    }

    const local = git("rev-parse", "HEAD");
    if (local !== ref.sha) {
      console.log(
        `\n⚠ HEAD local (${local.slice(0, 8)}) diffère de ${ref.rev} (${ref.sha.slice(0, 8)}).` +
          ` Coolify bâtit ${ref.rev} : les commits non poussés ne partiront pas.`,
      );
    }
    if (sansApp.length) console.log(`\n· ${sansApp.length} site(s) sans application : ${sansApp.join(", ")}`);
    if (orphelines.length) console.log(`· application(s) non déclarée(s) dans sites.json : ${orphelines.join(", ")}`);
  }

  return lignes.some((x) => x.ecarts.length > 0) ? 1 : 0;
}

/* ── lock ─────────────────────────────────────────────────────────────────── */

/**
 * Coupe le déploiement automatique sur push.
 *
 * POURQUOI — Coolify ne filtre les webhooks que sur (dépôt, branche). Nos N
 * applications partagent les deux : un seul push les mettrait TOUTES en file. Et
 * `is_auto_deploy_enabled` vaut `true` par défaut à la création. Aucun webhook
 * n'existe aujourd'hui côté GitLab, mais rien n'empêche qu'on en ajoute un ; ce
 * verrou fait que ce jour-là, rien ne partira tout seul.
 *
 * L'API 4.1.1 ne renvoie pas le sous-objet `settings` : on ne peut pas relire la
 * valeur pour confirmer. Le contrôle se fait dans l'UI, onglet Advanced.
 */
async function lock(ctx: CoolifyContext): Promise<number> {
  const unlock = cmd.bool("--unlock");
  const cible = !unlock;
  const cibles = sitesDeployables();
  const index = await indexApplications(ctx);

  const aTraiter = cibles
    .map((s) => ({ site: s, app: index.get(s.coolifyApp as string) }))
    .filter((x) => x.app !== undefined);

  console.log(
    `${unlock ? "Rétablir" : "Couper"} le déploiement automatique sur ${aTraiter.length} application(s) :`,
  );
  for (const { site, app } of aTraiter) console.log(`  ${site.slug.padEnd(24)} ${app!.name}`);

  if (!cmd.bool("--yes")) {
    console.log(`\nRelancer avec --yes pour appliquer. Rien n'a été modifié.`);
    return 0;
  }

  const apps = new Map(aTraiter.map((x) => [x.site.slug, x.app!]));
  const bilan = await executerParSite(
    aTraiter.map((x) => x.site.slug),
    async (slug) => {
      await patchApplication(ctx, apps.get(slug)!.uuid, { is_auto_deploy_enabled: cible });
    },
    {
      failFast: cmd.bool("--fail-fast"),
      // lock n'a pas de sélection par slug : la reprise est la commande entière (idempotente).
      reprise: () => `npm run deploy:lock -- --yes${unlock ? " --unlock" : ""}`,
    },
  );
  console.log(`L'API 4.1.1 ne renvoie pas ce réglage : vérifier dans l'UI Coolify, onglet Advanced.`);
  return bilan.code;
}

/* ── push ─────────────────────────────────────────────────────────────────── */

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Attend qu'un déploiement quitte la file, puis rend son statut final.
 *
 * On sonde `GET /deployments` (quelques octets, la liste des déploiements en
 * cours) et non `GET /deployments/{uuid}` qui embarque l'application ET les logs
 * — un demi-mégaoctet par sondage. Le détail n'est lu qu'une fois, à la sortie.
 */
async function attendre(
  ctx: CoolifyContext,
  appUuid: string,
  deploiement: string,
  timeoutS: number,
): Promise<string> {
  const debut = Date.now();
  let vuEnFile = false;
  while ((Date.now() - debut) / 1000 < timeoutS) {
    // Un sondage raté sur du PASSAGER (coupure, 502 du proxy) ne condamne pas
    // une attente de plusieurs minutes : on saute ce tour et on resondera.
    // Une erreur définitive (401 token révoqué, 404…), elle, fait échouer le
    // site tout de suite — pas après timeoutS de sondages muets.
    let file: Awaited<ReturnType<typeof runningDeployments>>;
    try {
      file = await runningDeployments(ctx);
    } catch (e) {
      if (e instanceof CoolifyError && e.transitoire) {
        await dormir(10_000);
        continue;
      }
      throw e;
    }
    const present = file.some((d) => d.deployment_uuid === deploiement);
    if (present) vuEnFile = true;
    // Sortie de file : soit on l'y a vu puis il disparaît, soit il a été si
    // rapide qu'on ne l'a jamais croisé — dans les deux cas on va lire le verdict.
    if (!present && (vuEnFile || (Date.now() - debut) / 1000 > 15)) break;
    process.stdout.write(`    …${Math.round((Date.now() - debut) / 1000)} s\r`);
    await dormir(10_000);
  }
  process.stdout.write(" ".repeat(30) + "\r");

  const historique = await applicationDeployments(ctx, appUuid, 5);
  const trouve = historique.find((d) => d.deployment_uuid === deploiement);
  return trouve?.status ?? "inconnu";
}

/* ── Sélection de lot ─────────────────────────────────────────────────────── */

/** État de déploiement d'un site vis-à-vis de la référence. */
interface EtatSite {
  slug: string;
  etat: "a-jour" | "a-redeployer" | "jamais-deploye" | "commit-inconnu" | "app-introuvable";
  /** Commit du dernier déploiement abouti (absent si jamais déployé / app introuvable). */
  base?: string;
  impact?: ReturnType<typeof impact>;
}

/**
 * Pour chaque site déployable : les commits depuis son dernier déploiement le
 * concernent-ils ? Base PAR SITE (le commit de son dernier déploiement abouti),
 * cible commune (la référence). Calcul pur d'affichage : partagé entre la
 * sous-commande `affected` et la sélection `--affected` de push/env/rollout.
 */
async function calculerAffected(ctx: CoolifyContext, refSha: string): Promise<EtatSite[]> {
  const tous = sitesDuDepot();
  const index = await indexApplications(ctx);
  const etats: EtatSite[] = [];
  for (const site of sitesDeployables()) {
    const app = index.get(site.coolifyApp as string);
    if (!app) {
      etats.push({ slug: site.slug, etat: "app-introuvable" });
      continue;
    }
    const dernier = await lastSuccessfulDeployment(ctx, app.uuid);
    const base = dernier?.commit;
    if (!base) {
      etats.push({ slug: site.slug, etat: "jamais-deploye" });
      continue;
    }
    if (!resoudre(base)) {
      etats.push({ slug: site.slug, etat: "commit-inconnu", base });
      continue;
    }
    const fichiers = git("diff", "--name-only", `${base}..${refSha}`).split("\n").filter(Boolean);
    const r = impact(fichiers, site, tous);
    etats.push({
      slug: site.slug,
      etat: fichiers.length > 0 && r.aRedeployer ? "a-redeployer" : "a-jour",
      base,
      impact: r,
    });
  }
  return etats;
}

/**
 * Sélection des sites d'une commande de lot : des slugs nommés, OU `--all`
 * (tout le parc déployable), OU `--affected` (les sites que les commits non
 * déployés concernent). Exactement UNE forme — mélanger « tout » et une liste
 * nommée serait ambigu, et zéro sélection reste un refus : l'outil ne déploie
 * jamais « tout » implicitement, `--all` est le nommage EXPLICITE de « tout ».
 *
 * Rend `null` sur une erreur d'usage (l'appelant sort en 2). Un tableau vide
 * est légitime (`--affected` sans travail) : l'appelant sort en 0.
 */
async function resoudreSelection(ctx: CoolifyContext, usageLigne: string): Promise<SiteEntry[] | null> {
  const formes = [cmd.positionnels.length > 0, cmd.bool("--all"), cmd.bool("--affected")]
    .filter(Boolean).length;
  if (formes > 1) {
    console.error(`✗ Choisir UNE forme de sélection : des slugs, OU --all, OU --affected.`);
    return null;
  }
  if (formes === 0) {
    console.error(`✗ Aucun site nommé. Cet outil ne déploie jamais « tout » implicitement.\n  ${usageLigne}`);
    return null;
  }
  if (cmd.bool("--all")) return sitesDeployables();
  if (cmd.bool("--affected")) {
    const etats = await calculerAffected(ctx, reference().sha);
    // Les états indéterminables ne sont PAS retenus — déployer un site jamais
    // déployé ou inévaluable serait une décision implicite — mais ils ne
    // doivent pas disparaître : sans ces lignes, l'opérateur lirait « aucun
    // site à déployer » alors que l'outil n'a pas pu se prononcer.
    for (const e of etats) {
      if (e.etat === "jamais-deploye") {
        console.error(`⚠ ${e.slug} : jamais déployé — hors sélection --affected (le nommer explicitement).`);
      } else if (e.etat === "commit-inconnu") {
        console.error(`⚠ ${e.slug} : commit déployé ${e.base?.slice(0, 8)} inconnu localement (« git fetch » ?) — inévaluable, hors sélection.`);
      } else if (e.etat === "app-introuvable") {
        console.error(`⚠ ${e.slug} : application introuvable sur l'instance — hors sélection.`);
      }
    }
    const retenus = new Set(etats.filter((e) => e.etat === "a-redeployer").map((e) => e.slug));
    return sitesDeployables().filter((s) => retenus.has(s.slug));
  }
  return cmd.positionnels.map((slug) => {
    const site = sitesDuDepot().find((s) => s.slug === slug);
    if (!site) throw new CoolifyError(`Slug "${slug}" absent de sites.json.`);
    return site;
  });
}

async function push(ctx: CoolifyContext): Promise<number> {
  const selection = await resoudreSelection(
    ctx,
    `Usage : npm run deploy -- <slug…> | --all | --affected  [--yes]`,
  );
  if (!selection) return 2;
  if (selection.length === 0) {
    console.log(`✓ aucun site à déployer (sélection --affected vide).`);
    return 0;
  }
  const timeoutS = timeoutSecondes(); // valider AVANT d'afficher un plan ou de déclencher

  const cibles: Array<{ slug: string; nom: string; uuid: string }> = [];
  for (const site of selection) {
    const { app } = await resoudreSite(ctx, site.slug);
    cibles.push({ slug: site.slug, nom: app.name, uuid: app.uuid });
  }

  const ref = reference();
  const local = git("rev-parse", "HEAD");
  console.log(`Cible : ${ref.rev} @ ${ref.sha.slice(0, 8)}`);
  if (local !== ref.sha) {
    console.log(`⚠ HEAD local (${local.slice(0, 8)}) n'est pas ${ref.rev} : les commits non poussés ne partiront pas.`);
  }
  console.log(`À déployer, dans l'ordre (${cibles.length}) :`);
  for (const c of cibles) console.log(`  ${c.slug.padEnd(24)} ${c.nom}`);

  const enCours = await runningDeployments(ctx);
  if (enCours.length > 0) {
    console.log(`⚠ ${enCours.length} déploiement(s) déjà en file sur l'instance (partagée avec d'autres projets).`);
  }

  if (!cmd.bool("--yes")) {
    console.log(`\nRelancer avec --yes pour lancer. Rien n'a été déclenché.`);
    return 0;
  }

  const attendreFin = !cmd.bool("--no-wait");
  const uuids = new Map(cibles.map((c) => [c.slug, c.uuid]));
  const bilan = await executerParSite(
    cibles.map((c) => c.slug),
    (slug) => deployerSite(ctx, uuids.get(slug)!, attendreFin, timeoutS),
    {
      failFast: cmd.bool("--fail-fast"),
      reprise: (s) => `npm run deploy -- ${s.join(" ")} --yes`,
    },
  );
  avertirBuildsEnVol(bilan.resultats);
  if (JSON_OUT) {
    console.log(JSON.stringify({ resultats: bilan.resultats, reprise: bilan.reprise ?? null }, null, 2));
  }
  return bilan.code;
}

/**
 * Lit `--timeout` (secondes) en le VALIDANT. Une valeur erronée (NaN via une
 * faute de frappe, négatif) rendrait la boucle d'attente fausse dès le premier
 * tour : verdict lu immédiatement, build fraîchement déclenché jugé « raté »,
 * et une reprise qui relancerait des builds en double. Refuser AVANT tout
 * déclenchement (CoolifyError → code 2).
 */
function timeoutSecondes(): number {
  const brut = opt("--timeout");
  if (brut === undefined) return 1500;
  const t = Number(brut);
  if (!Number.isFinite(t) || t <= 0) {
    throw new CoolifyError(`--timeout "${brut}" invalide : nombre de secondes strictement positif attendu.`);
  }
  return t;
}

/**
 * Après le bilan d'un lot : si un site a échoué sur TIMEOUT d'attente, son
 * build tourne peut-être encore — exécuter la reprise telle quelle ferait un
 * build en double. Le rappel doit suivre la commande de reprise, pas seulement
 * le message enfoui au moment de l'échec.
 */
function avertirBuildsEnVol(resultats: import("./lib/deploy-lot").ResultatSite[]): void {
  if (resultats.some((r) => r.detail?.includes("peut encore aboutir"))) {
    console.error(`⚠ Vérifier deploy:status avant d'exécuter la reprise : un build listé peut encore aboutir.`);
  }
}

/**
 * Déclenche le déploiement d'une application et, sauf demande contraire,
 * attend son verdict. Lève en échec — le moteur de lot rattrape par site.
 */
async function deployerSite(
  ctx: CoolifyContext,
  uuid: string,
  attendreFin: boolean,
  timeoutS: number,
): Promise<void> {
  const dep = await deployApplication(ctx, uuid, true);
  if (!dep) throw new CoolifyError(`déclenchement refusé par Coolify`);
  console.log(`  ✓ déclenché — ${dep}`);
  if (!attendreFin) return;

  const statut = await attendre(ctx, uuid, dep, timeoutS);
  if (statut === "finished") {
    console.log(`  ✓ ${statut}`);
    return;
  }
  // Statut ni fini ni franchement raté (queued, in_progress, inconnu…) après
  // l'attente : le build PEUT encore aboutir. Redéclencher aveuglément ferait
  // un build en double — d'où la consigne de vérifier avant de reprendre.
  const peutAboutir = statut !== "failed" && statut !== "cancelled";
  throw new CoolifyError(
    `${statut} — ${ctx.fqdn}/project (voir les logs du déploiement ${dep})` +
      (peutAboutir ? ` ; le build peut encore aboutir — vérifier deploy:status avant de reprendre` : ""),
  );
}

/* ── env ──────────────────────────────────────────────────────────────────── */

/** Résout un slug vers son application, ou lève. */
async function resoudreSite(
  ctx: CoolifyContext,
  slug: string,
): Promise<{ site: SiteEntry; app: CoolifyApp }> {
  const site = sitesDuDepot().find((s) => s.slug === slug);
  if (!site) throw new CoolifyError(`Slug "${slug}" absent de sites.json.`);
  if (!site.coolifyApp) throw new CoolifyError(`"${slug}" n'a pas d'application déclarée (champ coolifyApp).`);
  const app = (await indexApplications(ctx)).get(site.coolifyApp);
  if (!app) throw new CoolifyError(`Application "${site.coolifyApp}" introuvable sur l'instance.`);
  return { site, app };
}

/**
 * Compare les variables attendues d'UN site à celles posées sur son
 * application, et les pose si `write`.
 *
 * Ne supprime jamais : une variable présente côté Coolify mais hors du jeu
 * attendu est signalée, pas retirée. Elle peut avoir été posée exprès.
 */
async function envDuSite(
  ctx: CoolifyContext,
  site: SiteEntry,
  app: CoolifyApp,
  write: boolean,
): Promise<{ ecarts: number; appliques: number }> {
  const { variables, manquantes } = variablesAttendues(site);
  const posees = await listEnvs(ctx, app.uuid);
  const parCle = new Map(posees.map((e) => [e.key, e]));

  console.log(`${site.slug} → ${app.name}\n`);
  const aEcrire: typeof variables = [];
  for (const v of variables) {
    const actuelle = parCle.get(v.key);
    const affiche = v.sensible ? masquer(v.value) : v.value;
    if (!actuelle) {
      console.log(`  ✗ ${v.key.padEnd(24)} absente — à créer (${affiche})`);
      aEcrire.push(v);
    } else if (actuelle.value !== v.value) {
      console.log(`  ✗ ${v.key.padEnd(24)} attendu ${affiche}`);
      console.log(`    ${" ".repeat(24)} présent ${v.sensible ? masquer(actuelle.value) : actuelle.value}`);
      aEcrire.push(v);
    } else if (!actuelle.is_buildtime || !actuelle.is_runtime) {
      console.log(`  ✗ ${v.key.padEnd(24)} valeur bonne mais portée incomplète (build=${actuelle.is_buildtime}, run=${actuelle.is_runtime})`);
      aEcrire.push(v);
    } else {
      console.log(`  ✓ ${v.key.padEnd(24)} ${affiche}`);
    }
  }

  const attendues = new Set(variables.map((v) => v.key));
  const enTrop = posees.filter((e) => !attendues.has(e.key)).map((e) => e.key);
  for (const k of enTrop) console.log(`  · ${k.padEnd(24)} présente côté Coolify, hors du jeu attendu (jamais retirée)`);
  for (const k of manquantes) console.log(`  · ${k.padEnd(24)} introuvable dans .env — non poussée`);

  if (aEcrire.length === 0 || !write) {
    return { ecarts: aEcrire.length, appliques: 0 };
  }

  console.log("");
  for (const v of aEcrire) {
    const quoi = await upsertEnv(
      ctx,
      app.uuid,
      { key: v.key, value: v.value, is_buildtime: true, is_runtime: true },
      posees,
    );
    console.log(`  ✓ ${v.key} ${quoi}`);
  }
  return { ecarts: aEcrire.length, appliques: aEcrire.length };
}

async function env(ctx: CoolifyContext): Promise<number> {
  const selection = await resoudreSelection(
    ctx,
    `Usage : npm run deploy:env -- <slug…> | --all | --affected  [--write]`,
  );
  if (!selection) return 2;
  if (selection.length === 0) {
    console.log(`✓ aucun site sélectionné (--affected vide).`);
    return 0;
  }

  // Résoudre TOUTE la sélection avant la première écriture : un slug sans
  // application au milieu du lot lèverait APRÈS avoir modifié les précédents.
  const cibles: Array<{ site: SiteEntry; app: CoolifyApp }> = [];
  for (const site of selection) cibles.push(await resoudreSite(ctx, site.slug));

  const write = cmd.bool("--write");
  let totalEcarts = 0;
  const modifies: string[] = [];
  for (const [i, { site, app }] of cibles.entries()) {
    if (i > 0) console.log("");
    const r = await envDuSite(ctx, site, app, write);
    totalEcarts += r.ecarts;
    if (r.appliques > 0) modifies.push(site.slug);
  }

  if (totalEcarts === 0) {
    console.log(`\n✓ aucun écart.`);
    return 0;
  }
  if (!write) {
    console.log(`\n${totalEcarts} écart(s). Relancer avec --write pour appliquer.`);
    return 1;
  }
  console.log(`\n✓ variable(s) appliquée(s). Un déploiement est nécessaire pour qu'elles prennent effet :`);
  console.log(`  npm run deploy -- ${modifies.join(" ")} --yes`);
  return 0;
}

/* ── affected ─────────────────────────────────────────────────────────────── */

/**
 * Quels sites les commits depuis leur dernier déploiement concernent-ils ?
 *
 * L'intérêt n'est pas de RÉDUIRE la liste — un changement du générateur la
 * ramène à tout le monde, et c'est correct. Il est de reconnaître les commits
 * qui ne concernent PERSONNE (doc, tests, scripts) et ceux qui ne concernent
 * qu'un site, au lieu de redéployer par précaution.
 */
async function affected(ctx: CoolifyContext): Promise<number> {
  const ref = reference();
  const etats = await calculerAffected(ctx, ref.sha);
  const aRedeployer = etats.filter((e) => e.etat === "a-redeployer").map((e) => e.slug);

  if (JSON_OUT) {
    console.log(
      JSON.stringify(
        {
          ref: ref.rev,
          refSha: ref.sha,
          sites: etats.map((e) => ({
            slug: e.slug,
            etat: e.etat,
            base: e.base ?? null,
            propre: e.impact?.propre ?? [],
            partage: e.impact?.partage ?? [],
            neutre: e.impact?.neutre ?? [],
          })),
          aRedeployer,
        },
        null,
        2,
      ),
    );
    return aRedeployer.length === 0 ? 0 : 1;
  }

  console.log(`Référence : ${ref.rev} @ ${ref.sha.slice(0, 8)}\n`);
  for (const e of etats) {
    const l = e.slug.padEnd(24);
    switch (e.etat) {
      case "app-introuvable":
        console.log(`${l} ✗ application introuvable`);
        break;
      case "jamais-deploye":
        console.log(`${l} · jamais déployé`);
        break;
      case "commit-inconnu":
        console.log(`${l} ✗ commit ${e.base!.slice(0, 8)} inconnu localement — « git fetch » ?`);
        break;
      case "a-jour": {
        const n = e.impact?.neutre.length ?? 0;
        console.log(`${l} ✓ à jour${n > 0 ? ` (${n} fichier(s) sans effet sur l'image)` : ""}`);
        break;
      }
      case "a-redeployer": {
        console.log(`${l} ⟶ à redéployer, depuis ${e.base!.slice(0, 8)}`);
        const r = e.impact!;
        if (r.propre.length) console.log(`    propre au site   ${r.propre.slice(0, 4).join(", ")}${r.propre.length > 4 ? ` … +${r.propre.length - 4}` : ""}`);
        if (r.partage.length) console.log(`    partagé          ${r.partage.slice(0, 4).join(", ")}${r.partage.length > 4 ? ` … +${r.partage.length - 4}` : ""}`);
        break;
      }
    }
  }

  const local = git("rev-parse", "HEAD");
  if (local !== ref.sha) {
    console.log(`\n⚠ HEAD local (${local.slice(0, 8)}) n'est pas ${ref.rev} : Coolify bâtira ${ref.rev}.`);
  }

  if (aRedeployer.length === 0) {
    console.log(`\n✓ aucun site à redéployer.`);
    return 0;
  }
  console.log(`\n${aRedeployer.length} site(s) à redéployer :`);
  console.log(`  npm run deploy -- ${aRedeployer.join(" ")} --yes`);
  return 1;
}

/* ── rollout ──────────────────────────────────────────────────────────────── */

/**
 * Met l'environnement en conformité PUIS déploie, par site : LA commande
 * « tout redéployer » du parc. Un seul gate `--yes` couvre les deux écritures
 * — sans lui, tout est dry-run : diffs env et plan de déploiement, aucune
 * écriture (que des GET).
 *
 * Par site, séquentiellement : diff env → pose des écarts → déploiement avec
 * attente du verdict. Les variables sont buildtime : un échec de pose rend le
 * site raté SANS déploiement — bâtir sans ses variables produirait le mauvais
 * artefact. L'étape env étant idempotente, la reprise est la même commande
 * sur les ratés : le diff revient vide, puis on redéploie.
 *
 * `--no-wait` est refusé : le contrat de rollout est la convergence VÉRIFIÉE
 * (env conforme + build abouti) ; sans attente, le bilan ne dirait rien.
 */
async function rollout(ctx: CoolifyContext): Promise<number> {
  if (cmd.bool("--no-wait")) {
    console.error(`✗ rollout attend toujours le verdict des builds (--no-wait est réservé à push).`);
    return 2;
  }
  const selection = await resoudreSelection(
    ctx,
    `Usage : npm run deploy:rollout -- <slug…> | --all | --affected  [--yes]`,
  );
  if (!selection) return 2;
  if (selection.length === 0) {
    console.log(`✓ aucun site à traiter (sélection --affected vide).`);
    return 0;
  }
  const timeoutS = timeoutSecondes(); // valider AVANT d'afficher un plan ou de déclencher

  const ref = reference();
  const local = git("rev-parse", "HEAD");
  console.log(`Cible : ${ref.rev} @ ${ref.sha.slice(0, 8)}`);
  if (local !== ref.sha) {
    console.log(`⚠ HEAD local (${local.slice(0, 8)}) n'est pas ${ref.rev} : les commits non poussés ne partiront pas.`);
  }
  const cibles: Array<{ site: SiteEntry; app: CoolifyApp }> = [];
  for (const s of selection) cibles.push(await resoudreSite(ctx, s.slug));
  console.log(`À mettre en conformité puis déployer, dans l'ordre (${cibles.length}) :`);
  for (const c of cibles) console.log(`  ${c.site.slug.padEnd(24)} ${c.app.name}`);

  const enCours = await runningDeployments(ctx);
  if (enCours.length > 0) {
    console.log(`⚠ ${enCours.length} déploiement(s) déjà en file sur l'instance (partagée avec d'autres projets).`);
  }

  if (!cmd.bool("--yes")) {
    console.log("");
    let ecarts = 0;
    for (const [i, c] of cibles.entries()) {
      if (i > 0) console.log("");
      ecarts += (await envDuSite(ctx, c.site, c.app, false)).ecarts;
    }
    const forme = cmd.bool("--all") ? "--all"
      : cmd.bool("--affected") ? "--affected"
      : cibles.map((c) => c.site.slug).join(" ");
    console.log(
      `\nDry-run : rien n'a été écrit ni déclenché — ` +
        `${ecarts} écart(s) d'env à poser, ${cibles.length} déploiement(s) à lancer.`,
    );
    console.log(`Appliquer :  npm run deploy:rollout -- ${forme} --yes`);
    return 0;
  }

  const parSlug = new Map(cibles.map((c) => [c.site.slug, c]));
  const bilan = await executerParSite(
    cibles.map((c) => c.site.slug),
    async (slug) => {
      const { site, app } = parSlug.get(slug)!;
      await envDuSite(ctx, site, app, true);
      console.log("");
      await deployerSite(ctx, app.uuid, true, timeoutS);
    },
    {
      failFast: cmd.bool("--fail-fast"),
      reprise: (s) => `npm run deploy:rollout -- ${s.join(" ")} --yes`,
    },
  );
  avertirBuildsEnVol(bilan.resultats);
  if (JSON_OUT) {
    console.log(JSON.stringify({ resultats: bilan.resultats, reprise: bilan.reprise ?? null }, null, 2));
  }
  return bilan.code;
}

/* ── dns ──────────────────────────────────────────────────────────────────── */

/** Vérifie, et crée si besoin, le CNAME d'amorce d'un site dans la zone 00.re. */
async function dns(): Promise<number> {
  const slug = cmd.positionnels[0];
  if (!slug) {
    console.error(`✗ Usage : npm run deploy:dns -- <slug> [--write]`);
    return 2;
  }
  const site = sitesDuDepot().find((s) => s.slug === slug);
  if (!site) throw new CoolifyError(`Slug "${slug}" absent de sites.json.`);
  const sous = sousDomaineAmorce(site);
  if (!sous || !site.domain) {
    throw new CoolifyError(
      `"${slug}" n'a pas de sous-domaine d'amorce dans ${ZONE_AMORCE}. ` +
        `Ce module ne touche que cette zone ; un domaine propre se pose à la main.`,
    );
  }

  // La cible dépend du SERVEUR qui héberge le site : avec deux serveurs,
  // envoyer tout le monde sur la même adresse enverrait la moitié du trafic
  // sur la mauvaise machine, où Traefik ne connaît pas ces hôtes.
  const cible = cibleDnsDuServeur(site.coolifyServer ?? "localhost");

  const ips = await resoudreDns(site.domain);
  if (await atteintLaMemeCible(site.domain, cible)) {
    console.log(`✓ ${site.domain} atteint déjà ${cible} (${ips.join(", ")}). Rien à faire.`);
    return 0;
  }
  if (ips.length > 0) {
    console.error(`✗ ${site.domain} résout vers ${ips.join(", ")}, qui n'est pas ${cible}.`);
    console.error(`  L'outil n'écrase jamais un enregistrement existant — à corriger à la main.`);
    return 1;
  }

  console.log(`${site.domain} ne résout pas. À créer : CNAME ${sous}.${ZONE_AMORCE} → ${cible}.`);
  if (!cmd.bool("--write")) {
    console.log(`Relancer avec --write pour créer l'enregistrement.`);
    return 1;
  }

  const c = chargerIdentifiants();
  const zones = await listerZones(c);
  if (!zones.includes(ZONE_AMORCE)) {
    throw new OvhError(`Le compte OVH ne détient pas la zone ${ZONE_AMORCE} (zones : ${zones.join(", ")}).`);
  }
  const existant = await trouverCname(c, ZONE_AMORCE, sous);
  if (existant) {
    console.error(`✗ un CNAME ${sous} existe déjà chez OVH, cible "${existant.target}" — non écrasé.`);
    return 1;
  }
  await creerCname(c, ZONE_AMORCE, sous, cible);
  await rafraichirZone(c, ZONE_AMORCE);
  console.log(`✓ CNAME créé et zone publiée. La propagation prend généralement quelques minutes.`);
  return 0;
}

/* ── alias ────────────────────────────────────────────────────────────────── */

/**
 * Attache un domaine propre à un site.
 *
 * Le DNS d'un domaine propre ne nous appartient pas : il se pointe à la main, en
 * CNAME vers le sous-domaine d'amorce. Cette commande ne l'écrit donc jamais —
 * elle VÉRIFIE qu'il résout déjà, puis le déclare à Coolify. Sans cette
 * vérification, Let's Encrypt échouerait sur cet hôte au déploiement suivant.
 */
async function alias(ctx: CoolifyContext): Promise<number> {
  const [slug, domaine] = cmd.positionnels;
  if (!slug || !domaine) {
    console.error(`✗ Usage : npm run deploy:alias -- <slug> <domaine> [--write]`);
    return 2;
  }
  if (domaine.endsWith(`.${ZONE_AMORCE}`)) {
    throw new CoolifyError(
      `"${domaine}" est dans la zone d'amorce : c'est un domaine technique, ` +
        `et il ne peut y en avoir qu'un (champ "domain" de sites.json).`,
    );
  }
  const { site, app } = await resoudreSite(ctx, slug);

  const ips = await resoudreDns(domaine);
  if (!(await atteintLaMemeCible(domaine, site.domain as string))) {
    console.error(`✗ ${domaine} ${ips.length ? `résout vers ${ips.join(", ")}` : "ne résout pas"}.`);
    console.error(`  Attendu : la même cible que ${site.domain}. Poser d'abord, chez le registrar :`);
    console.error(`     CNAME ${domaine} → ${site.domain}`);
    console.error(`  L'ajouter à Coolify maintenant ferait échouer Let's Encrypt sur cet hôte.`);
    return 1;
  }
  console.log(`✓ ${domaine} atteint la même cible que ${site.domain} (${ips.join(", ")}).`);

  if ((site.aliases ?? []).includes(domaine)) {
    console.log(`· déjà déclaré dans sites.json.`);
  }
  const cible = { ...site, aliases: [...new Set([...(site.aliases ?? []), domaine])] };
  const fqdn = coolifyDomains(cible);
  if (normaliserFqdn(app.fqdn ?? "") === normaliserFqdn(fqdn)) {
    console.log(`✓ Coolify sert déjà exactement ces domaines. Rien à faire.`);
    return 0;
  }

  console.log(`Coolify : "${app.fqdn ?? "(aucun)"}" → "${fqdn}"`);
  if (!cmd.bool("--write")) {
    console.log(`Relancer avec --write pour appliquer.`);
    return 1;
  }
  await patchApplication(ctx, app.uuid, { domains: fqdn });
  console.log(`✓ domaines mis à jour.`);
  console.log(`\nDeux choses à faire ensuite :`);
  console.log(`  1. ajouter "${domaine}" au champ "aliases" de ${slug} dans sites.json`);
  console.log(`  2. npm run deploy -- ${slug} --yes    (Traefik ne régénère ses routes qu'au déploiement)`);
  return 0;
}

/* ── create ───────────────────────────────────────────────────────────────── */

/** Crée l'application d'un site déclaré mais pas encore déployé. */
async function create(ctx: CoolifyContext): Promise<number> {
  const slug = cmd.positionnels[0];
  if (!slug) {
    console.error(`✗ Usage : npm run deploy:create -- <slug> [--write]`);
    return 2;
  }
  const site = sitesDuDepot().find((s) => s.slug === slug);
  if (!site) throw new CoolifyError(`Slug "${slug}" absent de sites.json.`);
  if (!site.coolifyApp || !site.domain) {
    throw new CoolifyError(
      `"${slug}" n'a pas de cible de déploiement. Renseigner d'abord "coolifyApp" et "domain" ` +
        `dans sites.json — ils ne sont pas dérivables du slug, il faut les choisir.`,
    );
  }
  const index = await indexApplications(ctx);
  if (index.has(site.coolifyApp)) {
    throw new CoolifyError(
      `L'application "${site.coolifyApp}" existe déjà. Pour la mettre à jour :\n` +
        `  npm run deploy:env -- ${slug} --write   puis   npm run deploy -- ${slug} --yes`,
    );
  }
  const conflit = [...index.values()].find((a) =>
    (a.fqdn ?? "").split(",").some((d) => d.replace(/^https?:\/\//, "").replace(/\/$/, "") === site.domain),
  );
  if (conflit) throw new CoolifyError(`${site.domain} est déjà servi par "${conflit.name}".`);

  // Le placement n'est jamais écrit en dur. Il vient, dans l'ordre : des
  // drapeaux, des champs de l'entrée, sinon du parc — et seulement si celui-ci
  // est homogène. Dès qu'un second serveur ou projet accueille des sites, la
  // déduction refuse plutôt que de choisir à ta place.
  const parc = sitesDeployables()
    .map((s) => index.get(s.coolifyApp as string))
    .filter((a): a is CoolifyApp => a !== undefined);
  const placement = await resoudrePlacement(ctx, parc, {
    serveur: opt("--server") ?? site.coolifyServer,
    projet: opt("--project") ?? site.coolifyProject,
    environnement: opt("--environment"),
  });

  const { variables, manquantes } = variablesAttendues(site);
  console.log(`Créer ${site.coolifyApp} pour ${slug}\n`);
  console.log(`  placement    ${placement.origine}`);
  const build = buildDuSite(site);
  console.log(`  dépôt        ${build.depot} @ ${build.branche}`);
  console.log(`  build        ${build.buildPack}, port ${build.port}`);
  console.log(`  domaine      ${coolifyDomains(site)}`);
  console.log(`  variables    ${variables.length}${manquantes.length ? ` (${manquantes.join(", ")} absente(s) de .env)` : ""}`);
  console.log(`  DNS          ${site.domain}`);

  if (!cmd.bool("--write")) {
    console.log(`\nRelancer avec --write pour créer. Rien n'a été fait.`);
    return 1;
  }

  // 1. DNS d'abord, et on attend : sans lui, Let's Encrypt échoue en HTTP-01.
  const cibleDns = cibleDnsDuServeur(site.coolifyServer ?? "localhost");
  if (!(await atteintLaMemeCible(site.domain, cibleDns))) {
    console.log(`\n[1/4] DNS — ${site.domain} n'atteint pas encore ${cibleDns}`);
    console.error(`  ✗ créer d'abord l'enregistrement :  npm run deploy:dns -- ${slug} --write`);
    return 1;
  }
  console.log(`\n[1/4] DNS ✓ ${site.domain} → ${cibleDns}`);

  // 2. Application, sans instant_deploy : les variables ne sont pas encore là.
  const cree = await createApplication(ctx, {
    project_uuid: placement.projectUuid,
    server_uuid: placement.serverUuid,
    environment_name: placement.environmentName,
    git_repository: build.depot,
    git_branch: build.branche,
    build_pack: build.buildPack,
    ports_exposes: build.port,
    name: site.coolifyApp,
    domains: coolifyDomains(site),
  });
  // L'API de CRÉATION de Coolify tronque une URL GitLab hors github.com (mesuré sur
  // site-json-rezo-sante-reunion, 2026-08-06 : `git_repository` stocké « pixelhumain/site-json.git »
  // → le déployeur tente un ls-remote SSH sans hôte et échoue). Le PATCH, lui, stocke l'URL
  // VERBATIM (c'est la correction manuelle qui a débloqué le premier déploiement) — d'où cette
  // repasse systématique : relire, re-poser le dépôt si Coolify l'a réécrit, re-vérifier.
  const stockee = await getApplication(ctx, cree.uuid);
  if (stockee.git_repository !== build.depot) {
    await patchApplication(ctx, cree.uuid, { git_repository: build.depot });
    const apres = (await getApplication(ctx, cree.uuid)).git_repository;
    if (apres !== build.depot) {
      console.error(`  ✗ dépôt toujours incorrect après correction : ${JSON.stringify(apres)} — à corriger dans Coolify avant de déployer.`);
      return 1;
    }
    console.log(`[2/4] application ✓ ${cree.uuid} (dépôt corrigé : la création l'avait réécrit en ${JSON.stringify(stockee.git_repository)})`);
  } else {
    console.log(`[2/4] application ✓ ${cree.uuid}`);
  }

  // 3. Variables, avant tout déploiement.
  for (const v of variables) {
    await upsertEnv(ctx, cree.uuid, { key: v.key, value: v.value, is_buildtime: true, is_runtime: true }, []);
  }
  console.log(`[3/4] variables ✓ ${variables.length} posées`);

  console.log(`[4/4] déploiement — à lancer :  npm run deploy -- ${slug} --yes`);
  return 0;
}

/* ── Entrée ───────────────────────────────────────────────────────────────── */

async function main(): Promise<number> {
  if (cmd.inconnues.length || cmd.malformees.length) {
    if (cmd.inconnues.length) console.error(`✗ Option(s) inconnue(s) : ${cmd.inconnues.join(", ")}`);
    if (cmd.malformees.length) console.error(`✗ Option(s) sans valeur : ${cmd.malformees.join(", ")}`);
    usage();
  }
  if (!commande || !COMMANDES.includes(commande)) usage();
  const ctx = loadContext(opt("--context"));
  switch (commande) {
    case "status":
      return status(ctx);
    case "lock":
      return lock(ctx);
    case "push":
      return push(ctx);
    case "env":
      return env(ctx);
    case "affected":
      return affected(ctx);
    case "rollout":
      return rollout(ctx);
    case "dns":
      return dns();
    case "alias":
      return alias(ctx);
    case "create":
      return create(ctx);
  }
}

main()
  .then((code) => process.exit(code))
  .catch((e: unknown) => {
    if (e instanceof CoolifyError || e instanceof OvhError) {
      console.error(`✗ ${e.message}`);
      process.exit(2);
    }
    console.error(`✗ ${(e as Error).message}`);
    process.exit(2);
  });
