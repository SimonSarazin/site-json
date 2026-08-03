/**
 * Classe un fichier modifié du point de vue d'UN site : le concerne-t-il ?
 *
 * POURQUOI — les N sites partagent le même code générateur. La question « que
 * redéployer après ces commits ? » n'a donc pas de réponse évidente : un
 * changement dans `src/` les concerne tous, un changement dans
 * `config.prod.parent62.json` n'en concerne qu'un.
 *
 * La valeur de cette classification n'est pas de RÉDUIRE la liste — un
 * changement partagé la ramène à tout le monde, et c'est correct. Elle est de
 * répondre « ce commit ne concerne que tel site » avec une preuve plutôt qu'une
 * intuition, et surtout d'identifier les commits qui ne concernent PERSONNE :
 * doc, tests, scripts. C'est le cas le plus fréquent.
 *
 * Trois classes, du point de vue du site S :
 *   propre    — fichier de S (sa config, son CSS, son dossier d'images)
 *   partagé   — code du générateur : tout le monde doit être reconstruit
 *   neutre    — ne finit pas dans l'image, OU appartient à un AUTRE site
 *
 * Le défaut est « partagé », par prudence : un fichier nouveau et inconnu doit
 * provoquer un redéploiement plutôt que d'être ignoré en silence.
 */
import { asList, type SiteEntry } from "./sites";

export type Classe = "propre" | "partagé" | "neutre";

/**
 * Chemins qui ne finissent jamais dans l'image de production.
 *
 * `scripts/` en fait partie, et c'est vérifiable : `npm run build` enchaîne
 * `tsc -b` (qui ne compile que `tsconfig.app.json`, `include: ["src"]`, et
 * `tsconfig.node.json`, `include: ["vite.config.ts"]`) puis `vite build`. Rien
 * de `scripts/` n'entre dans le bundle.
 */
const NEUTRES = [
  /^doc\//,
  /^doc-projets\//,
  /^commentaire\//,
  /^tests\//,
  /^e2e\//,
  /^scripts\//,
  /^\.claude\//,
  /^\.husky\//,
  /^[^/]*\.md$/,
  /^eslint\.config\.js$/,
  /^vitest\.config.*\.ts$/,
  /^playwright\.config\.ts$/,
  /^knip\.json$/,
  /^\.gitignore$/,
  /^\.dockerignore$/,
  // sites.json est neutre EN MODE MONO-SITE, et seulement là. Les 9 applications
  // passent SITE_CSS_PATH, SITE_CONFIG_PATH, SITE_IMAGES et SITE_EMBED en clair
  // (vérifié) : les plugins de build n'ont donc jamais besoin de consulter la
  // table des slugs, et le niveau 4 de prod-server — le seul autre consommateur —
  // ne peut pas se déclencher dans un conteneur, l'étape runner ne copiant pas ce
  // fichier. Sans cette règle, ajouter un domaine ou un site ferait dire à l'outil
  // « redéployer les neuf », ce qui est faux et ruinerait sa crédibilité.
  // ⚠ À revoir si un déploiement venait à ne fournir que VITE_SLUG : le lookup
  // CSS redeviendrait alors actif, et ce fichier redeviendrait partagé.
  /^sites\.json$/,
];

/** Les chemins qu'un site possède en propre. */
export function cheminsDuSite(site: SiteEntry): { fichiers: string[]; dossiers: string[] } {
  return {
    fichiers: [site.config, `src/${site.css}.css`],
    dossiers: asList(site.images).map((d) => `public/images/${d}/`),
  };
}

const appartientA = (chemin: string, site: SiteEntry): boolean => {
  const { fichiers, dossiers } = cheminsDuSite(site);
  return fichiers.includes(chemin) || dossiers.some((d) => chemin.startsWith(d));
};

/**
 * Classe un chemin pour le site donné. `tous` sert à reconnaître les fichiers
 * appartenant à un AUTRE site — ils sont neutres pour celui-ci, et c'est tout
 * l'intérêt : sans cette étape, modifier la config de parent62 redéploierait
 * les neuf.
 */
export function classer(chemin: string, site: SiteEntry, tous: SiteEntry[]): Classe {
  if (appartientA(chemin, site)) return "propre";
  if (tous.some((autre) => autre.slug !== site.slug && appartientA(chemin, autre))) return "neutre";
  if (NEUTRES.some((re) => re.test(chemin))) return "neutre";
  return "partagé";
}

export interface Impact {
  propre: string[];
  partage: string[];
  neutre: string[];
  /** Vrai dès qu'un fichier propre ou partagé a bougé. */
  aRedeployer: boolean;
}

export function impact(fichiers: string[], site: SiteEntry, tous: SiteEntry[]): Impact {
  const r: Impact = { propre: [], partage: [], neutre: [], aRedeployer: false };
  for (const f of fichiers) {
    const c = classer(f, site, tous);
    if (c === "propre") r.propre.push(f);
    else if (c === "partagé") r.partage.push(f);
    else r.neutre.push(f);
  }
  r.aRedeployer = r.propre.length > 0 || r.partage.length > 0;
  return r;
}
