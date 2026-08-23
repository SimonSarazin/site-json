import { describe, it, expect } from "vitest";

import { buildReturnTo, readReturnTo, returnToOrHome, LOGIN_PATH } from "./authRedirect";

describe("buildReturnTo", () => {
  it("conserve la query — un filtre en cours ne doit pas être perdu au passage par le login", () => {
    expect(buildReturnTo("/blog", "?categorie=autre")).toBe("/blog?categorie=autre");
    expect(buildReturnTo("/espace-pro")).toBe("/espace-pro");
    expect(buildReturnTo("/espace-pro", "")).toBe("/espace-pro");
  });
});

describe("readReturnTo — n'accepte qu'une destination interne", () => {
  it("accepte un chemin interne, query et fragment compris", () => {
    expect(readReturnTo({ from: "/espace-pro" })).toBe("/espace-pro");
    expect(readReturnTo({ from: "/blog?categorie=autre" })).toBe("/blog?categorie=autre");
    expect(readReturnTo({ from: "/s-informer#faq" })).toBe("/s-informer#faq");
  });

  it("refuse une URL absolue (open redirect)", () => {
    expect(readReturnTo({ from: "https://exemple.re/phish" })).toBeNull();
    expect(readReturnTo({ from: "http://exemple.re" })).toBeNull();
  });

  it("refuse une URL protocole-relative — le piège classique du `startsWith(\"/\")` seul", () => {
    expect(readReturnTo({ from: "//exemple.re/phish" })).toBeNull();
    expect(readReturnTo({ from: "/\\exemple.re" })).toBeNull();
  });

  it("refuse la page de login elle-même (sinon boucle)", () => {
    expect(readReturnTo({ from: LOGIN_PATH })).toBeNull();
    expect(readReturnTo({ from: `${LOGIN_PATH}?x=1` })).toBeNull();
  });

  it("refuse tout ce qui n'est pas une chaîne exploitable", () => {
    for (const s of [null, undefined, {}, { from: "" }, { from: 42 }, { from: {} }]) {
      expect(readReturnTo(s)).toBeNull();
    }
  });
});

describe("returnToOrHome", () => {
  it("replie sur l'accueil — le comportement historique quand rien n'est mémorisé", () => {
    expect(returnToOrHome(null)).toBe("/");
    expect(returnToOrHome({ from: "https://exemple.re" })).toBe("/");
  });
  it("rend la destination mémorisée quand elle est sûre", () => {
    expect(returnToOrHome({ from: "/espace-pro" })).toBe("/espace-pro");
  });
});
