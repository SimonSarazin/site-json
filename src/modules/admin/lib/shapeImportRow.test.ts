import { describe, it, expect } from "vitest";
import { shapeImportRow } from "./shapeImportRow";

describe("shapeImportRow — dépliage des clés pointées", () => {
  it("« address.postalCode » → objet imbriqué address{postalCode}", () => {
    expect(shapeImportRow({ "address.postalCode": "97410" })).toEqual({
      address: { postalCode: "97410", addressCountry: "RE" },
    });
  });

  it("dépliage générique multi-niveaux (a.b.c)", () => {
    expect(shapeImportRow({ "a.b.c": "v" })).toEqual({ a: { b: { c: "v" } } });
  });

  it("plusieurs clés pointées partageant un préfixe fusionnent dans le même objet", () => {
    const out = shapeImportRow({
      "address.postalCode": "75001",
      "address.addressLocality": "Paris",
    });
    expect(out.address).toEqual({
      postalCode: "75001",
      addressLocality: "Paris",
      addressCountry: "FR",
    });
  });
});

describe("shapeImportRow — alias plats repliés sous address{}", () => {
  it("postalCode / streetAddress / addressLocality / codeInsee → address{}", () => {
    const out = shapeImportRow({
      postalCode: "97400",
      streetAddress: "12 rue des Manguiers",
      addressLocality: "Saint-Denis",
      codeInsee: "97411",
      name: "Foo",
    });
    expect(out).toEqual({
      name: "Foo",
      address: {
        postalCode: "97400",
        streetAddress: "12 rue des Manguiers",
        addressLocality: "Saint-Denis",
        codeInsee: "97411",
        addressCountry: "RE",
      },
    });
  });

  it("alias FR : « ville » → addressLocality, « adresse » → streetAddress", () => {
    const out = shapeImportRow({ ville: "Le Tampon", adresse: "1 place de la Mairie" });
    expect(out.address).toMatchObject({
      addressLocality: "Le Tampon",
      streetAddress: "1 place de la Mairie",
    });
  });

  it("alias EN : « city » → addressLocality", () => {
    const out = shapeImportRow({ city: "Lyon" });
    expect(out.address).toMatchObject({ addressLocality: "Lyon" });
    expect(out).not.toHaveProperty("city");
  });

  it("alias plat + clé pointée address.* cohabitent dans le même address{}", () => {
    const out = shapeImportRow({ postalCode: "97200", "address.streetAddress": "2 rue Neuve" });
    expect(out.address).toEqual({
      postalCode: "97200",
      streetAddress: "2 rue Neuve",
      addressCountry: "MQ",
    });
  });
});

describe("shapeImportRow — tags chaîne → tableau", () => {
  it("séparateur virgule", () => {
    expect(shapeImportRow({ tags: "sport,culture" }).tags).toEqual(["sport", "culture"]);
  });

  it("séparateur point-virgule", () => {
    expect(shapeImportRow({ tags: "sport;culture" }).tags).toEqual(["sport", "culture"]);
  });

  it("séparateurs mélangés + trim de chaque tag", () => {
    expect(shapeImportRow({ tags: " sport , culture ; nature " }).tags).toEqual([
      "sport",
      "culture",
      "nature",
    ]);
  });

  it("tags vides filtrés (« a,,b, » → [a, b])", () => {
    expect(shapeImportRow({ tags: "a,,b," }).tags).toEqual(["a", "b"]);
  });

  it("tags non-string (déjà tableau) passe tel quel", () => {
    expect(shapeImportRow({ tags: ["a", "b"] }).tags).toEqual(["a", "b"]);
  });
});

