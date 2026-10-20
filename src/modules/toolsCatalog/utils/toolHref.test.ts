import { describe, it, expect } from "vitest";
import { classifyHref } from "@/lib/linkKind";
import { normalizeToolHref } from "./toolHref";

/**
 * Ce qui compte n'est pas la chaîne rendue mais la VOIE de rendu qu'elle déclenche :
 * chaque cas est donc vérifié jusqu'à `classifyHref`, le contrat que `NavLink`
 * consomme réellement.
 */

const voie = (url: string | null | undefined) => classifyHref(normalizeToolHref(url));

describe("normalizeToolHref — la route du site reste une route", () => {
  it("laisse `/aac/commun/<id>` intact et le classe `internal`", () => {
    // C'est tout l'enjeu : navigation SPA, même onglet, aucun rechargement complet.
    const url = "/aac/commun/6a33be10fbb6f52b76632076";
    expect(normalizeToolHref(url)).toBe(url);
    expect(voie(url)).toBe("internal");
  });

  it("laisse une route avec query et fragment intacte", () => {
    const url = "/aac/commun/6a33be10fbb6f52b76632076?from=catalogue#postes";
    expect(normalizeToolHref(url)).toBe(url);
    expect(voie(url)).toBe("internal");
  });
});

describe("normalizeToolHref — le lien nu retrouve son schéma", () => {
  it("répare la forme nue mesurée en base (Peertube)", () => {
    // Sans schéma, `<a href>` la lirait comme un chemin relatif ; `classifyHref` la
    // rangerait dans `internal` et React Router rendrait la page d'accueil en 200.
    const nu = "lescommuns.tiers-lieux.org#detail-un-commun.communId.65265db00683d63330284e25";
    expect(normalizeToolHref(nu)).toBe(`https://${nu}`);
    expect(voie(nu)).toBe("external");
  });

  it("répare une forme nue avec chemin", () => {
    expect(voie("rustinelibre.fr/notre-collectif")).toBe("external");
  });
});

describe("normalizeToolHref — ce qui est déjà classable n'est pas touché", () => {
  it.each([
    ["https", "https://communs.les-cae.coop/#detail-un-commun.communId.67d00cc8f0ce2514cc1b3ec7", "external"],
    ["http", "http://exemple.org/", "external"],
    ["protocole-relatif", "//exemple.org/x", "external"],
    ["mailto", "mailto:contact@exemple.org", "protocol"],
    ["tel", "tel:+262692000000", "protocol"],
    ["ancre de page", "#postes", "anchor"],
  ])("laisse %s intact", (_quoi, url, attendu) => {
    expect(normalizeToolHref(url)).toBe(url);
    expect(voie(url)).toBe(attendu);
  });
});

describe("normalizeToolHref — absence de lien", () => {
  it.each([
    ["undefined", undefined],
    ["null", null],
    ["la chaîne vide", ""],
    ["des espaces", "   "],
  ])("rend une chaîne vide sur %s", (_quoi, url) => {
    expect(normalizeToolHref(url)).toBe("");
    // `NavLink` rend alors un `<span>` inerte, jamais une ancre morte.
    expect(voie(url)).toBe("inert");
  });
});
