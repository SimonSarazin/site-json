/**
 * Lecture de `sites.json` et dérivation des variables de build d'un site.
 *
 * POURQUOI — `sites.json` est la seule source de vérité du parc : quel fichier
 * de config, quel CSS, quel dossier d'images, et depuis le chantier déploiement,
 * quel domaine et quelle application Coolify. Les six variables que le build
 * attend (`VITE_SLUG`, `SITE_CSS_PATH`, `SITE_IMAGES`, `SITE_CONFIG_PATH`,
 * `SITE_EMBED`, `VITE_SITE_PUBLIC_URL`) s'en DÉDUISENT entièrement — les recopier à la main quelque part
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
  /**
   * Sous-domaine d'AMORCE, dans la zone `00.re`. Toujours exactement un.
   * C'est le domaine technique : l'outil crée son CNAME vers `00.re.`, il existe
   * dès la mise en place et ne dépend de personne d'autre.
   */
  domain?: string;
  /**
   * Domaines PROPRES du site, ex. `www.tiers-lieux.org`. Leur DNS vit ailleurs
   * — souvent chez le client — et se pointe À LA MAIN en CNAME vers le
   * sous-domaine d'amorce. L'outil ne les crée jamais : il se contente de les
   * déclarer à Coolify, et vérifie qu'ils résolvent déjà avant de le faire.
   */
  aliases?: string[];
  /**
   * NOM du serveur et du projet Coolify où poser ce site, quand le parc n'est
   * pas homogène. Absents, ils sont déduits des sites déjà déployés — ce qui ne
   * vaut que tant qu'ils vivent tous au même endroit. Des noms, pas des UUID,
   * pour la même raison que `coolifyApp`.
   */
  coolifyServer?: string;
  coolifyProject?: string;
  /**
   * Surcharge du build pour ce site : dépôt, branche, moteur, port. Absent, les
   * valeurs communes de `deploy-config.ts` s'appliquent. Sert au site de recette
   * sur une autre branche, ou repris d'un autre dépôt.
   */
  build?: Partial<{ depot: string; branche: string; buildPack: string; port: string }>;
  /**
   * Surcharge, pour CE site, d'une variable d'environnement déployée.
   *
   * ⚠ N'accepte que les clés déclarées dans `CONSTANTES` ou `SECRETES`
   * (`deploy-config.ts`) : `variablesAttendues` ne consulte ce champ que pour
   * celles-là. Une clé écrite ici sans y figurer est ignorée en silence — pour
   * rendre une variable surchargeable par site, il faut d'abord l'ajouter à
   * l'une des deux listes.
   *
   * Ex. allumer le drapeau de dépannage costum sur un seul site :
   * `"env": { "VITE_COSTUM_FORCE_LIVE": "true" }`
   */
  env?: Record<string, string>;
}

/** Zone DNS d'amorce : la seule que l'outil ait le droit d'écrire. */
export const ZONE_AMORCE = "00.re";

/** Les six variables que le build attend, dérivées d'une entrée. */
export interface BuildVars {
  VITE_SLUG: string;
  SITE_CSS_PATH: string;
  SITE_IMAGES: string;
  SITE_CONFIG_PATH: string;
  SITE_EMBED: string;
  VITE_SITE_PUBLIC_URL: string;
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
    // URL PUBLIQUE du site (canonical, og:url/og:image, sitemap, RSS) — lue par
    // `getSitePublicUrl()` et `server/lib/sitemap.js`. Le domaine PROPRE
    // (`aliases[0]`) prime sur le sous-domaine d'amorce : c'est l'adresse que
    // les visiteurs et les moteurs doivent retenir. Sans domaine declare, ""
    // → repli runtime sur `getServerUrl()` (comportement historique).
    // Ne PAS confondre avec VITE_SERVER_URL (= communecter : images /upload,
    // embed co2, cagnotte), qui garde sa valeur parc.
    VITE_SITE_PUBLIC_URL: site.aliases?.[0]
      ? `https://${site.aliases[0]}`
      : site.domain
        ? `https://${site.domain}`
        : "",
  };
}

/** Tous les hôtes servis par le site : l'amorce d'abord, puis ses domaines propres. */
export const tousLesDomaines = (site: SiteEntry): string[] =>
  [...(site.domain ? [site.domain] : []), ...(site.aliases ?? [])];

/** Le FQDN tel que Coolify l'attend : protocole obligatoire, virgules en séparateur. */
export const coolifyDomains = (site: SiteEntry): string =>
  tousLesDomaines(site)
    .map((d) => (/^https?:\/\//.test(d) ? d : `https://${d}`))
    .join(",");

/** L'étiquette à créer dans la zone d'amorce, ex. `institut-bleu` pour `institut-bleu.00.re`. */
export function sousDomaineAmorce(site: SiteEntry): string | null {
  if (!site.domain?.endsWith(`.${ZONE_AMORCE}`)) return null;
  return site.domain.slice(0, -`.${ZONE_AMORCE}`.length);
}

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
