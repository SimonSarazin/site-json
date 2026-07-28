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
 * Où et comment poser une nouvelle application : serveur, projet, environnement,
 * dépôt, branche, moteur de build, port.
 *
 * Rien de tout cela n'est écrit en dur. Ces valeurs sont LUES sur une
 * application déjà déployée, prise pour modèle. C'est le même raisonnement que
 * pour `coolifyApp` : un UUID figé dans le dépôt le lierait à une instance et
 * deviendrait faux à la première recréation. Ici, un site créé atterrit par
 * construction exactement là où vivent ses voisins.
 */
export interface Placement {
  serverUuid: string;
  destinationUuid?: string;
  projectUuid: string;
  environmentName: string;
  gitRepository: string;
  gitBranch: string;
  buildPack: string;
  portsExposes: string;
  modele: string;
}

export const listProjects = (ctx: CoolifyContext): Promise<CoolifyProject[]> =>
  api<CoolifyProject[]>(ctx, "GET", "/projects");

export const getProject = (ctx: CoolifyContext, uuid: string): Promise<CoolifyProject> =>
  api<CoolifyProject>(ctx, "GET", `/projects/${uuid}`);

/** Déduit le placement d'après une application existante. */
export async function placementDapres(ctx: CoolifyContext, modele: CoolifyApp): Promise<Placement> {
  const app = await getApplication(ctx, modele.uuid);
  const serverUuid = app.destination?.server?.uuid;
  if (!serverUuid) {
    throw new CoolifyError(`Impossible de lire le serveur de "${modele.name}" — placement indéterminable.`);
  }

  let projectUuid: string | undefined;
  let environmentName: string | undefined;
  for (const p of await listProjects(ctx)) {
    const detail = await getProject(ctx, p.uuid);
    const env = detail.environments?.find((e) => e.id === app.environment_id);
    if (env) {
      projectUuid = p.uuid;
      environmentName = env.name;
      break;
    }
  }
  if (!projectUuid || !environmentName) {
    throw new CoolifyError(
      `Aucun projet ne contient l'environnement ${app.environment_id} de "${modele.name}".`,
    );
  }

  return {
    serverUuid,
    destinationUuid: app.destination?.uuid,
    projectUuid,
    environmentName,
    gitRepository: app.git_repository,
    gitBranch: app.git_branch,
    buildPack: app.build_pack ?? "dockerfile",
    portsExposes: app.ports_exposes ?? "3000",
    modele: modele.name,
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
export class CoolifyError extends Error {}

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

async function api<T>(
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
    });
  } catch (e) {
    throw new CoolifyError(`${method} ${route} — instance injoignable : ${(e as Error).message}`);
  }

  const texte = await res.text();
  if (!res.ok) {
    // Le message de l'API est bien plus parlant que le code seul (conflit de
    // domaine, champ non autorisé…) : on le remonte tel quel, tronqué.
    throw new CoolifyError(`${method} ${route} → HTTP ${res.status} : ${texte.slice(0, 300)}`);
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

/** Le dernier déploiement mené à terme, ou `undefined` si l'app n'a jamais abouti. */
export async function lastSuccessfulDeployment(
  ctx: CoolifyContext,
  uuid: string,
): Promise<CoolifyDeployment | undefined> {
  return (await applicationDeployments(ctx, uuid)).find((d) => d.status === "finished");
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
