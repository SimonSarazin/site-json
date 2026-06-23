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

  it("geo/geoPosition (writeOnly) POSÉS (adresse éditée) → émis (lat/lng STRING, coords number)", () => {
    const p = buildEditPoiPayload({ ...base }) as Record<string, unknown>;
    expect(p.geo).toEqual({ "@type": "GeoCoordinates", latitude: "1", longitude: "2" }); // coercés en string (geoValid)
    expect(p.geoPosition).toEqual({ type: "Point", coordinates: [2, 1] });                 // coords number (geoPositionValid)
  });

  it("adresse effacée (pas de localityId) → geo/geoPosition CLEAR '' (effacés avec l'adresse)", () => {
    const { localityId: _drop, ...noLoc } = base as Record<string, unknown>;
    const p = buildEditPoiPayload(noLoc as AddPoiFormData) as Record<string, unknown>;
    expect(p.geo).toBe("");
    expect(p.geoPosition).toBe("");
  });

  it("geo/geoPosition ABSENTS (édition SANS toucher l'adresse) → OMIS (geo serveur préservé, pas effacé)", () => {
    // Régression S6 évitée : EditLocationTab pose geo/geoPosition AVEC l'adresse ; ils ne sont JAMAIS seedés
    // au READ (writeOnly). Une édition qui ne touche pas l'adresse a donc geo absent → il NE doit PAS être
    // effacé (sinon perte des coordonnées serveur). cf. fieldPipeline emitEmpty + writeOnly.
    const noGeo = { ...base } as Record<string, unknown>;
    delete noGeo.geo;
    delete noGeo.geoPosition;
    const p = buildEditPoiPayload(noGeo as AddPoiFormData) as Record<string, unknown>;
    expect("geo" in p).toBe(false);            // OMIS (≠ clear "")
    expect("geoPosition" in p).toBe(false);
    expect(p.name).toBe("Stade");              // les autres champs restent émis (payload complet)
    expect(p.address).toBeTruthy();            // adresse toujours reconstruite
  });
});
