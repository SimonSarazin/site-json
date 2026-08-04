import { describe, it, expect } from "vitest";
import { buildLocalityEntry } from "./buildLocalityEntry";
import type { City } from "./types";

const cityNoCP: City = {
  id: "5b30cbcf40bb4e6b652cc601",
  name: "Antsirabe",
  country: "MG",
  postalCodes: [],
  level1: "59edc3a66ff99227048b462b",
  level1Name: "Madagascar",
  geo: { "@type": "GeoCoordinates", latitude: "-21.45337", longitude: "47.085447" },
};

const cityRE: City = {
  id: "54c0965cf6b95c141800a518",
  name: "SAINT-GILLES LES BAINS",
  country: "RE",
  insee: "97415",
  postalCodes: [
    {
      postalCode: "97434",
      name: "SAINT-GILLES LES BAINS",
      geo: { latitude: -21.065862, longitude: 55.222177 },
      geoPosition: { type: "Point", coordinates: [55.222177, -21.065862] },
    },
  ],
  level1: "58be4af494ef47df1d0ddbcc",
  level1Name: "La Réunion",
  level3: "58be4af494ef47df1d0ddbcc",
  level3Name: "La Réunion",
  level4: "58be4af494ef47df1d0ddbcc",
  level4Name: "La Réunion",
  geo: { latitude: "-21.03", longitude: "55.23" },
};

describe("buildLocalityEntry", () => {
  it("capture geo/geoPosition depuis le geo de la VILLE même sans code postal (le bug clé)", () => {
    const e = buildLocalityEntry({ addressCountry: "MG", city: cityNoCP });
    expect(e.geo).toEqual({ "@type": "GeoCoordinates", latitude: "-21.45337", longitude: "47.085447" });
    // GeoJSON = [lng, lat], en number
    expect(e.geoPosition).toEqual({ type: "Point", coordinates: [47.085447, -21.45337] });
    expect(e.address.localityId).toBe("5b30cbcf40bb4e6b652cc601");
    expect(e.address.addressLocality).toBe("Antsirabe");
    expect(e.address.addressCountry).toBe("MG");
  });

  it("n'émet que les niveaux présents (épars) — MG : level1 seul, pas de level2..5", () => {
    const e = buildLocalityEntry({ addressCountry: "MG", city: cityNoCP });
    expect(e.address.level1).toBe("59edc3a66ff99227048b462b");
    expect(e.address.level1Name).toBe("Madagascar");
    expect("level2" in e.address).toBe(false);
    expect("level3" in e.address).toBe(false);
    expect("level5" in e.address).toBe(false);
  });

  it("affine la géo avec le code postal choisi (centroïde CP prioritaire sur centre-ville)", () => {
    const e = buildLocalityEntry({ addressCountry: "RE", city: cityRE, postalCode: "97434" });
    expect(e.geo).toEqual({ "@type": "GeoCoordinates", latitude: "-21.065862", longitude: "55.222177" });
    expect(e.geoPosition.coordinates).toEqual([55.222177, -21.065862]);
    expect(e.address.postalCode).toBe("97434");
    expect(e.address.codeInsee).toBe("97415");
    expect(e.address.level3Name).toBe("La Réunion");
  });

  it("affine la géo avec la rue (BAN geo = [lon, lat]) — priorité max", () => {
    const e = buildLocalityEntry({
      addressCountry: "RE",
      city: cityRE,
      postalCode: "97434",
      street: { streetAddress: "Avenue de Bourbon", geo: [55.25, -21.07], type: "street" },
    });
    expect(e.address.streetAddress).toBe("Avenue de Bourbon");
    expect(e.geo).toEqual({ "@type": "GeoCoordinates", latitude: "-21.07", longitude: "55.25" });
    expect(e.geoPosition.coordinates).toEqual([55.25, -21.07]);
  });

  it("omet codeInsee quand il vaut le littéral \"undefined\" (bug legacy)", () => {
    const e = buildLocalityEntry({
      addressCountry: "MG",
      city: { ...cityNoCP, insee: "undefined" },
    });
    expect("codeInsee" in e.address).toBe(false);
  });

  it("marque center quand demandé", () => {
    const e = buildLocalityEntry({ addressCountry: "MG", city: cityNoCP, center: true });
    expect(e.center).toBe(true);
  });
});
