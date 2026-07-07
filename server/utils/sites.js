import fs from "fs";
import path from "path";

/**
 * Lecture de `sites.json` — la table slug → { config, css, images } du dépôt.
 *
 * Ces fonctions sont PURES : elles ne mutent pas `process.env`. C'est important
 * parce que dev-server.js, lui, DOIT muter `process.env.SITE_CONFIG_PATH` après
 * la résolution (son watcher de config et la sauvegarde de l'AdminPanel relisent
 * cette variable plus tard). Cet effet de bord reste chez l'appelant, il ne
 * descend pas ici — prod-server n'en a aucun usage et le subir brouillerait sa
 * précédence.
 *
 * Renvoie `[]` quand `sites.json` est absent : c'est le cas normal dans l'image
 * Docker, dont l'étape runner ne copie que `dist/` et `server/`.
 */
export function loadSitesJson(root = process.cwd()) {
  const sitesPath = path.resolve(root, "sites.json");
  if (!fs.existsSync(sitesPath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(sitesPath, "utf-8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn(`[sites.json] illisible (${e.message})`);
    return [];
  }
}

/** L'entrée correspondant au slug, ou `null` — jamais d'exception. */
export function findSiteBySlug(slug, root = process.cwd()) {
  if (!slug) return null;
  return loadSitesJson(root).find((s) => s.slug === slug) || null;
}

/** Les slugs connus, pour les messages d'erreur. */
export function knownSlugs(root = process.cwd()) {
  return loadSitesJson(root).map((s) => s.slug);
}
