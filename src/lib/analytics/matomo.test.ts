import { describe, it, expect } from "vitest";
import {
  analyticsAllowed,
  isPublicHost,
  isValidMatomoSiteId,
  matomoBaseUrl,
  matomoInitCommands,
  matomoPageViewCommands,
  matomoScriptUrl,
  matomoTrackerUrl,
  type AnalyticsConf,
} from "./matomo";

const conf = (extra: Partial<AnalyticsConf> = {}): AnalyticsConf => ({ provider: "matomo", id: "7", url: "https://communecter.matomo.cloud/", ...extra });

describe("isValidMatomoSiteId", () => {
  it("accepte un entier positif, refuse placeholders, zéro et vide", () => {
    expect(isValidMatomoSiteId("1")).toBe(true);
    expect(isValidMatomoSiteId(" 12 ")).toBe(true);
    expect(isValidMatomoSiteId("0")).toBe(false);
    expect(isValidMatomoSiteId("SITE_ID_A_CREER")).toBe(false);
    expect(isValidMatomoSiteId("G-ABC123")).toBe(false);
    expect(isValidMatomoSiteId("")).toBe(false);
    expect(isValidMatomoSiteId(undefined)).toBe(false);
  });
});

describe("URL Matomo", () => {
  it("normalise l'instance avec un slash final et refuse l'invalide", () => {
    expect(matomoBaseUrl("https://communecter.matomo.cloud")).toBe("https://communecter.matomo.cloud/");
    expect(matomoBaseUrl("https://stats.exemple.org/matomo")).toBe("https://stats.exemple.org/matomo/");
    expect(matomoBaseUrl("pas une url")).toBeNull();
    expect(matomoBaseUrl("javascript:alert(1)")).toBeNull();
    expect(matomoBaseUrl(undefined)).toBeNull();
  });

  it("collecte sur matomo.php de l'instance", () => {
    expect(matomoTrackerUrl("https://stats.exemple.org/matomo/")).toBe("https://stats.exemple.org/matomo/matomo.php");
  });

  it("script : CDN pour Matomo Cloud, l'instance sinon, la surcharge toujours", () => {
    expect(matomoScriptUrl("https://communecter.matomo.cloud/")).toBe("https://cdn.matomo.cloud/communecter.matomo.cloud/matomo.js");
    expect(matomoScriptUrl("https://stats.exemple.org/matomo/")).toBe("https://stats.exemple.org/matomo/matomo.js");
    expect(matomoScriptUrl("https://communecter.matomo.cloud/", "https://cdn.exemple.org/m.js")).toBe("https://cdn.exemple.org/m.js");
  });
});

describe("matomoInitCommands", () => {
  it("mode exempté par défaut : sans cookie, Do Not Track honoré", () => {
    expect(matomoInitCommands(conf(), "https://communecter.matomo.cloud/")).toEqual([
      ["setTrackerUrl", "https://communecter.matomo.cloud/matomo.php"],
      ["setSiteId", "7"],
      ["disableCookies"],
      ["setDoNotTrack", true],
    ]);
  });

  it("cookies: true et respectDnt: false lèvent les deux réglages", () => {
    expect(matomoInitCommands(conf({ cookies: true, respectDnt: false, id: " 3 " }), "https://s.org/")).toEqual([
      ["setTrackerUrl", "https://s.org/matomo.php"],
      ["setSiteId", "3"],
    ]);
  });
});

describe("matomoPageViewCommands", () => {
  it("première vue : pas de référent interne, Matomo lit document.referrer", () => {
    expect(matomoPageViewCommands({ url: "https://www.parent62.org/", title: "Accueil" })).toEqual([
      ["setCustomUrl", "https://www.parent62.org/"],
      ["setDocumentTitle", "Accueil"],
      ["deleteCustomVariables", "page"],
      ["trackPageView"],
      ["enableLinkTracking"],
    ]);
  });

  it("navigation client : la page précédente devient le référent", () => {
    const cmds = matomoPageViewCommands({ url: "https://www.parent62.org/agenda", title: "Agenda", referrer: "https://www.parent62.org/" });
    expect(cmds[0]).toEqual(["setReferrerUrl", "https://www.parent62.org/"]);
    expect(cmds).toContainEqual(["trackPageView"]);
  });
});

describe("analyticsAllowed", () => {
  it("opt-out (repli) : mesure jusqu'au refus", () => {
    expect(analyticsAllowed(undefined, null)).toBe(true);
    expect(analyticsAllowed("opt-out", true)).toBe(true);
    expect(analyticsAllowed("opt-out", false)).toBe(false);
  });

  it("opt-in : rien sans acceptation explicite", () => {
    expect(analyticsAllowed("opt-in", null)).toBe(false);
    expect(analyticsAllowed("opt-in", false)).toBe(false);
    expect(analyticsAllowed("opt-in", true)).toBe(true);
  });
});

describe("isPublicHost", () => {
  it("seul l'hôte de l'URL publique mesure — ni l'amorce, ni le jumeau, ni le dev", () => {
    expect(isPublicHost("www.parent62.org", "https://www.parent62.org")).toBe(true);
    expect(isPublicHost("WWW.Parent62.org", "https://www.parent62.org/")).toBe(true);
    expect(isPublicHost("parent62.org", "https://www.parent62.org")).toBe(false);
    expect(isPublicHost("parent62.00.re", "https://www.parent62.org")).toBe(false);
    expect(isPublicHost("localhost:5173", "https://www.parent62.org")).toBe(false);
  });

  it("le port fait partie de l'hôte (dev : VITE_SITE_PUBLIC_URL = http://localhost:<port>)", () => {
    expect(isPublicHost("localhost:5173", "http://localhost:5173")).toBe(true);
    expect(isPublicHost("localhost:5174", "http://localhost:5173")).toBe(false);
  });

  it("sans URL publique ou URL invalide : pas de mesure", () => {
    expect(isPublicHost("www.parent62.org", undefined)).toBe(false);
    expect(isPublicHost("www.parent62.org", "")).toBe(false);
    expect(isPublicHost("www.parent62.org", "n'importe quoi")).toBe(false);
  });
});
