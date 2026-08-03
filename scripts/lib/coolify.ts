/**
 * Client minimal de l'API Coolify v4.
 *
 * POURQUOI ne pas passer par le CLI `coolify` — il couvre bien la lecture et le
 * déclenchement, mais deux besoins lui échappent : le réglage
 * `is_auto_deploy_enabled` (jamais exposé en écriture) et le marquage
 * `is_buildtime` des variables (le flag `--build-time` du CLI envoie
 * `is_build_time`, avec un underscore de trop, que l'API rejette en 422). Passer
 * par l'API évite d'avoir à composer avec ces deux trous, et rend l'outil
 * indépendant de la version du CLI installée.
 *
 * L'authentification réutilise le contexte du CLI (`~/.config/coolify/config.json`)
 * plutôt que d'inventer une variable d'environnement : le token y est déjà, il
 * n'a pas à être dupliqué ni à transiter par le dépôt.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface CoolifyContext {
  name: string;
  fqdn: string;
  token: string;
}

export interface CoolifyApp {
  uuid: string;
  name: string;
  fqdn: string | null;
  status: string;
  git_branch: string;
  git_repository: string;
  git_commit_sha: string | null;
  watch_paths: string | null;
  build_pack?: string;
  ports_exposes?: string;
  environment_id?: number;
  destination?: { uuid?: string; server?: { uuid?: string; name?: string } };
}

export interface CoolifyProject {
  uuid: string;
  name: string;
  environments?: Array<{ id: number; uuid: string; name: string }>;
}

/**
 * OÙ poser une application : serveur, projet, environnement.
 *
 * Uniquement des identifiants résolus à chaud depuis des NOMS — jamais d'UUID
 * versionné, qui lierait le dépôt à une instance et deviendrait faux à la
 * première recréation.
 *
 * Le COMMENT — dépôt git, branche, moteur de build, port — n'est délibérément
 * pas ici : ce sont des constantes de `deploy-config.ts`, faits du dépôt
 * lui-même. Les déduire d'une application voisine rendrait impossible la
 * création sur un serveur où il n'y a encore rien.
 */
export interface Placement {
  serverUuid: string;
  projectUuid: string;
  environmentName: string;
  /** D'où vient ce placement — déclaré, complété, ou déduit. */
  origine: string;
}

export const listProjects = (ctx: CoolifyContext): Promise<CoolifyProject[]> =>
  api<CoolifyProject[]>(ctx, "GET", "/projects");

export const getProject = (ctx: CoolifyContext, uuid: string): Promise<CoolifyProject> =>
  api<CoolifyProject>(ctx, "GET", `/projects/${uuid}`);

export interface CoolifyServer {
  uuid: string;
  name: string;
}

export const listServers = (ctx: CoolifyContext): Promise<CoolifyServer[]> =>
  api<CoolifyServer[]>(ctx, "GET", "/servers");

/** Le projet et l'environnement qui contiennent un `environment_id` donné. */
async function projetDeLEnvironnement(
  ctx: CoolifyContext,
  environmentId: number | undefined,
): Promise<{ projectUuid: string; projectName: string; environmentName: string } | null> {
  if (environmentId === undefined) return null;
  for (const p of await listProjects(ctx)) {
    const detail = await getProject(ctx, p.uuid);
    const env = detail.environments?.find((e) => e.id === environmentId);
    if (env) return { projectUuid: p.uuid, projectName: p.name, environmentName: env.name };
  }
  return null;
}

/** Où vit une application déjà déployée — sert au diagnostic et à la déduction. */
export interface Emplacement {
  serverUuid: string;
  serverName: string;
  projectUuid: string;
  projectName: string;
  environmentName: string;
}

export async function emplacementDe(
  ctx: CoolifyContext,
  app: CoolifyApp,
): Promise<Emplacement | null> {
  const complet = app.destination ? app : await getApplication(ctx, app.uuid);
  const serverUuid = complet.destination?.server?.uuid;
  const serverName = complet.destination?.server?.name;
  const projet = await projetDeLEnvironnement(ctx, complet.environment_id);
  if (!serverUuid || !serverName || !projet) return null;
  return { serverUuid, serverName, ...projet };
}

export interface ChoixPlacement {
  serveur?: string;
  projet?: string;
  environnement?: string;
}

