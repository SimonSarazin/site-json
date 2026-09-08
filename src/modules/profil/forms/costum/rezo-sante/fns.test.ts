/**
 * Les deux helpers purs de `fns.ts` — la réconciliation `tags` ⇄ `thematic` des formulaires
 * EcosystemeSanteReunion, prise séparément du pipeline (celui-ci est couvert par
 * `../../rezo-sante.configDriven.test.ts`).
 */
import { describe, it, expect } from "vitest";
import { tagsHorsThematiques, tagsAvecThematiques } from "./fns";

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
    expect(tagsHorsThematiques([1, 2], [2])).toEqual(["1"]);
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
});
