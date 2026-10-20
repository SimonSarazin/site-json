/**
 * Normalise un lien VENU DE LA BASE (`navigatorcriteria.url` / `.urlTool`, et les
 * liens de la fiche d'un commun) avant de le confier à `classifyHref`.
 *
 * Le contrat 4 voies de `src/lib/linkKind.ts` a été écrit pour des liens de CONFIG,
 * saisis par un intégrateur. Ces liens-ci sont saisis par un admin dans une modale —
 * ou hérités du legacy —, et le serveur tolère DÉLIBÉRÉMENT la forme sans schéma :
 * `SaveCriteriaAction::safeUrl` la conserve parce que le legacy enregistre des liens
 * de commun nus (mesuré en base : `lescommuns.tiers-lieux.org#detail-un-commun.…`
 * sur l'outil Peertube).
 *
 * Or `classifyHref` range tout ce qui n'a ni schéma ni `//` ni `#` dans `internal`.
 * Un lien nu partirait donc dans React Router, tomberait sur la route attrape-tout et
 * rendrait la PAGE D'ACCUEIL en 200 — le silence exact que `linkKind` a été écrit pour
 * empêcher. On lui redonne son schéma avant de le classer.
 *
 * Ce qui n'est PAS touché, et doit rester intact :
 *  - `/aac/commun/<id>` — une route du site, c'est tout l'intérêt : navigation SPA,
 *    même onglet, pas de rechargement complet ;
 *  - `https://…`, `//…`, `mailto:`, `tel:` — déjà classables ;
 *  - `#ancre` — ancre de la page courante.
 *
 * Fonction PURE et SSR-safe (aucun accès `window`) : le rendu serveur et l'hydratation
 * doivent trancher identiquement, sinon React remonte une divergence d'hydratation.
 */

/** Un schéma d'URI en tête : `https:`, `mailto:`, `tel:`… (RFC 3986). */
const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

export function normalizeToolHref(url: string | null | undefined): string {
  const brut = (url ?? "").trim();
  if (brut === "") return "";
  // Route du site, protocole-relatif, ancre, ou schéma explicite : rien à faire.
  if (brut.startsWith("/") || brut.startsWith("#") || SCHEME_RE.test(brut)) return brut;
  // Reste la forme nue (`exemple.org/x`) : sans schéma, une ancre HTML la lirait
  // comme un chemin RELATIF à la page courante.
  return `https://${brut}`;
}
