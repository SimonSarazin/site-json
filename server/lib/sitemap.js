/**
 * Génération de robots.txt et sitemap.xml à partir des pages de la config du site.
 *
 * Logique pure (aucun accès fichier/réseau) → testée dans server/__tests__/sitemap.test.ts.
 * Les routes Express sont branchées via registerSeoRoutes() dans dev-server.js et
 * prod-server.js, AVANT le fallback SSR (sinon le SSR rendrait du HTML sur ces URLs).
 */

/** Retire les slashes finaux du baseUrl pour éviter les doubles slashes en concaténation. */
function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "").replace(/\/+$/, "");
}

/** Échappe les 5 entités XML — les paths de config peuvent contenir & ou des quotes. */
function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Une page est référençable si :
 *  - elle a un path interne (commence par "/" — exclut les liens externes éventuels) ;
 *  - elle n'est pas paramétrée (`/profil/:slug`, wildcards) : une URL avec placeholder
 *    n'est pas une URL réelle, Google la traiterait en 404 ;
 *  - elle n'est pas marquée `seo.noIndex` (le sitemap ne doit lister que l'indexable,
 *    sinon signaux contradictoires noindex ↔ sitemap pour les crawlers) ;
 *  - elle n'est pas GARDÉE (`auth.required`, `auth.access`, `auth.roles`, middleware
 *    `auth-required`/`admin-only`). Une page dont l'accès est conditionné n'a rien à faire dans un sitemap :
 *    on invitait activement les crawlers sur une page réservée, servie en 200 avec tout son
 *    contenu (la garde `usePageGuards` vit dans un `useEffect`, jamais exécuté au SSR).
 */

/**
 * MIROIR JS de `isGatedPage` (src/lib/pageAccess.ts) — ce fichier est chargé directement par
 * node (prod-server), sans transformation TypeScript, donc il ne peut pas importer le module TS.
 * Les deux implémentations sont confrontées sur la même matrice par server/__tests__/sitemap.test.ts :
 * toute évolution de la règle doit toucher les DEUX.
 */
function isGatedPage(page) {
  if (!page) return false;
  if (page?.auth?.required === true) return true;
  if (typeof page?.auth?.access === "string" && page.auth.access.length > 0) return true;
  if (Array.isArray(page?.auth?.roles) && page.auth.roles.length > 0) return true;
  const mw = page?.middleware;
  return Array.isArray(mw) && (mw.includes("auth-required") || mw.includes("admin-only"));
}

function isIndexablePage(page) {
  const path = page?.path;
  if (typeof path !== "string" || !path.startsWith("/")) return false;
  if (path.includes(":") || path.includes("*")) return false;
  if (page?.seo?.noIndex === true) return false;
  if (isGatedPage(page)) return false;
  return true;
}

/**
 * Construit le sitemap.xml (protocole sitemaps.org 0.9) des pages publiques.
 * @param {Array<{path?: string, seo?: {noIndex?: boolean}}>} pages pages[] de la config
 * @param {string} baseUrl origine publique du site (ex. https://parents62.org)
 * @returns {string} document XML
 */
export { isGatedPage };

export function buildSitemapXml(pages, baseUrl) {
  const base = normalizeBaseUrl(baseUrl);
  // Set : une config peut théoriquement déclarer deux fois le même path → une seule <url>.
  const seen = new Set();
  const urls = [];
  for (const page of Array.isArray(pages) ? pages : []) {
    if (!isIndexablePage(page) || seen.has(page.path)) continue;
    seen.add(page.path);
    urls.push(`  <url><loc>${escapeXml(`${base}${page.path}`)}</loc></url>`);
  }
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
    ``,
  ].join("\n");
}

/**
 * Construit le robots.txt : tout autorisé + pointeur vers le sitemap
 * (l'exclusion fine se fait page par page via la meta noindex, pas ici).
 * @param {string} baseUrl origine publique du site
 */
export function buildRobotsTxt(baseUrl) {
  const base = normalizeBaseUrl(baseUrl);
  return `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`;
}

/**
 * Branche GET /robots.txt et GET /sitemap.xml sur l'app Express.
 * Partagé entre dev-server et prod-server (déduplication).
 *
 * @param {import("express").Express} app
 * @param {() => object} getConfig accesseur de la config COURANTE — en dev la config
 *   est rechargée par un watcher, donc on ne fige pas une copie au moment du boot.
 */
export function registerSeoRoutes(app, getConfig) {
  // Domaine public : VITE_SITE_PUBLIC_URL prioritaire — la MÊME clé que le
  // client (`getSitePublicUrl()` : canonical/og), posée par la chaîne
  // `deploy:env` (dérivée de sites.json : aliases[0] sinon domain) et par
  // dev-server (localhost). `SITE_PUBLIC_URL` conservé en repli legacy (nom
  // historique de ce fichier, jamais déployé mais peut-être posé à la main),
  // puis PUBLIC_BASE_URL (même notion côté helloasso-checkout.js), sinon
  // l'host de la requête — qui donne `http://` derrière le proxy Coolify
  // (pas de trust proxy), d'où l'importance de la variable.
  const resolveBaseUrl = (req) =>
    process.env.VITE_SITE_PUBLIC_URL ||
    process.env.SITE_PUBLIC_URL ||
    process.env.PUBLIC_BASE_URL ||
    `${req.protocol}://${req.get("host")}`;

  app.get("/robots.txt", (req, res) => {
    res.type("text/plain; charset=utf-8").send(buildRobotsTxt(resolveBaseUrl(req)));
  });

  app.get("/sitemap.xml", (req, res) => {
    const config = getConfig();
    res
      .type("application/xml; charset=utf-8")
      .send(buildSitemapXml(config?.pages ?? [], resolveBaseUrl(req)));
  });
}
