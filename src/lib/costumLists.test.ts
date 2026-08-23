import { describe, it, expect } from "vitest";
import { costumListsOf, isDynamicList, staticListValues } from "./costumLists";

/**
 * Ces règles sont le MIROIR CLIENT de la garde serveur (`ListValuesAction`, `costum.routes.ts`).
 * Leur accord n'est pas cosmétique : si le front tenait pour statique une déclaration que le serveur
 * juge dynamique, il servirait les clés de la recette (`collection`, `where`…) comme si c'étaient des
 * valeurs métier ; dans l'autre sens, il ferait une requête pour une liste qu'il a déjà en mémoire.
 */
describe("isDynamicList — miroir de la garde serveur", () => {
  it("reconnaît les trois formes dynamiques", () => {
    expect(isDynamicList({ type: "badges", category: "cteR" })).toBe(true);
    expect(isDynamicList({ collection: "organizations", distinct: "tags" })).toBe(true);
    expect(isDynamicList({ collection: "poi", where: {}, fields: ["name"] })).toBe(true);
  });

  it("tient pour statique ce qui porte déjà ses valeurs", () => {
    expect(isDynamicList(["Saint-Denis", "Le Port"])).toBe(false);
    expect(isDynamicList({ Pêche: "Pêche" })).toBe(false);
    expect(isDynamicList(undefined)).toBe(false);
  });

  it("exige une CHAÎNE pour `collection` (une map métier homonyme reste statique)", () => {
    expect(isDynamicList({ collection: ["a", "b"] })).toBe(false);
  });
});

describe("staticListValues", () => {
  it("tableau : dédoublonné, vides et non-chaînes exclus, ORDRE PRÉSERVÉ", () => {
    // L'ordre d'une statique est celui voulu par l'administrateur du costum : on ne trie jamais.
    expect(staticListValues(["Zèbre", "Avion", "Zèbre", "", 42, "école"]))
      .toEqual(["Zèbre", "Avion", "école"]);
  });

  it("map valeur→libellé : garde les CLÉS (ce sont elles qui sont stockées)", () => {
    expect(staticListValues({ "Action de l'Etat en mer": "Action de l'Etat en mer", Pêche: "Pêche" }))
      .toEqual(["Action de l'Etat en mer", "Pêche"]);
  });

  it("refuse une déclaration dynamique (elle se résout par requête, pas ici)", () => {
    expect(staticListValues({ collection: "organizations", distinct: "tags" })).toBeNull();
  });

  it("refuse une map indexée par _id : ce sont des ENTITÉS, pas des valeurs", () => {
    expect(staticListValues({
      "60d397874e4178ef7cce7f7f": { name: "x" },
      "60d397874e4178ef7cce7f82": { name: "y" },
    })).toBeNull();
  });
});

describe("costumListsOf — les deux emplacements", () => {
  it("lit `costum.lists`, l'emplacement canonique", () => {
    const carrier = { serverData: { costum: { lists: { a: ["x"] } }, lists: { b: ["y"] } } };
    expect(costumListsOf(carrier)).toEqual({ a: ["x"] });
  });

  it("retombe sur la racine `serverData.lists` (cas unique equipements-sportifs)", () => {
    expect(costumListsOf({ serverData: { lists: { b: ["y"] } } })).toEqual({ b: ["y"] });
  });

  it("sans porteur ni listes, rend un objet vide plutôt que de casser", () => {
    expect(costumListsOf(null)).toEqual({});
    expect(costumListsOf({ serverData: {} })).toEqual({});
  });
});
