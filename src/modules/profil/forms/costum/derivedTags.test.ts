import { describe, it, expect } from "vitest";
import { tagsSansDerive, tagsAvecDerive } from "./derivedTags";

const TABLE = { "a-la-une": "A la une", zoom: "Zoom" };

describe("tagsSansDerive (read)", () => {
  it("masque le tag du type ENREGISTRÉ, garde les mots-clés libres", () => {
    expect(tagsSansDerive(["Parentalité", "A la une"], "a-la-une", TABLE)).toEqual(["Parentalité"]);
  });

  it("ne masque pas le tag d'un AUTRE type : posé à la main, il doit rester modifiable", () => {
    expect(tagsSansDerive(["A la une", "Parentalité"], "actualite", TABLE)).toEqual(["A la une", "Parentalité"]);
    expect(tagsSansDerive(["A la une"], "zoom", TABLE)).toEqual(["A la une"]);
  });

  it("coerce comme le champ tags natif (CSV, vides, non-chaînes)", () => {
    expect(tagsSansDerive("Zoom, Famille, ", "zoom", TABLE)).toEqual(["Famille"]);
    expect(tagsSansDerive(undefined, undefined, TABLE)).toEqual([]);
    expect(tagsSansDerive(["", 3, "x"], undefined, TABLE)).toEqual(["x"]);
  });
});

describe("tagsAvecDerive (write)", () => {
  it("ajoute le tag du type choisi aux mots-clés saisis", () => {
    expect(tagsAvecDerive(["Parentalité"], "zoom", TABLE)).toEqual(["Parentalité", "Zoom"]);
  });

  it("n'ajoute rien pour un type sans tag, et ne double jamais", () => {
    expect(tagsAvecDerive(["x"], "actualite", TABLE)).toEqual(["x"]);
    expect(tagsAvecDerive(["Zoom"], "zoom", TABLE)).toEqual(["Zoom"]);
    expect(tagsAvecDerive([], undefined, TABLE)).toEqual([]);
  });
});

describe("plusieurs types", () => {
  it("pose le tag de CHAQUE type choisi, sous forme de tableau (formulaire) ou de texte « a, b » (stockage)", () => {
    expect(tagsAvecDerive(["Famille"], ["a-la-une", "zoom"], TABLE)).toEqual(["Famille", "A la une", "Zoom"]);
    expect(tagsAvecDerive([], "a-la-une, zoom", TABLE)).toEqual(["A la une", "Zoom"]);
  });

  it("masque les tags de tous les types enregistrés", () => {
    expect(tagsSansDerive(["A la une", "Famille", "Zoom"], "a-la-une, zoom", TABLE)).toEqual(["Famille"]);
  });

  it("décocher un des types retire SON tag et garde l'autre", () => {
    const affiches = tagsSansDerive(["A la une", "Zoom"], "a-la-une, zoom", TABLE);
    expect(tagsAvecDerive(affiches, ["zoom"], TABLE)).toEqual(["Zoom"]);
  });
});

describe("aller-retour d'une édition", () => {
  it("changer de type REMPLACE le tag : « À la une » → « Zoom » ne laisse pas « A la une »", () => {
    const affiches = tagsSansDerive(["Famille", "A la une"], "a-la-une", TABLE);
    expect(tagsAvecDerive(affiches, "zoom", TABLE)).toEqual(["Famille", "Zoom"]);
  });

  it("repasser en type sans tag retire le tag dérivé", () => {
    expect(tagsAvecDerive(tagsSansDerive(["A la une"], "a-la-une", TABLE), "actualite", TABLE)).toEqual([]);
  });

  it("une édition sans changement rend les mêmes tags (enregistrement neutre)", () => {
    const serveur = ["Famille", "A la une"];
    expect(tagsAvecDerive(tagsSansDerive(serveur, "a-la-une", TABLE), "a-la-une", TABLE)).toEqual(serveur);
  });
});
