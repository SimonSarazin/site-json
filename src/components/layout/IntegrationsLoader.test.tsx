// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useNavigate } from "react-router";
import { useEffect } from "react";
import { IntegrationsLoader } from "./IntegrationsLoader";
import { CONSENT_STORAGE_KEY, writeConsent } from "@/lib/consent";
import type { SiteConfig } from "@/types/site-schema";

/**
 * Mesure d'audience Matomo câblée dans `IntegrationsLoader` : initialisation `_paq` et script une
 * seule fois, une page vue par navigation client, et le consentement de la catégorie `analytics`
 * qui coupe ou rouvre la mesure. Tout passe par la file `window._paq` — le script Matomo lui-même
 * n'est jamais chargé ici (jsdom ne l'exécute pas).
 */

let integrations: SiteConfig["integrations"];
vi.mock("@/hooks/useSite", () => ({ useSite: () => ({ config: { integrations } }) }));
let publicUrl = "http://localhost:3000";
vi.mock("@/lib/constant/common", () => ({ getSitePublicUrlConfigured: () => publicUrl }));

let navigateTo: ((to: string) => void) | undefined;
function Capture() {
  const navigate = useNavigate();
  useEffect(() => {
    navigateTo = (to) => navigate(to);
  }, [navigate]);
  return null;
}

function monter(initial = "/") {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Capture />
      <IntegrationsLoader />
      <Routes>
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Laisse passer la frame + le `setTimeout(0)` derrière lesquels la page vue est émise. */
async function attendrePageVue() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
}

const commandes = (nom: string) => (window._paq ?? []).filter((c) => c[0] === nom);

beforeEach(() => {
  window.localStorage.clear();
  delete window._paq;
  document.querySelectorAll("script[data-integration]").forEach((s) => s.remove());
  integrations = { analytics: { provider: "matomo", id: "7", url: "https://communecter.matomo.cloud/" } };
  publicUrl = window.location.origin;
  document.title = "Accueil";
});

afterEach(() => {
  navigateTo = undefined;
});

