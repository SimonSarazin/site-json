import { describe, it, expect } from "vitest";
import { matchText } from "../lib/matchCommand";
import { resolveText } from "../lib/resolveText";

describe("matchText", () => {
  it("laisse passer une requête vide ou blanche", () => {
    expect(matchText("n'importe quoi", "")).toBe(true);
    expect(matchText("n'importe quoi", "   ")).toBe(true);
  });

  it("match une sous-chaîne insensible à la casse", () => {
    expect(matchText("Aller à l'accueil", "ACCUEIL")).toBe(true);
    expect(matchText("Basculer le thème", "thèm")).toBe(true);
  });

  it("exige que TOUS les tokens matchent (AND)", () => {
    expect(matchText("aller à l'accueil maintenant", "aller accueil")).toBe(true);
    expect(matchText("aller à l'accueil", "aller profil")).toBe(false);
  });

  it("ne match pas un terme absent", () => {
    expect(matchText("Navigation", "xyz")).toBe(false);
  });
});

describe("resolveText", () => {
  it("retourne une string telle quelle", () => {
    expect(resolveText("Bonjour", "fr")).toBe("Bonjour");
  });

  it("résout un LocalizedString selon la locale", () => {
    expect(resolveText({ fr: "Bonjour", en: "Hello" }, "en")).toBe("Hello");
    expect(resolveText({ fr: "Bonjour", en: "Hello" }, "fr")).toBe("Bonjour");
  });

  it("fallback fr → en → première valeur si locale absente", () => {
    expect(resolveText({ fr: "Bonjour", en: "Hello" }, "es")).toBe("Bonjour");
    expect(resolveText({ en: "Hello" }, "es")).toBe("Hello");
    expect(resolveText({ de: "Hallo" }, "es")).toBe("Hallo");
  });

  it("retourne '' pour undefined", () => {
    expect(resolveText(undefined, "fr")).toBe("");
  });
});
