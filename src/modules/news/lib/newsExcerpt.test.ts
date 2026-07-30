import { describe, it, expect } from "vitest";
import { newsExcerpt } from "./newsExcerpt";

describe("newsExcerpt", () => {
  it("retourne '' pour une entrée non-string ou vide", () => {
    expect(newsExcerpt(undefined)).toBe("");
    expect(newsExcerpt(null)).toBe("");
    expect(newsExcerpt(42)).toBe("");
    expect(newsExcerpt("")).toBe("");
  });

  it("retire l'emphase (gras / italique / barré)", () => {
    expect(newsExcerpt("Un **texte** en _italique_ et ~~barré~~")).toBe("Un texte en italique et barré");
  });

  it("réduit les liens à leur libellé et retire les images", () => {
    expect(newsExcerpt("Voir [le site](https://ex.fr) ici")).toBe("Voir le site ici");
    expect(newsExcerpt("Avant ![alt](img.png) après")).toBe("Avant après");
  });

  it("retire les marqueurs de titre, citation et liste en début de ligne", () => {
    expect(newsExcerpt("# Titre\n> citation\n- item")).toBe("Titre citation item");
  });

  it("aplatit les blocs de code et le code inline", () => {
    expect(newsExcerpt("Texte `inline` fin")).toBe("Texte inline fin");
    expect(newsExcerpt("Avant\n```\ncode();\n```\naprès")).toBe("Avant après");
  });

  it("compacte les espaces et sauts de ligne", () => {
    expect(newsExcerpt("a\n\n\nb   c")).toBe("a b c");
  });

  it("tronque au mot près sans dépasser maxLength", () => {
    const long = "mot ".repeat(100).trim();
    const out = newsExcerpt(long, 20);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out.endsWith(" ")).toBe(false);
    expect(out).not.toContain("mo…"); // pas de mot coupé en plein milieu
  });
});
