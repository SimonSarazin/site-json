/**
 * Lecture de `sites.json` et dérivation des variables de build d'un site.
 *
 * POURQUOI — `sites.json` est la seule source de vérité du parc : quel fichier
 * de config, quel CSS, quel dossier d'images, et depuis le chantier déploiement,
 * quel domaine et quelle application Coolify. Les cinq variables que le build
 * attend (`VITE_SLUG`, `SITE_CSS_PATH`, `SITE_IMAGES`, `SITE_CONFIG_PATH`,
 * `SITE_EMBED`) s'en DÉDUISENT entièrement — les recopier à la main quelque part
 * serait une seconde source, donc une divergence en puissance.
 *
 * Ce module est partagé par `scripts/deploy.ts` et par le préflight
 * `tests/preflight/deploy-targets.test.ts` : la dérivation est testée là où elle
 * est utilisée.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export interface SiteEntry {
  slug: string;
  config: string;
  css: string;
  /** Nom du (ou des) dossier(s) de `public/images/`. Absent = tous embarqués. */
  images?: string | string[];
  /**
   * NOM de l'application Coolify, pas son UUID : un UUID lierait le dépôt à une
   * instance et deviendrait faux à la moindre recréation. L'outil résout
   * nom → uuid à chaque exécution.
   */
  coolifyApp?: string;
  /** Hôte(s) sans protocole, ex. `institut-bleu.00.re`. */
  domain?: string | string[];
}

/** Les cinq variables que le build attend, dérivées d'une entrée. */
export interface BuildVars {
  VITE_SLUG: string;
  SITE_CSS_PATH: string;
  SITE_IMAGES: string;
  SITE_CONFIG_PATH: string;
  SITE_EMBED: string;
}

export function loadSites(root: string = ROOT): SiteEntry[] {
  const p = path.join(root, "sites.json");
  const parsed: unknown = JSON.parse(fs.readFileSync(p, "utf-8"));
  if (!Array.isArray(parsed)) throw new Error(`${p} : tableau attendu`);
  return parsed as SiteEntry[];
}

/** Normalise un champ `string | string[] | undefined` en tableau. */
export const asList = (v: string | string[] | undefined): string[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];

export const findSite = (slug: string, root: string = ROOT): SiteEntry | undefined =>
  loadSites(root).find((s) => s.slug === slug);

/** Les entrées qui ont une cible de déploiement (app + domaine). */
export const deployableSites = (root: string = ROOT): SiteEntry[] =>
  loadSites(root).filter((s) => s.coolifyApp);

/**
 * Dérive les cinq variables de build. `SITE_CSS_PATH` prend le préfixe `./src/`
 * et le suffixe `.css` ; `SITE_CONFIG_PATH` le préfixe `./` — exactement les
 * formes attendues par les plugins de `vite.config.ts`, qui résolvent les
 * chemins relatifs depuis la racine du dépôt.
 */
export function buildVars(site: SiteEntry): BuildVars {
  return {
    VITE_SLUG: site.slug,
    SITE_CSS_PATH: `./src/${site.css}.css`,
    SITE_IMAGES: asList(site.images).join(","),
    SITE_CONFIG_PATH: `./${site.config}`,
    SITE_EMBED: "true",
  };
}

/** Le FQDN tel que Coolify l'attend : protocole obligatoire, virgules en séparateur. */
export const coolifyDomains = (site: SiteEntry): string =>
  asList(site.domain)
    .map((d) => (/^https?:\/\//.test(d) ? d : `https://${d}`))
    .join(",");

/**
 * Les chemins du dépôt qui n'appartiennent qu'à ce site. Sert à `deploy:affected`
 * pour distinguer « seul ce site a bougé » de « le générateur a bougé, tout le
 * monde doit être reconstruit ».
 */
export function siteOwnedPaths(site: SiteEntry): string[] {
  return [
    site.config,
    `src/${site.css}.css`,
    ...asList(site.images).map((d) => `public/images/${d}/`),
  ];
}
