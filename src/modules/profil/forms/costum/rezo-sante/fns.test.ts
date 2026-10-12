/**
 * Les deux helpers purs de `fns.ts` — la réconciliation `tags` ⇄ `thematic` des formulaires
 * EcosystemeSanteReunion, prise séparément du pipeline (celui-ci est couvert par
 * `../../rezo-sante.configDriven.test.ts`).
 */
import { describe, it, expect } from "vitest";
import { MARQUEUR_LIEU, tagsHorsThematiques, tagsAvecThematiques } from "./fns";

describe("tagsHorsThematiques (lecture)", () => {
  it("retire des tags les thématiques de la fiche, garde les mots-clés libres et leur ordre", () => {
    expect(tagsHorsThematiques(["a", "Nutrition", "b", "Sommeil", "c"], ["Nutrition", "Sommeil"]))
      .toEqual(["a", "b", "c"]);
  });

  it("garde un tag identique à une thématique NON renseignée sur la fiche", () => {
    // Fiche importée / antérieure aux formulaires : le masquer le rendrait invisible tout en le
    // laissant en base, et l'écriture le supprimerait à l'insu de tous.
    expect(tagsHorsThematiques(["Nutrition"], [])).toEqual(["Nutrition"]);
    expect(tagsHorsThematiques(["Nutrition"], undefined)).toEqual(["Nutrition"]);
  });

  it("neutre en création (serverData vide)", () => {
    expect(tagsHorsThematiques(undefined, undefined)).toEqual([]);
  });

  it("normalise les formes scalaires que le serveur peut renvoyer", () => {
    expect(tagsHorsThematiques("littoral", "Nutrition")).toEqual(["littoral"]);
    expect(tagsHorsThematiques("Nutrition", "Nutrition")).toEqual([]);
    // Un tag n'est qu'un TEXTE : les valeurs non textuelles sont écartées, jamais converties
    // (`toStringArray`, même règle que le `read` par défaut du widget tags) — avant la MR 76, `String(1)`.
    expect(tagsHorsThematiques([1, 2, "trois"], [2])).toEqual(["trois"]);
  });
});

describe("tagsAvecThematiques (écriture)", () => {
  it("réunit mots-clés saisis et thématiques cochées, sans doublon, ordre préservé", () => {
    expect(tagsAvecThematiques(["littoral"], ["Nutrition", "Sommeil"]))
      .toEqual(["littoral", "Nutrition", "Sommeil"]);
  });

  it("ne duplique pas un mot-clé déjà égal à une thématique cochée", () => {
    expect(tagsAvecThematiques(["Nutrition", "littoral"], ["Nutrition"])).toEqual(["Nutrition", "littoral"]);
  });

  it("aucune thématique cochée : les mots-clés libres passent tels quels", () => {
    expect(tagsAvecThematiques(["littoral"], [])).toEqual(["littoral"]);
    expect(tagsAvecThematiques(["littoral"], undefined)).toEqual(["littoral"]);
  });

  it("aucun mot-clé libre : seules les thématiques partent", () => {
    expect(tagsAvecThematiques([], ["Nutrition"])).toEqual(["Nutrition"]);
    expect(tagsAvecThematiques(undefined, undefined)).toEqual([]);
  });

  it("aller-retour : lire puis écrire redonne l'ensemble d'origine (à l'ordre près)", () => {
    const enBase = ["Nutrition", "littoral"];
    const thematic = ["Nutrition"];
    expect([...tagsAvecThematiques(tagsHorsThematiques(enBase, thematic), thematic)].sort())
      .toEqual([...enBase].sort());
  });

  it("le marqueur des lieux n'est jamais un mot-clé libre d'un acteur : retiré à l'écriture", () => {
    // L'autocomplétion réseau du widget le propose dès qu'un lieu existe ; un acteur qui le garderait
    // sortirait de /annuaire et s'éditerait avec le formulaire lieu.
    expect(tagsAvecThematiques(["pharmacie", MARQUEUR_LIEU, "garde"], ["Nutrition"])).toEqual(["pharmacie", "garde", "Nutrition"]);
    expect(tagsAvecThematiques([MARQUEUR_LIEU], [])).toEqual([]);
  });

  it("tags en objet PHP à trous (forme réelle en base) : lus comme un tableau, jamais « [object Object] »", () => {
    expect(tagsHorsThematiques({ "0": "Nutrition", "2": "littoral" }, ["Nutrition"])).toEqual(["littoral"]);
    expect(tagsAvecThematiques({ "0": "littoral" }, ["Sommeil"])).toEqual(["littoral", "Sommeil"]);
  });
});
