/**
 * Garde du delta d'édition POI équipement (pipeline, P2). `buildEditDelta` remplace `buildEditPatch` +
 * `transformFormDataWithAddress` : ne renvoie QUE les champs modifiés/vidés, l'adresse en OBJET imbriqué
 * (jamais de clés plates), un champ vidé est réellement effacé (clear typé — l'ancien lâchait l'`undefined`).
 */
import { describe, it, expect } from "vitest";
import { buildEditDelta } from "./poiEquipement";
import type { AddPoiFormData } from "../../schemaForm";

const base = {
  name: "Stade",
  equip_eclair: false,
  equip_long: 10,
  urls: [],
  addressCountry: "FR",
  addressLocality: "Saint-Denis",
  localityId: "abc",
  postalCode: "97400",
  streetAddress: "1 rue X",
  codeInsee: "97411",
  level1: "L1", level1Name: "Réunion",
  level2: "L2", level2Name: "N2",
  level3: "L3", level3Name: "N3",
  level4: "L4", level4Name: "N4",
  geo: { latitude: 1, longitude: 2 },
  geoPosition: { type: "Point", coordinates: [2, 1] },
} as unknown as AddPoiFormData;

describe("buildEditDelta (pipeline)", () => {
  it("aucun changement → delta vide", () => {
    expect(buildEditDelta({ ...base }, base)).toEqual({});
  });

  it("un champ hors adresse modifié → seul ce champ (jamais de clé d'adresse)", () => {
    const d = buildEditDelta({ ...base, equip_eclair: true }, base);
    expect(d).toEqual({ equip_eclair: true });
    expect("address" in d).toBe(false);
    expect("addressCountry" in d).toBe(false); // pas de clé plate d'adresse
  });

  it("adresse modifiée → objet `address` imbriqué (sous-champs préservés), pas de clé plate", () => {
    const d = buildEditDelta({ ...base, streetAddress: "2 rue Y" }, base) as Record<string, unknown>;
    expect(d.address).toMatchObject({ streetAddress: "2 rue Y", level4Name: "N4", localityId: "abc" });
    expect("streetAddress" in d).toBe(false);
    expect("addressCountry" in d).toBe(false);
  });

  it("champ vidé → clear typé (corrige le bug : l'ancien lâchait l'undefined)", () => {
    expect(buildEditDelta({ ...base, name: "" }, base)).toEqual({ name: "" });                          // string → ""
    expect(buildEditDelta({ ...base, equip_long: undefined as never }, base)).toEqual({ equip_long: "" }); // number vidé → "" (clear)
  });
});
