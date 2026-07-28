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
 *   npm run deploy:status                     état du parc
 *   npm run deploy:status -- --json           idem, parsable
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
  CoolifyError,
  indexByName,
  lastSuccessfulDeployment,
  loadContext,
  type CoolifyApp,
  type CoolifyContext,
  type CoolifyDeployment,
} from "./lib/coolify";
import { asList, coolifyDomains, deployableSites, loadSites, ROOT, type SiteEntry } from "./lib/sites";

const argv = process.argv.slice(2);
const COMMANDES = ["status"] as const;
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

Options :
  --context <nom>     instance Coolify (défaut : celle marquée par défaut)
  --ref <rev>         référence de comparaison (défaut : origin/main)
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

/* ── Entrée ───────────────────────────────────────────────────────────────── */

async function main(): Promise<number> {
  if (!commande || !COMMANDES.includes(commande)) usage();
  const ctx = loadContext(opt("--context"));
  switch (commande) {
    case "status":
      return status(ctx);
  }
}

main()
  .then((code) => process.exit(code))
  .catch((e: unknown) => {
    if (e instanceof CoolifyError) {
      console.error(`✗ ${e.message}`);
      process.exit(2);
    }
    console.error(`✗ ${(e as Error).message}`);
    process.exit(2);
  });
