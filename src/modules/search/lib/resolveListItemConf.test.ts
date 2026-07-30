import { describe, it, expect } from "vitest";
import { resolveListItemConf, resolveListItemConfs } from "./resolveListItemConf";
import type { ListConf, SearchListEntity } from "../schema";

const item = (serverData: Record<string, unknown>) => ({ serverData }) as unknown as SearchListEntity;

const article = item({ collection: "poi", type: "article" });
const parole = item({ collection: "poi", type: "affiche" });
const ressource = item({ collection: "poi", type: "recoveryCenter" });
const orga = item({ collection: "organizations", type: "NGO" });

const eq = (field: string, value: string) => ({ field, op: "eq", value });
const poiOf = (type: string) => ({ and: [eq("collection", "poi"), eq("type", type)] });

const BASE: ListConf = {
  columns: { sm: 1, md: 2, lg: 3 },
  card: { type: "default", detailsMode: "drawer", tagColors: { mapping: { Artois: "#b7cb6b" } } },
  preview: { width: "2xl" },
  resource: { design: "card", titleField: "name" },
  itemRules: [
    { id: "poi-article", when: poiOf("article"), card: { type: "resource" }, itemAction: { kind: "link", to: "/blog/:slug" } },
    { id: "poi-parole", when: poiOf("affiche"), card: { type: "testimonial", detailsMode: "dialog" }, preview: { type: "testimonial" }, testimonial: { design: "bubble", quoteField: "description" } },
    { id: "poi-ressource", when: poiOf("recoveryCenter"), card: { type: "resource" }, resource: { design: "card", titleField: "titre" } },
  ],
} as ListConf;

describe("resolveListItemConf — non-régression (le verrou principal)", () => {
  it("sans `itemRules`, renvoie la conf de liste ELLE-MÊME (identité référentielle)", () => {
    const list = { card: { type: "default" } } as ListConf;
    expect(resolveListItemConf(article, list)).toBe(list);
    expect(resolveListItemConfs([article, parole], list)).toEqual([list, list]);
  });

  it("aucune règle ne matche → conf de liste ELLE-MÊME", () => {
    const projet = item({ collection: "projects" });
    expect(resolveListItemConf(projet, BASE)).toBe(BASE);
  });

  it("liste ou item absent → passe-plat", () => {
    expect(resolveListItemConf(article, undefined)).toBeUndefined();
    expect(resolveListItemConf(undefined, BASE)).toBe(BASE);
  });
});

describe("resolveListItemConf — rendu par item", () => {
  it("les trois sous-types POI donnent trois cartes distinctes", () => {
    expect(resolveListItemConf(article, BASE)?.card?.type).toBe("resource");
    expect(resolveListItemConf(parole, BASE)?.card?.type).toBe("testimonial");
    expect(resolveListItemConf(ressource, BASE)?.card?.type).toBe("resource");
  });

  it("PIÈGE des deux sémantiques de `type` : une orga `NGO` ne matche pas une règle POI", () => {
    // `type` vaut un sous-type d'ORGANISATION ici — sans l'ancrage `collection`, une règle POI
    // mal écrite l'attraperait.
    expect(resolveListItemConf(orga, BASE)).toBe(BASE);
  });

  it("carte ET preview proviennent de la MÊME règle (cohérence par construction)", () => {
    const resolved = resolveListItemConf(parole, BASE);
    expect(resolved?.card?.type).toBe("testimonial");
    expect(resolved?.preview?.type).toBe("testimonial");
    expect(resolved?.testimonial?.quoteField).toBe("description");
  });

  it("`card`/`preview` sont FUSIONNÉS sur la base (les clés de page survivent)", () => {
    const resolved = resolveListItemConf(parole, BASE);
    expect(resolved?.card?.tagColors?.mapping).toEqual({ Artois: "#b7cb6b" }); // posé au niveau page
    expect(resolved?.card?.detailsMode).toBe("dialog"); // surchargé par la règle
    expect(resolved?.preview?.width).toBe("2xl"); // posé au niveau page
    expect(resolved?.columns).toEqual({ sm: 1, md: 2, lg: 3 });
  });

  it("un contrat de presenter REMPLACE celui de base (jamais de fusion)", () => {
    const resolved = resolveListItemConf(ressource, BASE);
    expect(resolved?.resource).toEqual({ design: "card", titleField: "titre" });
  });

  it("une règle sans surcharge de presenter laisse le contrat de base intact", () => {
    expect(resolveListItemConf(article, BASE)?.resource).toEqual({ design: "card", titleField: "name" });
  });

  it("porte l'action au clic de la règle", () => {
    expect(resolveListItemConf(article, BASE)?.itemAction).toEqual({ kind: "link", to: "/blog/:slug" });
    expect(resolveListItemConf(parole, BASE)?.itemAction).toBeUndefined();
  });

  it("matche aussi sur le champ synthétique `sourceKeys`", () => {
    const list = {
      card: { type: "default" },
      itemRules: [{ id: "scope", when: { field: "sourceKeys", op: "contains", value: "parent62" }, card: { type: "event" } }],
    } as ListConf;
    const dansLeReseau = item({ collection: "poi", source: { keys: { "0": "parent62" } } });
    const horsReseau = item({ collection: "poi", source: { key: "autre" } });
    expect(resolveListItemConf(dansLeReseau, list)?.card?.type).toBe("event");
    expect(resolveListItemConf(horsReseau, list)).toBe(list);
  });

  it("resolveListItemConfs résout chaque item indépendamment", () => {
    const types = resolveListItemConfs([article, parole, orga], BASE).map((l) => l?.card?.type);
    expect(types).toEqual(["resource", "testimonial", "default"]);
  });
});
