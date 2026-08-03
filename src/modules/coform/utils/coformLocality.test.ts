import { describe, it, expect } from "vitest";
import { parseStoredToEntries, entriesToStored } from "./coformLocality";
import type { FormLocalityEntry } from "@/lib/location/types";

const entry = (localityId: string, locality: string, center = false): FormLocalityEntry => ({
  address: { "@type": "PostalAddress", addressCountry: "FR", addressLocality: locality, localityId, level1: "z", level1Name: "R" },
  geo: { "@type": "GeoCoordinates", latitude: "48.85", longitude: "2.35" },
  geoPosition: { type: "Point", coordinates: [2.35, 48.85] },
  ...(center ? { center: true } : {}),
});

describe("coformLocality", () => {
  it("entriesToStored : recopie l'adresse principale (center) à plat + addresses", () => {
    const a = entry("id1", "Paris", true);
    const b = entry("id2", "Lyon");
    const stored = entriesToStored([a, b]);
    expect(stored).toBeDefined();
    expect(stored!.formLocality).toHaveLength(2);
    expect(stored!.address).toEqual(a.address);
    expect(stored!.geo).toEqual(a.geo);
    expect(stored!.geoPosition).toEqual(a.geoPosition);
    expect(stored!.addresses).toHaveLength(1);
    expect(stored!.addresses![0].address.localityId).toBe("id2");
  });

  it("entriesToStored : la 1re entrée devient center si aucune ne l'est", () => {
    const stored = entriesToStored([entry("id1", "Paris"), entry("id2", "Lyon")]);
    expect(stored!.formLocality[0].center).toBe(true);
    expect(stored!.formLocality[1].center).toBe(false);
    expect(stored!.address!.localityId).toBe("id1");
  });

  it("entriesToStored : écarte les entrées sans localityId ; undefined si tout est vide", () => {
    const invalid: FormLocalityEntry = { ...entry("", "X"), address: { addressLocality: "X" } };
    expect(entriesToStored([invalid])).toBeUndefined();
    expect(entriesToStored([])).toBeUndefined();
  });

  it("round-trip : parseStoredToEntries ∘ entriesToStored conserve les entrées", () => {
    const src = [entry("id1", "Paris", true), entry("id2", "Lyon")];
    const stored = entriesToStored(src);
    const back = parseStoredToEntries(stored);
    expect(back).toHaveLength(2);
    expect(back[0].address.localityId).toBe("id1");
    expect(back[0].center).toBe(true);
    expect(back[1].address.localityId).toBe("id2");
  });

  it("parseStoredToEntries : tolère une ancienne chaîne (bug texte) → []", () => {
    expect(parseStoredToEntries("Paris")).toEqual([]);
    expect(parseStoredToEntries(undefined)).toEqual([]);
    expect(parseStoredToEntries(null)).toEqual([]);
  });

  it("parseStoredToEntries : reconstruit une entrée depuis un objet legacy plat {address,geo,geoPosition}", () => {
    const legacy = {
      address: { "@type": "PostalAddress", addressCountry: "RE", addressLocality: "Saint-Denis", localityId: "id9" },
      geo: { "@type": "GeoCoordinates", latitude: "-20.88", longitude: "55.45" },
      geoPosition: { type: "Point", coordinates: [55.45, -20.88] },
    };
    const back = parseStoredToEntries(legacy);
    expect(back).toHaveLength(1);
    expect(back[0].address.localityId).toBe("id9");
    expect(back[0].center).toBe(true);
  });
});
