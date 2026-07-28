/**
 * Pilote les déploiements Coolify du parc depuis le dépôt.
 *
 * POURQUOI — les N sites de ce dépôt sont N applications Coolify qui pointent
 * toutes le MÊME dépôt et la MÊME branche. Coolify ne filtre les webhooks que
 * sur (dépôt, branche) : un push déclencherait donc les N. Cet outil prend le
 * contre-pied — aucune automatisation implicite, on nomme ce qu'on déploie, et
 * les déploiements s'enchaînent un par un.
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
 *
 * Options communes :
 *   --context <nom>   viser une instance Coolify précise
 *   --ref <rev>       référence de comparaison (défaut : origin/main, la branche
 *                     que Coolify bâtit — surtout pas le HEAD local)
 *   --json            sortie machine
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
import { masquer, variablesAttendues } from "./lib/deploy-config";
import { impact } from "./lib/deploy-scope";
import { IP_SERVEUR, pointeVersLeServeur, resoudre as resoudreDns } from "./lib/dns";
import { chargerIdentifiants, creerCname, listerZones, OvhError, rafraichirZone, trouverCname } from "./lib/ovh";
import {
  asList, coolifyDomains, deployableSites, loadSites, sousDomaineAmorce,
  ROOT, ZONE_AMORCE, type SiteEntry,
} from "./lib/sites";

const argv = process.argv.slice(2);
const COMMANDES = ["status", "lock", "push", "env", "affected", "dns", "alias", "create"] as const;
type Commande = (typeof COMMANDES)[number];

const commande = argv.find((a) => !a.startsWith("--")) as Commande | undefined;
const JSON_OUT = argv.includes("--json");
const opt = (nom: string): string | undefined => {
  const i = argv.indexOf(nom);
  return i >= 0 ? argv[i + 1] : undefined;
};

function usage(): never {
  console.error(`Usage : npm run deploy:<commande> [-- options]

Commandes :
  status              état du parc : site ↔ application ↔ domaine ↔ commit déployé
  lock [--unlock]     coupe (ou rétablit) le déploiement automatique sur push
  push <slug…>        déploie les sites nommés, un par un
  env <slug> [--write]  compare (et pose) les 8 variables du site
  affected            quels sites les commits non déployés concernent-ils
  dns <slug> [--write]         vérifie/crée le CNAME d'amorce dans la zone 00.re
  alias <slug> <dom> [--write] attache un domaine propre (DNS déjà pointé)
  create <slug> [--write]      crée l'application d'un site déclaré

Options :
  --context <nom>     instance Coolify (défaut : celle marquée par défaut)
  --ref <rev>         référence de comparaison (défaut : origin/main)
  --yes               applique sans confirmation (lock, push)
  --no-wait           push : déclenche sans attendre la fin
  --timeout <s>       push : abandon de l'attente (défaut 1500)
  --json              sortie machine`);
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
  const sites = loadSites();
  const cibles = deployableSites();
  const index = await indexByName(ctx);

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
  const unlock = argv.includes("--unlock");
  const cible = !unlock;
  const cibles = deployableSites();
  const index = await indexByName(ctx);

  const aTraiter = cibles
    .map((s) => ({ site: s, app: index.get(s.coolifyApp as string) }))
    .filter((x) => x.app !== undefined);

  console.log(
    `${unlock ? "Rétablir" : "Couper"} le déploiement automatique sur ${aTraiter.length} application(s) :`,
  );
  for (const { site, app } of aTraiter) console.log(`  ${site.slug.padEnd(24)} ${app!.name}`);

  if (!argv.includes("--yes")) {
    console.log(`\nRelancer avec --yes pour appliquer. Rien n'a été modifié.`);
    return 0;
  }

  let echecs = 0;
  for (const { site, app } of aTraiter) {
    try {
      await patchApplication(ctx, app!.uuid, { is_auto_deploy_enabled: cible });
      console.log(`  ✓ ${site.slug}`);
    } catch (e) {
      echecs++;
      console.error(`  ✗ ${site.slug} : ${(e as Error).message}`);
    }
  }
  console.log(
    `\n${aTraiter.length - echecs}/${aTraiter.length} appliqué(s).` +
      ` L'API 4.1.1 ne renvoie pas ce réglage : vérifier dans l'UI Coolify, onglet Advanced.`,
  );
  return echecs === 0 ? 0 : 1;
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
    const file = await runningDeployments(ctx);
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

async function push(ctx: CoolifyContext): Promise<number> {
  const slugs = argv.filter((a) => !a.startsWith("--")).slice(1);
  if (slugs.length === 0) {
    console.error(
      `✗ Aucun site nommé. Cet outil ne déploie jamais « tout » implicitement.\n` +
        `  Usage : npm run deploy -- <slug> [<slug>…]`,
    );
    return 2;
  }

  const index = await indexByName(ctx);
  const cibles: Array<{ slug: string; nom: string; uuid: string }> = [];
  for (const slug of slugs) {
    const site = loadSites().find((s) => s.slug === slug);
    if (!site) throw new CoolifyError(`Slug "${slug}" absent de sites.json.`);
    if (!site.coolifyApp) throw new CoolifyError(`"${slug}" n'a pas d'application déclarée (champ coolifyApp).`);
    const app = index.get(site.coolifyApp);
    if (!app) throw new CoolifyError(`Application "${site.coolifyApp}" introuvable sur l'instance.`);
    cibles.push({ slug, nom: app.name, uuid: app.uuid });
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

  if (!argv.includes("--yes")) {
    console.log(`\nRelancer avec --yes pour lancer. Rien n'a été déclenché.`);
    return 0;
  }

  const timeoutS = Number(opt("--timeout") ?? 1500);
  const attendreFin = !argv.includes("--no-wait");
  let i = 0;
  for (const c of cibles) {
    i++;
    console.log(`\n[${i}/${cibles.length}] ${c.slug}`);
    const dep = await deployApplication(ctx, c.uuid, true);
    if (!dep) {
      console.error(`  ✗ déclenchement refusé par Coolify`);
      console.error(`\nInterrompu. Non déployés : ${cibles.slice(i - 1).map((x) => x.slug).join(", ")}`);
      return 1;
    }
    console.log(`  ✓ déclenché — ${dep}`);
    if (!attendreFin) continue;

    const statut = await attendre(ctx, c.uuid, dep, timeoutS);
    if (statut === "finished") {
      console.log(`  ✓ ${statut}`);
    } else {
      console.error(`  ✗ ${statut} — ${ctx.fqdn}/project (voir les logs du déploiement ${dep})`);
      const restants = cibles.slice(i).map((x) => x.slug);
      if (restants.length) {
        console.error(`\nInterrompu. Reprendre :  npm run deploy -- ${restants.join(" ")} --yes`);
      }
      return 1;
    }
  }
  console.log(`\n✓ ${cibles.length}/${cibles.length} déployé(s).`);
  return 0;
}

/* ── env ──────────────────────────────────────────────────────────────────── */

