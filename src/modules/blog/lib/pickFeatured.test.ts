import { describe, it, expect } from "vitest";

import { pickFeatured } from "./pickFeatured";

import type { ArticleData } from "../hooks/useArticle";

const a = (id: string) => ({ id, name: id }) as unknown as ArticleData;
const ITEMS = [a("recent"), a("milieu"), a("ancien")];

describe("pickFeatured (mode featured d'articleFeed)", () => {
  it("sans mode : pas de une, fil intact", () => {
    expect(pickFeatured(ITEMS, undefined, undefined)).toEqual({ hero: undefined, rest: ITEMS });
    expect(pickFeatured(ITEMS, undefined, false)).toEqual({ hero: undefined, rest: ITEMS });
  });

  it("true : la une = le plus récent (comportement historique)", () => {
    const { hero, rest } = pickFeatured(ITEMS, undefined, true);
    expect(hero?.id).toBe("recent");
    expect(rest.map((x) => x.id)).toEqual(["milieu", "ancien"]);
  });

  it("flag : la une = l'ÉPINGLÉE, dédupliquée du fil PAR ID même hors tête de liste", () => {
    const { hero, rest } = pickFeatured(ITEMS, a("ancien"), "flag");
    expect(hero?.id).toBe("ancien");
    // « ancien » vit en page courante → retiré du fil ; rien d'autre ne bouge.
    expect(rest.map((x) => x.id)).toEqual(["recent", "milieu"]);
  });

  it("flag : l'épinglée peut vivre HORS de la fenêtre chargée — elle est en une, le fil est intact", () => {
    const { hero, rest } = pickFeatured(ITEMS, a("hors-page"), "flag");
    expect(hero?.id).toBe("hors-page");
    expect(rest.map((x) => x.id)).toEqual(["recent", "milieu", "ancien"]);
  });

  it("flag sans épinglée : REPLI sur le plus récent (jamais de une vide)", () => {
    const { hero, rest } = pickFeatured(ITEMS, undefined, "flag");
    expect(hero?.id).toBe("recent");
    expect(rest.map((x) => x.id)).toEqual(["milieu", "ancien"]);
  });

  it("fil vide : rien ne casse", () => {
    expect(pickFeatured([], undefined, "flag")).toEqual({ hero: undefined, rest: [] });
  });
});
