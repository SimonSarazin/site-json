// src/lib/constant/common.ts
/* -------------------------------------------------------------------------- */
/* 1.  Types & déclarations globales                                          */
/* -------------------------------------------------------------------------- */
export interface RuntimeEnv {
  VITE_BASE_URL_BACKEND?: string;
  VITE_SLUG?:             string;
  VITE_SERVER_URL?:       string;
  VITE_MON_API_KEY?:      string;
  VITE_MON_DOMAIN?:       string;
  VITE_MAPTILER_API_KEY?: string;
  VITE_COSTUM_FORCE_LIVE?: string;
  VITE_SITE_PUBLIC_URL?:       string;
}

/** Déclare window.__ENV__ pour le compilateur */
declare global {
  interface Window { __ENV__?: RuntimeEnv }
}

/* -------------------------------------------------------------------------- */
/* 2.  Enum – utile pour éviter les strings magiques                          */
/* -------------------------------------------------------------------------- */
export const enum ELEMENT_TYPE {
  citoyens      = "citoyens",
  projects      = "projects",
  organizations = "organizations",
  events        = "events",
}

/* -------------------------------------------------------------------------- */
/* 3.  Fabrique générique pour lire une var d’environnement                   */
/* -------------------------------------------------------------------------- */
function readEnv<K extends keyof RuntimeEnv>(
  key: K,
  fallback: string,
): string {
  const value =
    (typeof window      !== "undefined" ? window.__ENV__?.[key]              : undefined) ??
    (typeof process     !== "undefined" ? process.env?.[key]                 : undefined) ??
    (typeof import.meta !== "undefined" ? (import.meta.env as RuntimeEnv)?.[key] : undefined);

  return typeof value === "string" && value.length ? value : fallback;
}

/* -------------------------------------------------------------------------- */
/* 4.  Helpers publics                                                        */
/* -------------------------------------------------------------------------- */
export const getBaseUrl  = () => readEnv("VITE_BASE_URL_BACKEND", "http://localhost:3000");
export const getSlug      = () => readEnv("VITE_SLUG",              "default");
export const getServerUrl = () => readEnv("VITE_SERVER_URL",        "http://localhost:3000");
export const getMonApiKey = () => readEnv("VITE_MON_API_KEY",       "default-api-key");
export const getMonDomain = () => readEnv("VITE_MON_DOMAIN",        "default-domain.com");
/**
 * FORCE-LIVE costum : la lib ignore ses schémas costum BUNDLÉS et ne résout que par `getcostumjson`.
 * À activer quand la config costum évolue en base plus vite que les artefacts publiés — sans quoi un
 * artefact périmé masque les champs réels (mesuré sur institutBleu : son artefact ne déclarait que
 * `organizations` alors que le costum porte deux sous-types `poi`). Contrepartie : plus de démarrage
 * à froid, le contexte costum reste nu tant que le préchargement n'a pas répondu.
 */
export const getCostumForceLive = () => readEnv("VITE_COSTUM_FORCE_LIVE", "") === "true";

/** Clé MapTiler (fonds de carte) — "" si absente → repli tuiles libres. */
export const getMaptilerApiKey = () => readEnv("VITE_MAPTILER_API_KEY", "");

/**
 * URL PUBLIQUE du site-json lui-même (canonical, og:url, og:image, sitemap, flux
 * RSS) — à ne PAS confondre avec `getServerUrl()`/`VITE_SERVER_URL`, qui désigne
 * le serveur communecter (préfixe des images `/upload`, embed co2, cagnotte) et
 * vaut donc `www.communecter.org` sur tout le parc.
 *
 * `VITE_SERVER_URL` servait d'origine aux DEUX sémantiques : mesuré en prod, le
 * canonical de chaque fiche `/profil/:slug` d'institut-bleu pointait vers
 * `www.communecter.org/profil/…` — Google invité à consolider l'annuaire vers un
 * autre domaine.
 *
 * Sources, dans l'ordre : `window.__ENV__`/`process.env` (posée par la chaîne
 * `deploy:env` — dérivée de `sites.json` : `aliases[0]` prioritaire, sinon
 * `domain` ; en dev, `dev-server.js` pose `http://localhost:<port>`), puis repli
 * sur `getServerUrl()` — comportement historique STRICTEMENT inchangé tant que
 * la variable n'est pas déployée.
 */
export const getSitePublicUrl = () => readEnv("VITE_SITE_PUBLIC_URL", "") || getServerUrl();