/** Résout un slug vers son application, ou lève. */
async function resoudreSite(
  ctx: CoolifyContext,
  slug: string,
): Promise<{ site: SiteEntry; app: CoolifyApp }> {
  const site = loadSites().find((s) => s.slug === slug);
  if (!site) throw new CoolifyError(`Slug "${slug}" absent de sites.json.`);
  if (!site.coolifyApp) throw new CoolifyError(`"${slug}" n'a pas d'application déclarée (champ coolifyApp).`);
  const app = (await indexByName(ctx)).get(site.coolifyApp);
  if (!app) throw new CoolifyError(`Application "${site.coolifyApp}" introuvable sur l'instance.`);
  return { site, app };
}

/**
 * Compare les variables attendues à celles posées sur l'application.
 *
 * Ne supprime jamais : une variable présente côté Coolify mais hors du jeu
 * attendu est signalée, pas retirée. Elle peut avoir été posée exprès.
 */
async function env(ctx: CoolifyContext): Promise<number> {
  const slug = argv.filter((a) => !a.startsWith("--"))[1];
  if (!slug) {
    console.error(`✗ Usage : npm run deploy:env -- <slug> [--write]`);
    return 2;
  }
  const { site, app } = await resoudreSite(ctx, slug);
  const { variables, manquantes } = variablesAttendues(site);
  const posees = await listEnvs(ctx, app.uuid);
  const parCle = new Map(posees.map((e) => [e.key, e]));

  console.log(`${slug} → ${app.name}\n`);
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

  if (aEcrire.length === 0) {
    console.log(`\n✓ aucun écart.`);
    return 0;
  }
  if (!argv.includes("--write")) {
    console.log(`\n${aEcrire.length} écart(s). Relancer avec --write pour appliquer.`);
    return 1;
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
  console.log(`\n✓ ${aEcrire.length} variable(s) appliquée(s). Un déploiement est nécessaire pour qu'elles prennent effet :`);
  console.log(`  npm run deploy -- ${slug} --yes`);
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
  const tous = loadSites();
  const cibles = deployableSites();
  const index = await indexByName(ctx);
  const ref = reference();

  console.log(`Référence : ${ref.rev} @ ${ref.sha.slice(0, 8)}\n`);

  const aRedeployer: string[] = [];
  for (const site of cibles) {
    const app = index.get(site.coolifyApp as string);
    if (!app) {
      console.log(`${site.slug.padEnd(24)} ✗ application introuvable`);
      continue;
    }
    const dernier = await lastSuccessfulDeployment(ctx, app.uuid);
    const base = dernier?.commit;
    if (!base) {
      console.log(`${site.slug.padEnd(24)} · jamais déployé`);
      continue;
    }
    if (!resoudre(base)) {
      console.log(`${site.slug.padEnd(24)} ✗ commit ${base.slice(0, 8)} inconnu localement — « git fetch » ?`);
      continue;
    }

    const fichiers = git("diff", "--name-only", `${base}..${ref.sha}`).split("\n").filter(Boolean);
    if (fichiers.length === 0) {
      console.log(`${site.slug.padEnd(24)} ✓ à jour`);
      continue;
    }
    const r = impact(fichiers, site, tous);
    if (!r.aRedeployer) {
      console.log(`${site.slug.padEnd(24)} ✓ à jour (${r.neutre.length} fichier(s) sans effet sur l'image)`);
      continue;
    }
    aRedeployer.push(site.slug);
    console.log(`${site.slug.padEnd(24)} ⟶ à redéployer, depuis ${base.slice(0, 8)}`);
    if (r.propre.length) console.log(`    propre au site   ${r.propre.slice(0, 4).join(", ")}${r.propre.length > 4 ? ` … +${r.propre.length - 4}` : ""}`);
    if (r.partage.length) console.log(`    partagé          ${r.partage.slice(0, 4).join(", ")}${r.partage.length > 4 ? ` … +${r.partage.length - 4}` : ""}`);
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

/* ── dns ──────────────────────────────────────────────────────────────────── */

/** Vérifie, et crée si besoin, le CNAME d'amorce d'un site dans la zone 00.re. */
async function dns(): Promise<number> {
  const slug = argv.filter((a) => !a.startsWith("--"))[1];
  if (!slug) {
    console.error(`✗ Usage : npm run deploy:dns -- <slug> [--write]`);
    return 2;
  }
  const site = loadSites().find((s) => s.slug === slug);
  if (!site) throw new CoolifyError(`Slug "${slug}" absent de sites.json.`);
  const sous = sousDomaineAmorce(site);
  if (!sous || !site.domain) {
    throw new CoolifyError(
      `"${slug}" n'a pas de sous-domaine d'amorce dans ${ZONE_AMORCE}. ` +
        `Ce module ne touche que cette zone ; un domaine propre se pose à la main.`,
    );
  }

  const ips = await resoudreDns(site.domain);
  if (ips.includes(IP_SERVEUR)) {
    console.log(`✓ ${site.domain} pointe déjà ${IP_SERVEUR}. Rien à faire.`);
    return 0;
  }
  if (ips.length > 0) {
    console.error(`✗ ${site.domain} résout vers ${ips.join(", ")} au lieu de ${IP_SERVEUR}.`);
    console.error(`  L'outil n'écrase jamais un enregistrement existant — à corriger à la main.`);
    return 1;
  }

  console.log(`${site.domain} ne résout pas. À créer : CNAME ${sous}.${ZONE_AMORCE} → ${ZONE_AMORCE}.`);
  if (!argv.includes("--write")) {
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
  await creerCname(c, ZONE_AMORCE, sous, ZONE_AMORCE);
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
  const [, slug, domaine] = argv.filter((a) => !a.startsWith("--"));
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
  if (!ips.includes(IP_SERVEUR)) {
    console.error(`✗ ${domaine} ${ips.length ? `résout vers ${ips.join(", ")}` : "ne résout pas"}.`);
    console.error(`  Attendu : ${IP_SERVEUR}. Poser d'abord, chez le registrar du domaine :`);
    console.error(`     CNAME ${domaine} → ${site.domain}`);
    console.error(`  L'ajouter à Coolify maintenant ferait échouer Let's Encrypt sur cet hôte.`);
    return 1;
  }
  console.log(`✓ ${domaine} pointe ${IP_SERVEUR}.`);

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
  if (!argv.includes("--write")) {
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

const DEPOT = "https://gitlab.adullact.net/pixelhumain/site-json.git";
const BRANCHE = "main";
const SERVEUR_UUID = "z8ocs84ows4cgccwgkcccww4";
const PROJET_UUID = "i8skksssgcgwsskcwwg44kgk";
const ENVIRONNEMENT = "production";

/** Crée l'application d'un site déclaré mais pas encore déployé. */
async function create(ctx: CoolifyContext): Promise<number> {
  const slug = argv.filter((a) => !a.startsWith("--"))[1];
  if (!slug) {
    console.error(`✗ Usage : npm run deploy:create -- <slug> [--write]`);
    return 2;
  }
  const site = loadSites().find((s) => s.slug === slug);
  if (!site) throw new CoolifyError(`Slug "${slug}" absent de sites.json.`);
  if (!site.coolifyApp || !site.domain) {
    throw new CoolifyError(
      `"${slug}" n'a pas de cible de déploiement. Renseigner d'abord "coolifyApp" et "domain" ` +
        `dans sites.json — ils ne sont pas dérivables du slug, il faut les choisir.`,
    );
  }
  const index = await indexByName(ctx);
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

  const { variables, manquantes } = variablesAttendues(site);
  console.log(`Créer ${site.coolifyApp} pour ${slug}\n`);
  console.log(`  dépôt        ${DEPOT} @ ${BRANCHE}`);
  console.log(`  domaine      ${coolifyDomains(site)}`);
  console.log(`  variables    ${variables.length}${manquantes.length ? ` (${manquantes.join(", ")} absente(s) de .env)` : ""}`);
  console.log(`  DNS          ${site.domain}`);

  if (!argv.includes("--write")) {
    console.log(`\nRelancer avec --write pour créer. Rien n'a été fait.`);
    return 1;
  }

  // 1. DNS d'abord, et on attend : sans lui, Let's Encrypt échoue en HTTP-01.
  if (!(await pointeVersLeServeur(site.domain))) {
    console.log(`\n[1/4] DNS — ${site.domain} ne résout pas encore`);
    console.error(`  ✗ créer d'abord l'enregistrement :  npm run deploy:dns -- ${slug} --write`);
    return 1;
  }
  console.log(`\n[1/4] DNS ✓ ${site.domain} → ${IP_SERVEUR}`);

  // 2. Application, sans instant_deploy : les variables ne sont pas encore là.
  const cree = await createApplication(ctx, {
    project_uuid: PROJET_UUID,
    server_uuid: SERVEUR_UUID,
    environment_name: ENVIRONNEMENT,
    git_repository: DEPOT,
    git_branch: BRANCHE,
    build_pack: "dockerfile",
    ports_exposes: "3000",
    name: site.coolifyApp,
    domains: coolifyDomains(site),
  });
  console.log(`[2/4] application ✓ ${cree.uuid}`);

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
