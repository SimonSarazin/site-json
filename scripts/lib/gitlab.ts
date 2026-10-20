/**
 * Accès à l'API GitLab de gitlab.adullact.net — par `glab api`, pas par `fetch`.
 *
 * POURQUOI `glab` et pas un token dans `.env` : le token reste dans le keyring
 * du poste (`glab auth login`, une fois), rien à dupliquer dans un fichier que
 * `mr-review prepare` symlinke ensuite dans chaque worktree. L'identité est
 * celle du relecteur par construction — c'est la décision prise pour la review
 * des MR (note postée depuis son propre compte). Qui n'a pas de keyring peut
 * poser `GITLAB_TOKEN` : `glab` le lit lui-même.
 *
 * POURQUOI des ids NUMÉRIQUES partout : sur cette instance, le reverse proxy
 * refuse le slash encodé — `projects/pixelhumain%2Fsite-json/...` renvoie un
 * 404 HTML Apache. Toutes les commandes haut niveau de `glab` (`mr view`,
 * `mr list`) passent par cette forme et sont donc inutilisables ; seul
 * `glab api projects/<id>/...` fonctionne. Mesuré le 2026-10-07.
 */
import { execFileSync } from "node:child_process";

export const HOST = "gitlab.adullact.net";

/** Erreur d'outillage — l'appelant doit sortir en code 2, jamais 1. */
export class GitlabError extends Error {
  /** Vrai si l'échec est plausiblement passager (réseau, 429, 502-504). */
  constructor(message: string, public readonly transitoire: boolean = false) {
    super(message);
  }
}

export interface GitlabUser {
  id: number;
  username: string;
  name: string;
}

export interface GitlabProject {
  id: number;
  path_with_namespace: string;
  web_url: string;
}

export interface MergeRequest {
  iid: number;
  title: string;
  description: string | null;
  state: "opened" | "closed" | "merged" | "locked";
  source_branch: string;
  target_branch: string;
  sha: string;
  web_url: string;
  has_conflicts: boolean;
  detailed_merge_status?: string;
  changes_count?: string;
  project_id: number;
  source_project_id: number;
  author: GitlabUser;
  reviewers?: GitlabUser[];
  updated_at: string;
}

export interface Note {
  id: number;
  body: string;
  system: boolean;
  author: GitlabUser;
  created_at: string;
}

type Methode = "GET" | "POST";

const dormirMs = (ms: number) => new Promise((r) => setTimeout(r, ms));
const TRANSITOIRE = /\b(429|502|503|504)\b|rate limit|timed? ?out|ECONNRESET|EAI_AGAIN/i;
/**
 * Anubis, le garde anti-bot de l'instance : sur une rafale d'appels il renvoie
 * une page HTML « Making sure you're not a bot! » à la place du JSON (mesuré
 * le 2026-10-07, 3 appels en < 1 s). Passager : on espace, on réessaie.
 */
const ANUBIS = /not a bot|within\.website|anubis/i;
/** Espacement minimal entre deux appels, pour ne pas réveiller Anubis. */
const ESPACEMENT_MS = 400;
let dernierAppel = 0;