/** Résout un nom de serveur et un nom de projet vers leurs identifiants. */
async function parLesNoms(
  ctx: CoolifyContext,
  serveur: string,
  projet: string,
  environnement?: string,
): Promise<Placement> {
  const serveurs = await listServers(ctx);
  const s = serveurs.find((x) => x.name === serveur);
  if (!s) {
    throw new CoolifyError(
      `Serveur "${serveur}" inconnu. Disponibles : ${serveurs.map((x) => x.name).join(", ") || "aucun"}`,
    );
  }
  const projets = await listProjects(ctx);
  const p = projets.find((x) => x.name === projet);
  if (!p) {
    throw new CoolifyError(
      `Projet "${projet}" inconnu. Disponibles : ${projets.map((x) => x.name).join(", ") || "aucun"}`,
    );
  }
  const envs = (await getProject(ctx, p.uuid)).environments ?? [];
  const env = environnement
    ? envs.find((e) => e.name === environnement)
    : (envs.find((e) => e.name === "production") ?? envs[0]);
  if (!env) {
    throw new CoolifyError(
      `Environnement ${environnement ? `"${environnement}" ` : ""}introuvable dans "${p.name}" ` +
        `(${envs.map((e) => e.name).join(", ") || "aucun"}).`,
    );
  }
  return {
    serverUuid: s.uuid,
    projectUuid: p.uuid,
    environmentName: env.name,
    origine: `${s.name} / ${p.name} / ${env.name}`,
  };
}

/**
 * Détermine où créer une application.
 *
 *   1. DÉCLARÉ — drapeaux `--server`/`--project`, ou champs `coolifyServer` /
 *      `coolifyProject` de l'entrée. C'est la voie normale, et la SEULE qui
 *      fonctionne sur un serveur où il n'y a encore rien.
 *   2. DÉDUIT du parc — commodité, valable uniquement s'il est homogène.
 *
 * La déduction n'est pas la fondation : elle suppose un voisin, et un serveur
 * neuf n'en a pas. Elle refuse dès que le parc est réparti ou vide, plutôt que
 * de choisir à la place de l'utilisateur.
 */
export async function resoudrePlacement(
  ctx: CoolifyContext,
  parc: CoolifyApp[],
  choix: ChoixPlacement = {},
): Promise<Placement> {
  // 1. Entièrement déclaré : le parc n'est même pas consulté.
  if (choix.serveur && choix.projet) {
    const p = await parLesNoms(ctx, choix.serveur, choix.projet, choix.environnement);
    return { ...p, origine: `déclaré : ${p.origine}` };
  }

  const emplacements = (await Promise.all(parc.map((a) => emplacementDe(ctx, a)))).filter(
    (e): e is Emplacement => e !== null,
  );
  const distincts = [
    ...new Map(
      emplacements.map((e) => [`${e.serverName}/${e.projectName}/${e.environmentName}`, e]),
    ).values(),
  ];
  const aDeclarer =
    `  Déclarer où créer le site : --server <nom> --project <nom>,\n` +
    `  ou les champs "coolifyServer" et "coolifyProject" de son entrée dans sites.json.`;

  if (distincts.length === 0) {
    throw new CoolifyError(`Aucun emplacement déductible : le parc est vide sur cette instance.\n${aDeclarer}`);
  }
  if (distincts.length > 1) {
    throw new CoolifyError(
      `Le parc est réparti sur plusieurs emplacements — ` +
        `${distincts.map((e) => `${e.serverName}/${e.projectName}/${e.environmentName}`).join(", ")} — ` +
        `« prendre le premier » serait un choix arbitraire.\n${aDeclarer}`,
    );
  }

  // 2. Un seul emplacement : déduction, ou complément d'une déclaration partielle.
  const ref = distincts[0];
  if (choix.serveur || choix.projet || choix.environnement) {
    const p = await parLesNoms(
      ctx,
      choix.serveur ?? ref.serverName,
      choix.projet ?? ref.projectName,
      choix.environnement,
    );
    return { ...p, origine: `complété : ${p.origine}` };
  }
  return {
    serverUuid: ref.serverUuid,
    projectUuid: ref.projectUuid,
    environmentName: ref.environmentName,
    origine: `déduit du parc : ${ref.serverName} / ${ref.projectName} / ${ref.environmentName}`,
  };
}

export interface CoolifyEnv {
  uuid: string;
  key: string;
  value: string;
  is_buildtime: boolean;
  is_runtime: boolean;
}

export interface CoolifyDeployment {
  id?: number;
  deployment_uuid?: string;
  application_name?: string;
  application_id?: string;
  status?: string;
  commit?: string;
  commit_message?: string;
  is_webhook?: boolean;
  created_at?: string;
  finished_at?: string;
}

/** Erreur d'outillage — l'appelant doit sortir en code 2, jamais 1. */
export class CoolifyError extends Error {
  /** Vrai si l'échec est plausiblement passager (réseau, 429, 502-504). */
  constructor(message: string, public readonly transitoire: boolean = false) {
    super(message);
  }
}

