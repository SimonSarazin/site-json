/**
 * Resolution des chemins d'images servis par Communecter — PURE et testee.
 *
 * Communecter stocke ses images en chemins RELATIFS a sa racine web
 * (`/upload/communecter/projects/<id>/banner.png`, verifie en base dev). Poses
 * tels quels dans un `<img src>`, ils se resolvent sur l'origine du SITE et
 * cassent : couvertures, logos et avatars n'apparaitraient pas. On les resout
 * donc contre l'ORIGINE de
 * l'API — la meme source de configuration que le client du site (`getBaseUrl`),
 * pour qu'un seul `VITE_BASE_URL_BACKEND` pilote les appels ET les images.
 *
 * L'origine, et non la base complete : `/upload/...` est un chemin absolu
 * depuis la racine du serveur, une base `http://hote/ph` ne doit pas le
 * prefixer.
 */
import { getBaseUrl } from '@/lib/constant/common';

/** Schemas qu'une image peut porter tels quels. */
const PASS_THROUGH = /^(?:https?:|blob:)/i;

/**
 * Seules les images `data:` sont admises, jamais un `data:text/html` : un
 * chemin qui finit dans un attribut ne doit pas pouvoir y glisser un document.
 */
const DATA_IMAGE = /^data:image\//i;

/** Tout autre schema explicite (`javascript:`, `vbscript:`, `file:`…) est refuse. */
const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * URL affichable d'une image, ou `null` s'il n'y a rien (ou rien de sur) a
 * afficher.
 *
 * @param apiBase base de l'API ; par defaut celle du transport. Parametre pour
 *   que les tests n'aient pas a simuler `window.__ENV__`.
 */
export function resolveMediaUrl(
  path: string | null | undefined,
  apiBase: string = getBaseUrl(),
): string | null {
  if (typeof path !== 'string') return null;
  const trimmed = path.trim();
  if (trimmed === '') return null;

  if (PASS_THROUGH.test(trimmed) || DATA_IMAGE.test(trimmed)) return trimmed;
  // `//cdn.example/x.png` : deja une adresse complete, au protocole de la page.
  if (trimmed.startsWith('//')) return trimmed;
  if (ANY_SCHEME.test(trimmed)) return null;

  const origin = originOf(apiBase);
  // Base vide ou illisible : front et API partagent l'origine (proxy), le
  // chemin relatif est alors deja le bon.
  if (origin === null) return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return new URL(trimmed.startsWith('/') ? trimmed : `/${trimmed}`, origin).toString();
}

function originOf(apiBase: string): string | null {
  if (apiBase === '') return null;
  try {
    const { origin } = new URL(apiBase);
    // `new URL('localhost:5175')` lit `localhost:` comme un schema : l'origine
    // vaut alors la chaine `null`, qu'on ne doit surtout pas prefixer.
    return origin === 'null' ? null : origin;
  } catch {
    return null;
  }
}
