import { describe, it, expect } from "vitest";
import { cardTaxonomyBadges, stringArray } from "./articleTaxonomy";
import type { ArticleData } from "../hooks/useArticle";

describe("stringArray", () => {
  it("filtre les valeurs non-chaînes d'un tableau hétérogène", () => {
    expect(stringArray(["a", 1, null, "b", undefined])).toEqual(["a", "b"]);
  });
  it("renvoie un tableau vide pour une valeur absente ou non-tableau", () => {
    expect(stringArray(undefined)).toEqual([]);
    expect(stringArray("x")).toEqual([]);
  });
});

describe("cardTaxonomyBadges", () => {
  it("garde le plafond HISTORIQUE de 3 mots-clés sur un site sans territoires/publics (régression : un plafond réduit par défaut aurait tronqué des cartes qui n'ont jamais eu que des tags)", () => {
    const article: ArticleData = { tags: ["un", "deux", "trois", "quatre"] };
    expect(cardTaxonomyBadges(article)).toEqual(["un", "deux", "trois"]);
  });

  it("ne plafonne JAMAIS territoires/publics (listes courtes, contrôlées par énumération)", () => {
    const article: ArticleData = { territoires: ["Arrageois", "Artois"], publics: ["Parents", "Professionnels", "Bénévoles"], tags: [] };
    expect(cardTaxonomyBadges(article)).toEqual(["Arrageois", "Artois", "Parents", "Professionnels", "Bénévoles"]);
  });

  it("ordonne territoires puis publics puis mots-clés", () => {
    const article: ArticleData = { tags: ["Actus"], territoires: ["Audomarois"], publics: ["En famille"] };
    expect(cardTaxonomyBadges(article)).toEqual(["Audomarois", "En famille", "Actus"]);
  });

  it("renvoie un tableau vide si les trois sont absents", () => {
    expect(cardTaxonomyBadges({})).toEqual([]);
  });
});