/** Un appel `glab api` brut. `champs` = options `-F clé=valeur` (ou `-F body=@fichier`). */
function appel<T>(method: Methode, route: string, champs: string[] = []): T {
  const args = ["api", "--hostname", HOST, "-X", method, route];
  for (const c of champs) args.push("-F", c);
  let sortie: string;
  try {
    sortie = execFileSync("glab", args, { encoding: "utf-8", timeout: 30_000, stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { stderr?: string; stdout?: string };
    if (err.code === "ENOENT") {
      throw new GitlabError("`glab` introuvable. Installer le CLI GitLab puis `glab auth login --hostname " + HOST + "`.");
    }
    const detail = `${err.stderr ?? ""}${err.stdout ?? ""}`.trim();
    if (/not logged|no token|401|authentication/i.test(detail)) {
      throw new GitlabError(`glab n'est pas authentifié sur ${HOST} : \`glab auth login --hostname ${HOST}\`.`);
    }
    if (/<html|404 Not Found/i.test(detail)) {
      throw new GitlabError(
        `${method} ${route} → 404 du proxy. Sur ${HOST} les routes à projet encodé (owner%2Frepo) sont refusées : utiliser l'id numérique du projet.`,
      );
    }
    throw new GitlabError(`${method} ${route} → ${detail.slice(0, 300) || (err as Error).message}`, TRANSITOIRE.test(detail));
  }
  if (!sortie.trim()) return undefined as T;
  try {
    return JSON.parse(sortie) as T;
  } catch {
    if (ANUBIS.test(sortie)) {
      throw new GitlabError(`${method} ${route} → défi anti-bot (Anubis) à la place du JSON : trop d'appels rapprochés.`, true);
    }
    throw new GitlabError(`${method} ${route} → réponse non JSON : ${sortie.slice(0, 200)}`);
  }
}

/**
 * UNE retentative, sur GET seulement, après 5 s (l'instance limite par IP).
 * Jamais sur POST : rejouer `notes` après une réponse perdue posterait la
 * note en double.
 */
async function api<T>(method: Methode, route: string, champs: string[] = []): Promise<T> {
  const essais = method === "GET" ? 2 : 1;
  for (let essai = 1; ; essai++) {
    const attente = dernierAppel + ESPACEMENT_MS - Date.now();
    if (attente > 0) await dormirMs(attente);
    dernierAppel = Date.now();
    try {
      return appel<T>(method, route, champs);
    } catch (e) {
      const transitoire = e instanceof GitlabError && e.transitoire;
      if (essai >= essais || !transitoire) throw e;
      await dormirMs(8_000);
    }
  }
}

/** L'utilisateur du token : c'est lui qui signera la note. */
export const moi = (): Promise<GitlabUser> => api<GitlabUser>("GET", "user");

/** `git@host:owner/repo.git` ou `https://host/owner/repo.git` → `owner/repo`. */
export function cheminDepuisRemote(url: string): string | null {
  const m = /^(?:git@[^:]+:|https?:\/\/[^/]+\/)(.+?)(?:\.git)?\/?$/.exec(url.trim());
  return m ? m[1] : null;
}

/**
 * Résout l'id numérique du projet depuis l'URL du remote. Passe par
 * `projects?search=` (route sans slash encodé) puis filtre sur le chemin exact.
 */
export async function resoudreProjet(remoteUrl: string): Promise<GitlabProject> {
  const chemin = cheminDepuisRemote(remoteUrl);
  if (!chemin) throw new GitlabError(`Remote illisible : ${remoteUrl}`);
  const nom = chemin.split("/").pop()!;
  const projets = await api<GitlabProject[]>("GET", `projects?search=${encodeURIComponent(nom)}&simple=true&per_page=50`);
  const trouve = projets.find((p) => p.path_with_namespace === chemin);
  if (!trouve) {
    throw new GitlabError(
      `Projet ${chemin} introuvable sur ${HOST} (candidats : ${projets.map((p) => p.path_with_namespace).join(", ") || "aucun"}).`,
    );
  }
  return trouve;
}

export const mergeRequest = (pid: number, iid: number): Promise<MergeRequest> =>
  api<MergeRequest>("GET", `projects/${pid}/merge_requests/${iid}`);

/** Les MR ouvertes dont je suis reviewer — la file d'attente de relecture. */
export const mesMergeRequests = (pid: number, meId: number): Promise<MergeRequest[]> =>
  api<MergeRequest[]>("GET", `projects/${pid}/merge_requests?state=opened&reviewer_id=${meId}&per_page=50&order_by=updated_at`);

export const notes = (pid: number, iid: number): Promise<Note[]> =>
  api<Note[]>("GET", `projects/${pid}/merge_requests/${iid}/notes?per_page=100&sort=desc&order_by=created_at`);

/** POST d'une note depuis un fichier markdown (`-F body=@fichier`, forme validée en prod). */
export const posterNote = (pid: number, iid: number, fichier: string): Promise<Note> =>
  api<Note>("POST", `projects/${pid}/merge_requests/${iid}/notes`, [`body=@${fichier}`]);
