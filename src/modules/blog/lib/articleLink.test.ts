import { describe, it, expect } from "vitest";
import { normalizeArticleResult, articleHref } from "./articleLink";

describe("normalizeArticleResult", () => {
  it("lit serverData quand présent (instance SDK)", () => {
    expect(normalizeArticleResult({ serverData: { id: "1", name: "Titre" } })).toEqual({ id: "1", name: "Titre" });
  });

  it("retombe sur l'objet racine quand serverData est absent", () => {
    expect(normalizeArticleResult({ id: "1", name: "Titre" })).toEqual({ id: "1", name: "Titre" });
  });

  it("complète l'id depuis la racine quand serverData.id est vide (résultat de recherche)", () => {
    expect(normalizeArticleResult({ id: "42", serverData: { name: "Titre" } })).toEqual({ id: "42", name: "Titre" });
  });

  it("ne force pas d'id quand aucun n'est disponible", () => {
    expect(normalizeArticleResult({ serverData: {} })).toEqual({});
  });
});

describe("articleHref", () => {
  it("priorise le slug", () => {
    expect(articleHref({ slug: "mon-article", id: "42" }, "/blog")).toBe("/blog/mon-article");
  });

  it("retombe sur l'id quand il n'y a pas de slug (~82% des articles)", () => {
    expect(articleHref({ id: "42" }, "/blog")).toBe("/blog/id/42");
  });

  it("renvoie la base (jamais /blog/id/undefined) quand ni slug ni id", () => {
    expect(articleHref({}, "/blog")).toBe("/blog");
  });
});