describe("shapeImportRow — nettoyage des cellules", () => {
  it("valeurs \"\" et null retirées", () => {
    expect(shapeImportRow({ name: "Foo", empty: "", nul: null })).toEqual({ name: "Foo" });
  });

  it("valeur espaces-seulement retirée (trim → \"\")", () => {
    expect(shapeImportRow({ blank: "   " })).toEqual({});
  });

  it("clés avec espaces trimées", () => {
    expect(shapeImportRow({ "  name  ": "Foo" })).toEqual({ name: "Foo" });
  });

  it("valeurs string trimées (espaces parasites Excel)", () => {
    expect(shapeImportRow({ name: "  Foo  " })).toEqual({ name: "Foo" });
  });

  it("clé vide (ou espaces) ignorée", () => {
    expect(shapeImportRow({ "": "x", "   ": "y" })).toEqual({});
  });

  it("valeurs non-string conservées telles quelles (nombre, booléen)", () => {
    expect(shapeImportRow({ n: 42, b: false })).toEqual({ n: 42, b: false });
  });
});

describe("shapeImportRow — addressCountry dérivé du code postal", () => {
  it.each([
    ["97110", "GP"], // Guadeloupe
    ["97200", "MQ"], // Martinique
    ["97300", "GF"], // Guyane
    ["97410", "RE"], // La Réunion
    ["97600", "YT"], // Mayotte
    ["75001", "FR"], // métropole
  ])("code postal %s → %s", (cp, pays) => {
    const out = shapeImportRow({ postalCode: cp });
    expect((out.address as Record<string, unknown>).addressCountry).toBe(pays);
  });

  it("code postal numérique (dynamicTyping) dérivé aussi", () => {
    const out = shapeImportRow({ postalCode: 97410 });
    expect((out.address as Record<string, unknown>).addressCountry).toBe("RE");
  });

  it("adresse sans code postal → défaut FR", () => {
    const out = shapeImportRow({ ville: "Paris" });
    expect((out.address as Record<string, unknown>).addressCountry).toBe("FR");
  });

  it("addressCountry déjà posé (alias plat) → non écrasé", () => {
    const out = shapeImportRow({ postalCode: "97410", addressCountry: "BE" });
    expect((out.address as Record<string, unknown>).addressCountry).toBe("BE");
  });

  it("addressCountry déjà posé (clé pointée) → non écrasé", () => {
    const out = shapeImportRow({ "address.postalCode": "97410", "address.addressCountry": "MU" });
    expect((out.address as Record<string, unknown>).addressCountry).toBe("MU");
  });

  it("pas d'address → pas d'addressCountry inventé", () => {
    expect(shapeImportRow({ name: "Foo" })).toEqual({ name: "Foo" });
  });

  describe("headerToAttr (traduction en-tête → attribut, rôle du costum.import.mapping)", () => {
    it("traduit l'en-tête humaine vers l'attribut technique", () => {
      const out = shapeImportRow({ Sol: "Bitume", Installation: "Stade A" }, { Sol: "equip_sol", Installation: "inst_nom" });
      expect(out).toEqual({ equip_sol: "Bitume", inst_nom: "Stade A" });
    });

    it("en-tête absente de la map → colonne IGNORÉE (comme infoCreateData legacy)", () => {
      const out = shapeImportRow({ Sol: "Bitume", Inconnu: "x" }, { Sol: "equip_sol" });
      expect(out).toEqual({ equip_sol: "Bitume" });
    });

    it("en-tête mappée à \"\" → ignorée", () => {
      const out = shapeImportRow({ Sol: "Bitume", Note: "à retirer" }, { Sol: "equip_sol", Note: "" });
      expect(out).toEqual({ equip_sol: "Bitume" });
    });

    it("attribut pointé après traduction → imbrication (Département → address.level4Name)", () => {
      const out = shapeImportRow({ "Département": "La Réunion" }, { "Département": "address.level4Name" });
      expect(out).toEqual({ address: { level4Name: "La Réunion", addressCountry: "FR" } });
    });

    it("traduction vers un alias adresse → repli sous address{} + pays dérivé du CP", () => {
      const out = shapeImportRow({ CP: "97410", Ville: "Saint-Pierre" }, { CP: "postalCode", Ville: "city" });
      expect(out.address).toEqual({ postalCode: "97410", addressLocality: "Saint-Pierre", addressCountry: "RE" });
    });

    it("sans map → comportement historique inchangé (noms techniques passent)", () => {
      const out = shapeImportRow({ equip_sol: "Bitume", name: "X" });
      expect(out).toEqual({ equip_sol: "Bitume", name: "X" });
    });
  });
});
