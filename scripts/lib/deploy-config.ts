/**
 * Le jeu complet de variables d'environnement d'une application Coolify.
 *
 * POURQUOI ce fichier — les 8 variables que porte chaque application viennent de
 * trois endroits différents, et le critère de rangement est toujours le même :
 * est-ce que ça varie par site, et est-ce secret ?
 *
 *   5 dérivées de sites.json   VITE_SLUG, SITE_CONFIG_PATH, SITE_CSS_PATH,
 *                              SITE_IMAGES, SITE_EMBED
 *                              → varient par site, jamais stockées : recalculées
 *
 *   2 constantes ici           VITE_BASE_URL_BACKEND, VITE_SERVER_URL
 *                              → identiques sur les 9 applications (vérifié).
 *                              Les répéter 17 fois dans sites.json serait du
 *                              bruit ; une entrée peut malgré tout les surcharger
 *                              (champ `env`) pour le jour où un site vise la QA.
 *
 *   1 secrète, hors dépôt      VITE_MAPTILER_API_KEY
 *                              → lue dans .env, gitignoré. Sans elle, les cartes
 *                              retombent sur les tuiles libres OSM/Carto : son
 *                              absence dégrade, elle ne casse pas.
 *
 * Toutes sont posées `is_buildtime` ET `is_runtime`, l'état des 9 applications
 * actuelles. Trois d'entre elles n'ont aucun sens au runtime (SITE_CSS_PATH,
 * SITE_IMAGES, SITE_EMBED) et prod-server les ignore ; SITE_CONFIG_PATH, elle,
 * en a un et bascule proprement sur la config figée. Cf. doc/16.
 */
import fs from "node:fs";
import path from "node:path";
import { buildVars, ROOT, type SiteEntry } from "./sites";

/**
 * Comment ce dépôt se construit, quel que soit le site.
 *
 * Ces valeurs ne sont PAS déduites d'une application existante, et c'est
 * délibéré : il faut pouvoir créer un site sur un serveur où il n'y a encore
 * rien. Ce sont des faits sur le dépôt lui-même, identiques pour les 17 sites
 * par construction — les déclarer par site serait du bruit, les déduire d'un
 * voisin serait impossible le jour où il n'y a pas de voisin.
 *
 * `status` vérifie que les applications déployées s'y conforment encore : si
 * l'une d'elles dérive, c'est visible plutôt que silencieux.
 */
export const BUILD = {
  depot: "https://gitlab.adullact.net/pixelhumain/site-json.git",
  branche: "main",
  buildPack: "dockerfile",
  port: "3000",
} as const;

/** Valeurs communes à tout le parc, surchargeables par entrée. */
export const CONSTANTES: Record<string, string> = {
  VITE_BASE_URL_BACKEND: "https://www.communecter.org",
  VITE_SERVER_URL: "https://www.communecter.org",
};

/** Variables lues dans `.env`, jamais versionnées. */
export const SECRETES = ["VITE_MAPTILER_API_KEY"] as const;

/**
 * Mini-lecteur de `.env` — le dépôt en a déjà deux copies (`config-probe.ts`,
 * `entity-slug.ts`) ; celle-ci est la troisième et devrait les remplacer un jour.
 * Volontairement sans dotenv : on ne veut PAS peupler process.env, seulement lire.
 */
export function lireDotEnv(root: string = ROOT): Record<string, string> {
  const p = path.join(root, ".env");
  if (!fs.existsSync(p)) return {};
  const out: Record<string, string> = {};
  for (const ligne of fs.readFileSync(p, "utf-8").split("\n")) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(ligne);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

export interface VariableAttendue {
  key: string;
  value: string;
  origine: "dérivée" | "constante" | "secrète";
  /** Vrai si la valeur ne doit pas être imprimée en clair. */
  sensible: boolean;
}

/**
 * Le jeu attendu pour un site. `manquantes` liste les variables secrètes
 * introuvables : c'est une information, pas forcément une erreur.
 */
export function variablesAttendues(
  site: SiteEntry,
  root: string = ROOT,
): { variables: VariableAttendue[]; manquantes: string[] } {
  const variables: VariableAttendue[] = Object.entries(buildVars(site)).map(([key, value]) => ({
    key,
    value,
    origine: "dérivée",
    sensible: false,
  }));

  const surcharges = (site as SiteEntry & { env?: Record<string, string> }).env ?? {};
  for (const [key, defaut] of Object.entries(CONSTANTES)) {
    variables.push({ key, value: surcharges[key] ?? defaut, origine: "constante", sensible: false });
  }

  const env = lireDotEnv(root);
  const manquantes: string[] = [];
  for (const key of SECRETES) {
    const v = surcharges[key] ?? env[key];
    if (v === undefined) manquantes.push(key);
    else variables.push({ key, value: v, origine: "secrète", sensible: true });
  }

  return { variables, manquantes };
}

/** Masque une valeur sensible pour l'affichage. */
export const masquer = (v: string): string =>
  v.length <= 8 ? "•".repeat(v.length) : `${v.slice(0, 4)}…${v.slice(-3)}`;