describe("IntegrationsLoader — Matomo", () => {
  it("initialise _paq en mode sans cookie, charge le script du CDN cloud et compte la première page", async () => {
    monter("/");
    await attendrePageVue();

    expect(window._paq).toEqual(
      expect.arrayContaining([
        ["setTrackerUrl", "https://communecter.matomo.cloud/matomo.php"],
        ["setSiteId", "7"],
        ["disableCookies"],
        ["setDoNotTrack", true],
      ]),
    );
    const script = document.querySelector<HTMLScriptElement>('script[data-integration="matomo"]');
    expect(script?.src).toBe("https://cdn.matomo.cloud/communecter.matomo.cloud/matomo.js");
    expect(commandes("trackPageView")).toHaveLength(1);
    expect(commandes("setDocumentTitle")).toEqual([["setDocumentTitle", "Accueil"]]);
    expect(commandes("setReferrerUrl")).toHaveLength(0);
  });

  it("une navigation client = une page vue de plus, la page précédente en référent", async () => {
    monter("/");
    await attendrePageVue();
    const premiere = window.location.href;

    document.title = "Agenda";
    await act(async () => navigateTo?.("/agenda"));
    await attendrePageVue();

    expect(commandes("trackPageView")).toHaveLength(2);
    expect(commandes("setReferrerUrl")).toEqual([["setReferrerUrl", premiere]]);
    expect(commandes("setDocumentTitle").slice(-1)).toEqual([["setDocumentTitle", "Agenda"]]);
    // init une seule fois
    expect(commandes("setSiteId")).toHaveLength(1);
    expect(document.querySelectorAll('script[data-integration="matomo"]')).toHaveLength(1);
  });

  it("matomo.js remplace window._paq par son proxy : les commandes suivantes y arrivent quand même", async () => {
    monter("/");
    await attendrePageVue();
    // Simule matomo.js chargé : la file initiale est consommée, `window._paq` devient un objet à `push`.
    const recues: unknown[][] = [];
    (window as unknown as { _paq: unknown })._paq = { push: (c: unknown[]) => recues.push(c) };

    await act(async () => navigateTo?.("/agenda"));
    await attendrePageVue();
    expect(recues.filter((c) => c[0] === "trackPageView")).toHaveLength(1);
    expect(recues).toContainEqual(["setCustomUrl", `${window.location.origin}/agenda`]);

    await act(async () => void writeConsent({ analytics: false }, false));
    expect(recues).toContainEqual(["optUserOut"]);
  });

  it("un retour sur la page précédente compte une nouvelle page vue (clé de navigation, pas URL)", async () => {
    monter("/");
    await attendrePageVue();
    await act(async () => navigateTo?.("/agenda"));
    await attendrePageVue();
    await act(async () => navigateTo?.("/"));
    await attendrePageVue();
    expect(commandes("trackPageView")).toHaveLength(3);
    expect(commandes("setCustomUrl").map((c) => c[1])).toEqual([`${window.location.origin}/`, `${window.location.origin}/agenda`, `${window.location.origin}/`]);
  });

  it("opt-out (repli) : un refus enregistré coupe la mesure, une acceptation la rouvre", async () => {
    monter("/");
    await attendrePageVue();
    expect(commandes("trackPageView")).toHaveLength(1);

    await act(async () => void writeConsent({ necessary: true, analytics: false }, false));
    expect(commandes("optUserOut")).toHaveLength(1);

    await act(async () => navigateTo?.("/agenda"));
    await attendrePageVue();
    expect(commandes("trackPageView")).toHaveLength(1);

    await act(async () => void writeConsent({ necessary: true, analytics: true }, true));
    await attendrePageVue();
    expect(commandes("forgetUserOptOut")).toHaveLength(2); // init + ré-acceptation
    expect(commandes("trackPageView")).toHaveLength(2);
  });

  it("opt-out : un refus déjà enregistré avant la visite = ni script ni _paq", async () => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ accepted: false, preferences: { analytics: false }, timestamp: "2026-11-06T00:00:00.000Z" }));
    monter("/");
    await attendrePageVue();

    expect(window._paq).toBeUndefined();
    expect(document.querySelector('script[data-integration="matomo"]')).toBeNull();
  });

  it("opt-in : rien tant que la catégorie analytics n'est pas acceptée", async () => {
    integrations = { analytics: { provider: "matomo", id: "7", url: "https://communecter.matomo.cloud/", consent: "opt-in" } };
    monter("/");
    await attendrePageVue();
    expect(window._paq).toBeUndefined();

    await act(async () => void writeConsent({ necessary: true, analytics: true }, true));
    await attendrePageVue();
    expect(commandes("trackPageView")).toHaveLength(1);
  });

  it("un idSite non numérique (placeholder) désactive la mesure sans casser la page", async () => {
    integrations = { analytics: { provider: "matomo", id: "SITE_ID_A_CREER", url: "https://communecter.matomo.cloud/" } };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    monter("/");
    await attendrePageVue();

    expect(document.querySelector('script[data-integration="matomo"]')).toBeNull();
    expect(commandes("trackPageView")).toHaveLength(0);
    warn.mockRestore();
  });

  it("hors de l'hôte public : rien (publicHostOnly par défaut), sauf publicHostOnly: false", async () => {
    publicUrl = "https://www.parent62.org";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    monter("/");
    await attendrePageVue();
    expect(window._paq).toBeUndefined();
    expect(document.querySelector('script[data-integration="matomo"]')).toBeNull();

    integrations = { analytics: { provider: "matomo", id: "7", url: "https://communecter.matomo.cloud/", publicHostOnly: false } };
    monter("/agenda");
    await attendrePageVue();
    expect(commandes("trackPageView")).toHaveLength(1);
    expect(commandes("setCustomUrl")).toEqual([["setCustomUrl", `${window.location.origin}/agenda`]]);
    warn.mockRestore();
  });
});

describe("IntegrationsLoader — GA4", () => {
  it("refuse le placeholder G-XXXXXXX de config.prod.json : ni script ni dataLayer", async () => {
    integrations = { analytics: { provider: "ga4", id: "G-XXXXXXX" } };
    delete window.dataLayer;
    delete window.gtag;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    monter("/");
    await attendrePageVue();
    expect(document.querySelector('script[data-integration="ga4"]')).toBeNull();
    expect(window.dataLayer).toBeUndefined();
    warn.mockRestore();
  });

  it("configure gtag sans page vue automatique puis émet page_view à chaque navigation", async () => {
    integrations = { analytics: { provider: "ga4", id: "G-TEST1234" } };
    delete window.dataLayer;
    delete window.gtag;
    monter("/");
    await attendrePageVue();

    const appels = (window.dataLayer ?? []).map((a) => Array.from(a as ArrayLike<unknown>));
    expect(appels).toContainEqual(["config", "G-TEST1234", { send_page_view: false, anonymize_ip: true }]);
    expect(appels.filter((a) => a[0] === "event" && a[1] === "page_view")).toHaveLength(1);
    expect(document.querySelector<HTMLScriptElement>('script[data-integration="ga4"]')?.src).toContain("gtag/js?id=G-TEST1234");

    await act(async () => navigateTo?.("/agenda"));
    await attendrePageVue();
    const vues = (window.dataLayer ?? []).map((a) => Array.from(a as ArrayLike<unknown>)).filter((a) => a[0] === "event" && a[1] === "page_view");
    expect(vues).toHaveLength(2);
  });
});
