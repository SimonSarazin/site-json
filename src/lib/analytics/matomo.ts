/**
 * Matomo — fonctions PURES (sans DOM) derrière `IntegrationsLoader` : résolution des URL,
 * commandes `_paq` d'initialisation et de page vue, règles d'activation. Le câblage au
 * navigateur (script, `useLocation`, consentement) reste dans le loader ; ici tout est testable
 * en environnement node.
 *
 * Mode par défaut = mesure exemptée de consentement au sens CNIL : pas de cookie
 * (`disableCookies`), Do Not Track honoré, et l'instance doit anonymiser l'IP (réglage
 * Matomo « Vie privée », PAS pilotable d'ici — à vérifier sur l'instance).
 */
import type { SiteConfig } from "@/types/site-schema";

export type AnalyticsConf = NonNullable<NonNullable<SiteConfig["integrations"]>["analytics"]>;
export type PaqCommand = [string, ...unknown[]];

declare global {
  interface Window {
    _paq?: PaqCommand[];
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const MATOMO_CLOUD = /^([a-z0-9-]+)\.matomo\.cloud$/i;

/** `idSite` Matomo : un entier strictement positif. Un placeholder (« À_CRÉER ») désactive la mesure. */
export function isValidMatomoSiteId(id: string | undefined): boolean {
  return typeof id === "string" && /^[1-9]\d*$/.test(id.trim());
}

/** URL de l'instance normalisée avec slash final, ou `null` si absente ou invalide. */
export function matomoBaseUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const path = u.pathname.endsWith("/") ? u.pathname : `${u.pathname}/`;
    return `${u.origin}${path}`;
  } catch {
    return null;
  }
}

/** Point de collecte : `<instance>/matomo.php`. */
export function matomoTrackerUrl(base: string): string {
  return `${base}matomo.php`;
}

/**
 * Script de suivi : `scriptUrl` si donnée, sinon `cdn.matomo.cloud/<hôte>/matomo.js` pour une
 * instance Matomo Cloud (le snippet officiel de ces instances), sinon `<instance>/matomo.js`.
 */
export function matomoScriptUrl(base: string, scriptUrl?: string): string {
  if (scriptUrl) return scriptUrl;
  const host = new URL(base).hostname;
  if (MATOMO_CLOUD.test(host)) return `https://cdn.matomo.cloud/${host.toLowerCase()}/matomo.js`;
  return `${base}matomo.js`;
}

/** Commandes `_paq` à pousser AVANT le chargement du script (une seule fois). */
export function matomoInitCommands(conf: AnalyticsConf, base: string): PaqCommand[] {
  const commands: PaqCommand[] = [
    ["setTrackerUrl", matomoTrackerUrl(base)],
    ["setSiteId", conf.id.trim()],
  ];
  if (conf.cookies !== true) commands.push(["disableCookies"]);
  if (conf.respectDnt !== false) commands.push(["setDoNotTrack", true]);
  return commands;
}

/**
 * Page vue d'une application à routage client : URL et titre posés explicitement, référent =
 * page précédente de la session, variables de page purgées (guide Matomo « Single-Page
 * Application »). Le premier appel n'a pas de référent interne : Matomo lit `document.referrer`.
 */
export function matomoPageViewCommands(view: { url: string; title: string; referrer?: string }): PaqCommand[] {
  const commands: PaqCommand[] = [];
  if (view.referrer) commands.push(["setReferrerUrl", view.referrer]);
  commands.push(["setCustomUrl", view.url]);
  commands.push(["setDocumentTitle", view.title]);
  commands.push(["deleteCustomVariables", "page"]);
  commands.push(["trackPageView"]);
  commands.push(["enableLinkTracking"]);
  return commands;
}

/**
 * La mesure doit-elle tourner, d'après le mode de consentement et le choix de l'utilisateur
 * pour la catégorie `analytics` (`null` = pas encore prononcé) ?
 * - `opt-out` (repli) : oui tant qu'il n'a pas refusé — mesure exemptée, droit d'opposition ;
 * - `opt-in` : seulement après acceptation explicite.
 */
export function analyticsAllowed(mode: AnalyticsConf["consent"] | undefined, choice: boolean | null): boolean {
  return mode === "opt-in" ? choice === true : choice !== false;
}

/**
 * Ne mesurer que l'hôte public (`VITE_SITE_PUBLIC_URL`) : le dev, l'amorce `*.00.re` et l'hôte
 * jumeau (avant sa redirection) ne polluent pas les statistiques. Sans URL publique lisible,
 * on ne mesure PAS — l'absence de configuration ne doit jamais ouvrir la mesure partout.
 */
export function isPublicHost(locationHost: string, publicUrl: string | undefined): boolean {
  if (!publicUrl) return false;
  try {
    return new URL(publicUrl).host.toLowerCase() === locationHost.toLowerCase();
  } catch {
    return false;
  }
}
