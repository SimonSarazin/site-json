import { describe, it, expect } from "vitest";

import { articleDate, articleDateValue, parseArticleDate } from "./articleDate";

type A = Parameters<typeof articleDate>[0];
const art = (o: Record<string, unknown>) => o as unknown as A;

// 1er septembre 2026 et 1er août 2026, en secondes epoch (forme du backend).
const SEPT = 1788220800;
const AOUT = 1785542400;

describe("parseArticleDate — formes acceptées", () => {
  it("epoch en SECONDES (forme du backend)", () => {
    expect(parseArticleDate(SEPT)?.getUTCFullYear()).toBe(2026);
  });
  it("epoch en MILLISECONDES", () => {
    expect(parseArticleDate(SEPT * 1000)?.getUTCFullYear()).toBe(2026);
  });
  it("chaîne ISO (ce qu'écrit le widget date du form)", () => {
    expect(parseArticleDate("2026-09-01")?.getUTCFullYear()).toBe(2026);
  });
  it("chaîne numérique", () => {
    expect(parseArticleDate(String(SEPT))?.getUTCFullYear()).toBe(2026);
  });
  it("vide, null, undefined et non-date → null", () => {
    for (const v of ["", null, undefined, "pas une date"]) expect(parseArticleDate(v)).toBeNull();
  });
});

describe("articleDateValue — la date ÉDITORIALE prime sur la date de saisie", () => {
  it("publicationDate gagne quand elle est posée", () => {
    // Le cas de la régression : saisi le 1er août, publié le 1er septembre. Le fil trie sur
    // publicationDate → l'article sort en tête ; il doit donc porter l'étiquette de septembre.
    expect(articleDateValue(art({ created: AOUT, publicationDate: "2026-09-01" }))).toBe("2026-09-01");
  });

  it("repli sur created quand publicationDate est absente, vide ou nulle", () => {
    for (const pub of [undefined, null, ""]) {
      expect(articleDateValue(art({ created: AOUT, publicationDate: pub }))).toBe(AOUT);
    }
  });

  it("un site qui ne pose pas publicationDate garde le comportement historique", () => {
    expect(articleDateValue(art({ created: AOUT }))).toBe(AOUT);
  });
});

describe("articleDate — sortie formatée", () => {
  it("formate la date éditoriale, pas la date de saisie", () => {
    const avec = articleDate(art({ created: AOUT, publicationDate: "2026-09-01" }));
    const sans = articleDate(art({ created: AOUT }));
    expect(avec).toBeTruthy();
    expect(sans).toBeTruthy();
    expect(avec).not.toBe(sans); // septembre ≠ août : c'est tout l'objet du correctif
  });

  it("rend null plutôt qu'une date invalide (les 5 composants testent la nullité)", () => {
    expect(articleDate(art({ created: undefined }))).toBeNull();
    expect(articleDate(art({ created: "", publicationDate: "" }))).toBeNull();
  });
});