const configPath = (): string =>
  process.platform === "win32"
    ? path.join(process.env.APPDATA ?? "", "coolify", "config.json")
    : path.join(os.homedir(), ".config", "coolify", "config.json");

/**
 * Contexte du CLI. `name` permet de viser une instance précise, sinon celle
 * marquée par défaut.
 */
export function loadContext(name?: string): CoolifyContext {
  const p = configPath();
  if (!fs.existsSync(p)) {
    throw new CoolifyError(
      `Configuration Coolify introuvable (${p}). Créer un contexte :\n` +
        `  coolify context add -d <nom> https://<instance> <token>`,
    );
  }
  let cfg: { instances?: Record<string, CoolifyContext & { default?: boolean }> };
  try {
    cfg = JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch (e) {
    throw new CoolifyError(`${p} illisible : ${(e as Error).message}`);
  }
  const all = Object.values(cfg.instances ?? {});
  if (all.length === 0) throw new CoolifyError(`Aucune instance dans ${p}.`);

  const found = name ? all.find((i) => i.name === name) : all.find((i) => i.default);
  if (!found) {
    const dispo = all.map((i) => i.name).join(", ");
    throw new CoolifyError(
      name
        ? `Contexte "${name}" inconnu. Disponibles : ${dispo}`
        : `Aucun contexte par défaut. Disponibles : ${dispo} — en choisir un avec --context.`,
    );
  }
  if (!found.token) throw new CoolifyError(`Le contexte "${found.name}" n'a pas de token.`);
  return { name: found.name, fqdn: found.fqdn.replace(/\/+$/, ""), token: found.token };
}

const dormirMs = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Statuts HTTP transitoires : rate-limit et passerelle — un 2e essai a un sens. */
const STATUTS_TRANSITOIRES = new Set([429, 502, 503, 504]);

async function api<T>(
  ctx: CoolifyContext,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  route: string,
  body?: unknown,
): Promise<T> {
  // UNE retentative, sur GET seulement. Rejouer un POST après une réponse
  // perdue déclencherait un second build (/deploy) ; rejouer un PATCH laisse
  // planer un doute sur l'état — le coût du doute dépasse le gain. Un GET, lui,
  // est sans effet de bord : erreur réseau ou statut transitoire → 2 s, retry.
  const essais = method === "GET" ? 2 : 1;
  for (let essai = 1; ; essai++) {
    try {
      return await appel<T>(ctx, method, route, body);
    } catch (e) {
      const transitoire = e instanceof CoolifyError && e.transitoire;
      if (essai >= essais || !transitoire) throw e;
      await dormirMs(2_000);
    }
  }
}

async function appel<T>(
  ctx: CoolifyContext,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  route: string,
  body?: unknown,
): Promise<T> {
  const url = `${ctx.fqdn}/api/v1${route}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${ctx.token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      // Sans borne, un socket suspendu (proxy, instance qui redémarre) bloque
      // la commande — et donc tout un lot — indéfiniment.
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    throw new CoolifyError(`${method} ${route} — instance injoignable : ${(e as Error).message}`, true);
  }

  const texte = await res.text();
  if (!res.ok) {
    // Le message de l'API est bien plus parlant que le code seul (conflit de
    // domaine, champ non autorisé…) : on le remonte tel quel, tronqué.
    throw new CoolifyError(
      `${method} ${route} → HTTP ${res.status} : ${texte.slice(0, 300)}`,
      STATUTS_TRANSITOIRES.has(res.status),
    );
  }
  if (!texte.trim()) return undefined as T;
  try {
    return JSON.parse(texte) as T;
  } catch {
    throw new CoolifyError(`${method} ${route} → réponse non JSON : ${texte.slice(0, 200)}`);
  }
}

export const listApplications = (ctx: CoolifyContext): Promise<CoolifyApp[]> =>
  api<CoolifyApp[]>(ctx, "GET", "/applications");

export const getApplication = (ctx: CoolifyContext, uuid: string): Promise<CoolifyApp> =>
  api<CoolifyApp>(ctx, "GET", `/applications/${uuid}`);

export const listEnvs = (ctx: CoolifyContext, uuid: string): Promise<CoolifyEnv[]> =>
  api<CoolifyEnv[]>(ctx, "GET", `/applications/${uuid}/envs`);

/** Déploiements en file ou en cours, toutes applications confondues. */
export const runningDeployments = (ctx: CoolifyContext): Promise<CoolifyDeployment[]> =>
  api<CoolifyDeployment[]>(ctx, "GET", "/deployments");

/**
 * Historique des déploiements d'une application, le plus récent d'abord.
 *
 * C'est la SEULE source du commit réellement déployé : le champ
 * `git_commit_sha` de l'application vaut « HEAD », c'est-à-dire la consigne de
 * suivi de branche, pas un état.
 *
 * ⚠ La pagination n'est pas un confort. Chaque entrée embarque ses `logs`
 * en ligne, soit ~500 Ko : une application à 27 déploiements rapatrierait 8 Mo
 * pour la seule information « quel commit ». D'où `take` par défaut à 5, et le
 * champ `logs` jeté au parse.
 */
export async function applicationDeployments(
  ctx: CoolifyContext,
  uuid: string,
  take = 5,
): Promise<CoolifyDeployment[]> {
  const r = await api<CoolifyDeployment[] | { deployments?: CoolifyDeployment[] }>(
    ctx,
    "GET",
    `/deployments/applications/${uuid}?skip=0&take=${take}`,
  );
  const liste = Array.isArray(r) ? r : (r?.deployments ?? []);
  return liste.map(({ ...d }) => {
    delete (d as Record<string, unknown>).logs;
    return d;
  });
}

/**
 * Le dernier déploiement mené à terme, ou `undefined` si l'app n'a jamais abouti.
 *
 * Take PROGRESSIF : dans le cas courant, le déploiement le plus récent est
 * `finished` — `take=1` suffit (~500 Ko transférés au lieu de 2,5 Mo, × N sites
 * pour `status`/`affected`). S'il ne l'est pas (dernier build raté ou en
 * cours), on re-demande `take=5` : `take=1` seul serait FAUX, un dernier
 * déploiement raté masquerait le précédent réussi.
 */
export async function lastSuccessfulDeployment(
  ctx: CoolifyContext,
  uuid: string,
): Promise<CoolifyDeployment | undefined> {
  const [recent] = await applicationDeployments(ctx, uuid, 1);
  if (!recent || recent.status === "finished") return recent;
  return (await applicationDeployments(ctx, uuid, 5)).find((d) => d.status === "finished");
}

/**
 * Déclenche un déploiement. `force` saute le cache d'image : Coolify élude le
 * build quand une image du même commit existe déjà et qu'il juge la
 * configuration inchangée — nos N sites partagent le commit et ne diffèrent que
 * par leurs build args, autant ne pas dépendre de cette heuristique.
 *
 * POST et non GET : les deux marchent en 4.1.x, mais Coolify 4.2 refuse le GET.
 */
export async function deployApplication(
  ctx: CoolifyContext,
  uuid: string,
  force = true,
): Promise<string | undefined> {
  const r = await api<{ deployments?: Array<{ deployment_uuid?: string; message?: string }> }>(
    ctx,
    "POST",
    "/deploy",
    { uuid, force },
  );
  return r?.deployments?.[0]?.deployment_uuid;
}

export const patchApplication = (
  ctx: CoolifyContext,
  uuid: string,
  body: Record<string, unknown>,
): Promise<unknown> => api(ctx, "PATCH", `/applications/${uuid}`, body);

/**
 * Pose une variable. L'API refuse un POST sur une clé existante (409) et un
 * PATCH sur une clé absente : on choisit selon ce qui est déjà là.
 */
export async function upsertEnv(
  ctx: CoolifyContext,
  uuid: string,
  env: { key: string; value: string; is_buildtime?: boolean; is_runtime?: boolean },
  existantes: CoolifyEnv[],
): Promise<"créée" | "modifiée"> {
  const deja = existantes.some((e) => e.key === env.key);
  await api(ctx, deja ? "PATCH" : "POST", `/applications/${uuid}/envs`, {
    key: env.key,
    value: env.value,
    is_buildtime: env.is_buildtime ?? true,
    is_runtime: env.is_runtime ?? true,
  });
  return deja ? "modifiée" : "créée";
}

/**
 * Crée une application depuis un dépôt git public.
 *
 * `instant_deploy` est volontairement absent : déployer avant d'avoir posé les
 * variables produirait le thème par défaut et une config non figée. L'ordre
 * application → variables → déploiement n'est pas négociable.
 */
export const createApplication = (
  ctx: CoolifyContext,
  payload: Record<string, unknown>,
): Promise<{ uuid: string }> => api(ctx, "POST", "/applications/public", payload);

/** Index nom → application, pour résoudre les `coolifyApp` de sites.json. */
export async function indexByName(ctx: CoolifyContext): Promise<Map<string, CoolifyApp>> {
  const apps = await listApplications(ctx);
  return new Map(apps.map((a) => [a.name, a]));
}
