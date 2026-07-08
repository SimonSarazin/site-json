import { describe, it, expect } from "vitest";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import {
  isValidGeoPoint,
  getEntryId,
  getEntryCoords,
  getEntrySlug,
  findEntryById,
} from "./searchMapSelection";

const entry = (serverData: Record<string, unknown>, root: Record<string, unknown> = {}) =>
  ({ ...root, serverData } as unknown as SearchEntity);

describe("isValidGeoPoint", () => {
  it("accepte un tuple [lng, lat] dans les bornes", () => {
    expect(isValidGeoPoint([55.3, -21.2])).toBe(true);
    expect(isValidGeoPoint([-180, 90])).toBe(true);
  });
  it("rejette les formes invalides ou hors bornes", () => {
    expect(isValidGeoPoint([200, 0])).toBe(false); // lng > 180
    expect(isValidGeoPoint([0, 100])).toBe(false); // lat > 90
    expect(isValidGeoPoint([1])).toBe(false);
    expect(isValidGeoPoint(["1", "2"])).toBe(false);
    expect(isValidGeoPoint(null)).toBe(false);
  });
});

describe("getEntryId", () => {
  it("renvoie l'id en string (number ou string en entrée)", () => {
    expect(getEntryId(entry({ id: 42 }))).toBe("42");
    expect(getEntryId(entry({ id: "abc" }))).toBe("abc");
  });
  it("privilégie l'id RACINE de l'entité (getter SDK) sur serverData.id", () => {
    // Sur les résultats de recherche, l'id vit sur `entry.id` (getter), pas
    // forcément sur serverData → on doit le lire en priorité.
    expect(getEntryId(entry({ id: "sd" }, { id: "root" }))).toBe("root");
    expect(getEntryId(entry({}, { id: 7 }))).toBe("7");
  });
  it("renvoie undefined sans id", () => {
    expect(getEntryId(entry({}))).toBeUndefined();
    expect(getEntryId(undefined)).toBeUndefined();
  });
});

describe("getEntryCoords", () => {
  it("renvoie le tuple quand géolocalisé valide (number)", () => {
    expect(getEntryCoords(entry({ geoPosition: { coordinates: [55.3, -21.2] } }))).toEqual([55.3, -21.2]);
  });
  it("coerce les coordonnées geoPosition en string (donnée API Communecter)", () => {
    expect(getEntryCoords(entry({ geoPosition: { coordinates: ["55.3", "-21.2"] } }))).toEqual([55.3, -21.2]);
  });
  it("replie sur `geo: { latitude, longitude }` (souvent en string)", () => {
    expect(getEntryCoords(entry({ geo: { latitude: "-21.2", longitude: "55.3" } }))).toEqual([55.3, -21.2]);
    expect(getEntryCoords(entry({ geo: { latitude: -21.2, longitude: 55.3 } }))).toEqual([55.3, -21.2]);
  });
  it("préfère geoPosition au repli geo quand les deux sont présents", () => {
    expect(
      getEntryCoords(entry({ geoPosition: { coordinates: [1, 2] }, geo: { latitude: "9", longitude: "8" } })),
    ).toEqual([1, 2]);
  });
  it("renvoie null sans géoloc, hors bornes, ou string vide (piège Number(''))", () => {
    expect(getEntryCoords(entry({}))).toBeNull();
    expect(getEntryCoords(entry({ geoPosition: { coordinates: [999, 0] } }))).toBeNull();
    expect(getEntryCoords(entry({ geo: { latitude: "", longitude: "" } }))).toBeNull();
    expect(getEntryCoords(entry({ geo: { latitude: "abc", longitude: "1" } }))).toBeNull();
    expect(getEntryCoords(undefined)).toBeNull();
  });
});

describe("getEntrySlug", () => {
  it("préfère le slug racine, sinon serverData, sinon undefined", () => {
    expect(getEntrySlug(entry({ slug: "sd" }, { slug: "root" }))).toBe("root");
    expect(getEntrySlug(entry({ slug: "sd" }))).toBe("sd");
    expect(getEntrySlug(entry({}))).toBeUndefined();
  });
});

describe("findEntryById", () => {
  const list = [entry({ id: 1 }), entry({ id: 2 }), entry({ id: "3" })];
  it("trouve par id (comparaison string)", () => {
    expect(getEntryId(findEntryById(list, "2"))).toBe("2");
    expect(getEntryId(findEntryById(list, 3 as unknown as string))).toBe("3");
  });
  it("renvoie undefined si absent ou id nul", () => {
    expect(findEntryById(list, "99")).toBeUndefined();
    expect(findEntryById(list, null)).toBeUndefined();
    expect(findEntryById(list, undefined)).toBeUndefined();
  });
});
