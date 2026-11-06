import { useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { useSite } from "@/hooks/useSite";
import { getSitePublicUrl } from "@/lib/constant/common";
import { ANALYTICS_CATEGORY, consentFor, readConsent, useConsent } from "@/lib/consent";
import {
  analyticsAllowed,
  isPublicHost,
  isValidMatomoSiteId,
  matomoBaseUrl,
  matomoInitCommands,
  matomoPageViewCommands,
  matomoScriptUrl,
  type AnalyticsConf,
} from "@/lib/analytics/matomo";

/**
 * Intégrations tierces de `config.integrations`, chargées CÔTÉ CLIENT après hydratation : rien
 * n'est émis au SSR, les scripts n'entrent jamais dans le HTML servi.
 *
 * Mesure d'audience (`integrations.analytics`) — `matomo` et `ga4` :
 * - ne tourne que sur l'hôte public (`VITE_SITE_PUBLIC_URL`, sauf `publicHostOnly: false`) ;
 * - obéit au consentement de la catégorie `analytics` (`src/lib/consent.ts`) selon
 *   `consent` : `opt-out` (repli) mesure jusqu'au refus, `opt-in` attend l'acceptation ;
 * - envoie une page vue à CHAQUE navigation client (`useLocation`), avec l'URL, le titre posé
 *   par Helmet et la page précédente en référent — un `gtag('config')` ou un `trackPageView`
 *   au seul chargement ne verrait qu'une vue par session.
 * Un changement de consentement en cours de session coupe (`optUserOut` / `ga-disable-*`)
 * ou rouvre la mesure sans rechargement.
 */
export function IntegrationsLoader() {
  const { config } = useSite();
  const integrations = config.integrations;

  useAnalytics(integrations?.analytics);

  useEffect(() => {
    if (!integrations) return;

    if (integrations.chat?.provider === "intercom" && integrations.chat.id) {
      appendScript(`https://widget.intercom.io/widget/${encodeURIComponent(integrations.chat.id)}`, "intercom");
    }

    integrations.scripts?.forEach((tag, index) => {
      appendScript(tag.src, `script-${index}`, {
        async: tag.async !== false,
        defer: tag.defer === true,
        target: tag.position === "body" ? document.body : document.head,
      });
    });
  }, [integrations]);

  return null;
}

const SCRIPT_ATTR = "data-integration";

/** Ajoute un `<script src>` une seule fois par nom (re-render, HMR, StrictMode). */
function appendScript(
  src: string,
  name: string,
  options: { async?: boolean; defer?: boolean; target?: HTMLElement } = {},
): HTMLScriptElement | null {
  const existing = document.querySelector<HTMLScriptElement>(`script[${SCRIPT_ATTR}="${name}"]`);
  if (existing) return existing;
  const script = document.createElement("script");
  script.src = src;
  script.async = options.async !== false;
  if (options.defer) script.defer = true;
  script.setAttribute(SCRIPT_ATTR, name);
  (options.target ?? document.head).appendChild(script);
  return script;
}

interface PageView {
  url: string;
  title: string;
  referrer?: string;
}

interface Tracker {
  pageView(view: PageView): void;
  /** Coupe ou rouvre la mesure après un changement de consentement, script déjà chargé. */
  setEnabled(on: boolean): void;
}

function warn(message: string): void {
  if (import.meta.env.DEV) console.warn(`[analytics] ${message}`);
}

function startMatomo(conf: AnalyticsConf): Tracker | null {
  const base = matomoBaseUrl(conf.url);
  if (!base) {
    warn("matomo : `integrations.analytics.url` absente ou invalide — mesure désactivée.");
    return null;
  }
  if (!isValidMatomoSiteId(conf.id)) {
    warn(`matomo : idSite « ${conf.id} » non numérique — mesure désactivée (placeholder à remplacer ?).`);
    return null;
  }
  const paq = (window._paq = window._paq ?? []);
  for (const command of matomoInitCommands(conf, base)) paq.push(command);
  appendScript(matomoScriptUrl(base, conf.scriptUrl), "matomo");
  return {
    pageView: (view) => {
      for (const command of matomoPageViewCommands(view)) paq.push(command);
    },
    setEnabled: (on) => {
      paq.push(on ? ["forgetUserOptOut"] : ["optUserOut"]);
    },
  };
}

function startGa4(conf: AnalyticsConf): Tracker | null {
  const id = conf.id.trim();
  if (!id) {
    warn("ga4 : identifiant de mesure vide — mesure désactivée.");
    return null;
  }
  window.dataLayer = window.dataLayer ?? [];
  if (!window.gtag) {
    // Forme officielle : le `arguments` (pas un tableau) est ce que gtag.js dépile.
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
  }
  const gtag = window.gtag;
  gtag("js", new Date());
  // `send_page_view: false` : la page vue initiale passe par le même chemin que les suivantes.
  gtag("config", id, { send_page_view: false, anonymize_ip: true });
  appendScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`, "ga4");
  const flags = window as unknown as Record<string, unknown>;
  return {
    pageView: (view) =>
      gtag("event", "page_view", {
        page_location: view.url,
        page_title: view.title,
        ...(view.referrer ? { page_referrer: view.referrer } : {}),
      }),
    // Mécanisme documenté par Google pour désactiver une propriété sans retirer le script.
    setEnabled: (on) => {
      flags[`ga-disable-${id}`] = !on;
    },
  };
}

function startTracker(conf: AnalyticsConf): Tracker | null {
  switch (conf.provider) {
    case "matomo":
      return startMatomo(conf);
    case "ga4":
      return startGa4(conf);
    default:
      warn(`provider « ${conf.provider} » non câblé — seuls matomo et ga4 le sont.`);
      return null;
  }
}

/** `requestAnimationFrame` si disponible (jsdom sans `pretendToBeVisual` ne l'a pas). */
function nextFrame(callback: () => void): () => void {
  if (typeof window.requestAnimationFrame === "function") {
    const id = window.requestAnimationFrame(callback);
    return () => window.cancelAnimationFrame(id);
  }
  const id = window.setTimeout(callback, 0);
  return () => window.clearTimeout(id);
}

function useAnalytics(conf: AnalyticsConf | undefined): void {
  // Déclencheur de re-rendu seulement : pendant l'hydratation, `useSyncExternalStore` sert
  // l'instantané SERVEUR (null, « aucun choix ») — un refus déjà enregistré lancerait la mesure
  // un instant. L'effet relit donc le stockage lui-même.
  const choiceSignal = useConsent(ANALYTICS_CATEGORY);
  const { pathname, search } = useLocation();
  const tracker = useRef<Tracker | null>(null);
  const started = useRef(false);
  const enabled = useRef(false);
  const lastTracked = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!conf) return;
    if (import.meta.env.DEV) console.debug(`[analytics] effet ${pathname}${search} choix=${String(choiceSignal)}`);

    const hostOk = conf.publicHostOnly === false || isPublicHost(window.location.host, getSitePublicUrl());
    if (!hostOk) {
      if (!started.current) warn(`hôte ${window.location.host} ≠ URL publique — mesure désactivée ici.`);
      started.current = true;
      return;
    }

    const choice = consentFor(readConsent(), ANALYTICS_CATEGORY);
    if (!analyticsAllowed(conf.consent, choice)) {
      if (tracker.current && enabled.current) tracker.current.setEnabled(false);
      enabled.current = false;
      return;
    }

    if (!started.current) {
      started.current = true;
      tracker.current = startTracker(conf);
      enabled.current = tracker.current !== null;
    } else if (tracker.current && !enabled.current) {
      tracker.current.setEnabled(true);
      enabled.current = true;
    }
    const current = tracker.current;
    if (!current || !enabled.current) return;

    // L'URL vient du routeur (vérité de la navigation client), l'origine du navigateur.
    const url = `${window.location.origin}${pathname}${search}`;
    // Même URL déjà comptée (ex. préférences ré-enregistrées sans navigation) : pas de doublon.
    if (url === lastTracked.current) return;

    // Helmet pose le <title> après le commit : on laisse passer une frame avant de le lire.
    let timer: number | undefined;
    const cancelFrame = nextFrame(() => {
      timer = window.setTimeout(() => {
        current.pageView({ url, title: document.title, referrer: lastTracked.current });
        if (import.meta.env.DEV) console.debug(`[analytics] page vue ${url} — « ${document.title} »`);
        lastTracked.current = url;
      }, 0);
    });
    return () => {
      cancelFrame();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [conf, choiceSignal, pathname, search]);
}
