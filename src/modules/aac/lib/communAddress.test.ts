import { describe, expect, it } from "vitest";
import { countCommuneFacets, readCommunAddress, type AacCommunAddress } from "./communAddress";

/** Une entrée telle que `buildLocalityEntry` l'écrit. */
const entry = (locality: string, over: Record<string, unknown> = {}) => ({
  address: {
    "@type": "PostalAddress",
    addressCountry: "FR",
    addressLocality: locality,
    postalCode: "97400",
    streetAddress: "12 rue Juliette Dodu",
    localityId: `city-${locality}`,
    ...over,
  },
  geo: { "@type": "GeoCoordinates", latitude: "-20.88", longitude: "55.45" },
  geoPosition: { type: "Point", coordinates: [55.45, -20.88] },
});

describe("readCommunAddress", () => {
  it("la forme STOCKÉE du champ adresse : `{formLocality, address, …}`", () => {
    const stored = {
      formLocality: [{ ...entry("Saint-Denis"), center: true }],
      address: entry("Saint-Denis").address,
      geo: entry("Saint-Denis").geo,
      geoPosition: entry("Saint-Denis").geoPosition,
    };

    expect(readCommunAddress(stored)).toEqual({
      locality: "Saint-Denis",
      postalCode: "97400",
      streetAddress: "12 rue Juliette Dodu",
      country: "FR",
      localityId: "city-Saint-Denis",
      label: "12 rue Juliette Dodu, 97400, Saint-Denis",
    } satisfies AacCommunAddress);
  });

  it("plusieurs adresses : c'est celle marquée `center` qui fait foi, pas la première", () => {
    const stored = {
      formLocality: [
        { ...entry("Le Tampon"), center: false },
        { ...entry("Saint-Pierre"), center: true },
      ],
    };

    expect(readCommunAddress(stored)?.locality).toBe("Saint-Pierre");
  });

  it("aucune entrée marquée `center` : la première, comme côté coform", () => {
    const stored = { formLocality: [entry("Le Tampon"), entry("Saint-Pierre")] };

    expect(readCommunAddress(stored)?.locality).toBe("Le Tampon");
  });

  it("forme legacy PLATE (`{address, geo}` sans `formLocality`) — la donnée en base l'est encore", () => {
    expect(readCommunAddress(entry("Saint-Paul"))?.locality).toBe("Saint-Paul");
  });

  it("une CHAÎNE (l'override vise une question texte) devient le libellé, sans commune", () => {
    expect(readCommunAddress("  12 rue du Port, Le Port  ")).toEqual({
      locality: "",
      postalCode: "",
      streetAddress: "",
      country: "",
      localityId: "",
      label: "12 rue du Port, Le Port",
    });
  });

  it("le libellé omet les segments absents, sans virgule orpheline", () => {
    const stored = { formLocality: [entry("Saint-Louis", { streetAddress: "", postalCode: "" })] };

    expect(readCommunAddress(stored)?.label).toBe("Saint-Louis");
  });

  it("rien à afficher ⇒ `null` : rôle non configuré, valeur vide, ou adresse sans le moindre libellé", () => {
    expect(readCommunAddress(undefined)).toBeNull();
    expect(readCommunAddress(null)).toBeNull();
    expect(readCommunAddress("   ")).toBeNull();
    expect(readCommunAddress({})).toBeNull();
    expect(readCommunAddress({ formLocality: [] })).toBeNull();
    // Une entrée dont l'adresse ne porte QUE des identifiants : rien de lisible.
    expect(readCommunAddress({ formLocality: [{ address: { localityId: "x" } }] })).toBeNull();
  });
});

describe("countCommuneFacets", () => {
  const card = (locality: string | null) => ({
    address: locality ? ({ ...readCommunAddress(entry(locality)) } as AacCommunAddress) : null,
  });

  it("décompte par commune, du plus fréquent au moins fréquent puis par ordre alphabétique", () => {
    expect(
      countCommuneFacets([
        card("Saint-Pierre"),
        card("Saint-Denis"),
        card("Saint-Denis"),
        card("Le Tampon"),
      ])
    ).toEqual([
      { id: "Saint-Denis", label: "Saint-Denis", count: 2 },
      { id: "Le Tampon", label: "Le Tampon", count: 1 },
      { id: "Saint-Pierre", label: "Saint-Pierre", count: 1 },
    ]);
  });

  it("les communs SANS adresse ne pèsent sur aucune option", () => {
    expect(countCommuneFacets([card(null), card(null)])).toEqual([]);
  });

  it("une adresse en texte libre n'a pas de commune : aucune option, plutôt qu'une option vide", () => {
    const freeText = { address: readCommunAddress("12 rue du Port") };

    expect(freeText.address).not.toBeNull();
    expect(countCommuneFacets([freeText])).toEqual([]);
  });
});
