/**
 * Redirection vers l'hôte canonique : apex nu ↔ `www.`.
 *
 * Un site qui prend un domaine propre (premier alias de `sites.json` →
 * `VITE_SITE_PUBLIC_URL`) sert aussi la variante jumelle de cet hôte — l'apex nu
 * d'une canonique en `www.` (`parent62.org` pour `www.parent62.org`), ou le `www.`
 * d'une canonique nue — déclarée à Coolify pour que Let's Encrypt lui émette un
 * certificat. Sans redirection, les deux hôtes servent le même site : sessions
 * et mesures coupées en deux, et une adresse visible qui n'est pas la canonique.
 *
 * La règle se déduit de l'env déjà posée, sans configuration, et se résout UNE
 * fois au montage : la requête GET/HEAD arrivant sur l'hôte jumeau part en 301
 * vers l'URL publique, chemin et query conservés. Tout autre hôte passe — en
 * particulier le sous-domaine d'amorce (`parent62.00.re`), qui doit continuer de
 * répondre pendant une bascule DNS.
 *
 * Pourquoi ici et pas dans Coolify : son réglage « Redirect to www » s'applique à
 * CHAQUE domaine déclaré sans `www.`, amorce comprise, qui partirait vers un
 * `www.parent62.00.re` sans DNS ni certificat. Cf. doc/16.
 *
 * Jamais sur `/api/` (test insensible à la casse, comme le routage Express) : un
 * retour de paiement ou un appel d'API arrivant sur l'hôte jumeau ne doit pas
 * devenir un 301.
 */

const WWW = "www.";

/**
 * La règle dérivée de l'URL publique : l'hôte jumeau à rediriger (`de`) et
 * l'origine canonique (`vers`). `null` si l'URL manque ou est invalide.
 */
export function regleHoteCanonique(publicUrl) {
  if (!publicUrl) return null;
  let url;
  try {
    url = new URL(publicUrl);
  } catch {
    return null;
  }
  const canonique = url.hostname.toLowerCase();
  if (!canonique) return null;
  const de = canonique.startsWith(WWW) ? canonique.slice(WWW.length) : `${WWW}${canonique}`;
  if (!de || de === WWW) return null;
  return { de, vers: url.origin };
}

/** Hôte de la requête, normalisé : `req.hostname` (sans port, IPv6 et proxy gérés par Express), minuscules, sans point final. */
function hoteDeLaRequete(req) {
  return (req.hostname ?? "").toLowerCase().replace(/\.$/, "");
}

/**
 * Fabrique le middleware Express pour une URL publique donnée (en prod :
 * `process.env.VITE_SITE_PUBLIC_URL`). Sans règle, le middleware est un `next()`.
 */
export function canonicalHostRedirect(publicUrl) {
  const regle = regleHoteCanonique(publicUrl);
  if (!regle) return (_req, _res, next) => next();
  return (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (/^\/api\//i.test(req.originalUrl)) return next();
    if (hoteDeLaRequete(req) !== regle.de) return next();
    res.redirect(301, `${regle.vers}${req.originalUrl}`);
  };
}
