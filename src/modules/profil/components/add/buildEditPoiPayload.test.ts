/**
 * Garde du payload d'édition POI équipement (pattern unifié S6). `buildEditPoiPayload` renvoie un payload
 * COMPLET (tous les champs éditables ; pas un delta), vides → clear typé, adresse en OBJET imbriqué (14
 * champs, round-trip non destructif). À `Object.assign(poi.data)` + `save()` : le SDK diffe (n'envoie que
 * le modifié), le backend efface ($unset). Remplace l'ancien buildEditDelta (diff client + baseline).
 */
import { describe, it, expect } from "vitest";
import { buildEditPoiPayload } from "./poiEquipement";
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

describe("buildEditPoiPayload (pattern unifié)", () => {
  it("payload COMPLET : champs émis (pas un delta) ; false préservé ; adresse imbriquée, jamais de clé plate", () => {
    const p = buildEditPoiPayload({ ...base }) as Record<string, unknown>;
    expect(p.name).toBe("Stade");
    expect(p.equip_eclair).toBe(false);          // false NON vide → préservé
    expect(p.equip_long).toBe(10);               // number renseigné → préservé
    expect("address" in p).toBe(true);           // adresse imbriquée présente
    expect("addressCountry" in p).toBe(false);   // jamais de clé plate d'adresse
    expect("streetAddress" in p).toBe(false);
  });

  it("adresse → objet imbriqué COMPLET (14 champs, level1-4/codeInsee préservés)", () => {
    const p = buildEditPoiPayload({ ...base }) as { address: Record<string, unknown> };
    expect(p.address).toMatchObject({
      streetAddress: "1 rue X", localityId: "abc", codeInsee: "97411",
      level1: "L1", level4Name: "N4", level2: "L2", level3Name: "N3",
    });
  });

  it("champ vidé → clear typé ('' string/number, [] array)", () => {
    expect(buildEditPoiPayload({ ...base, name: "" }).name).toBe("");                          // string → ""
    expect(buildEditPoiPayload({ ...base, equip_long: undefined as never }).equip_long).toBe(""); // number vidé → ""
    expect(buildEditPoiPayload({ ...base, urls: [] }).urls).toEqual([]);                        // array → []
  });

  it("geo/geoPosition (writeOnly) émis au WRITE", () => {
    const p = buildEditPoiPayload({ ...base }) as Record<string, unknown>;
    expect(p.geo).toMatchObject({ latitude: 1, longitude: 2 });
    expect(p.geoPosition).toMatchObject({ type: "Point" });
  });
});
