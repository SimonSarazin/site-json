/**
 * Garde du patch d'édition POI équipement (cf. revue spike formEngine, finding sévère :
 * envoi du form entier → reconstruction lossy de l'adresse + dates parasites).
 * `buildEditPatch` ne doit renvoyer QUE les champs modifiés ; l'adresse est atomique.
 */
import { describe, it, expect } from "vitest";
import { buildEditPatch, ADDRESS_PATCH_KEYS } from "./poiEquipement";
import type { AddPoiFormData } from "../../schemaForm";

// base minimale typée "souple" : on ne teste que la mécanique de diff.
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

describe("buildEditPatch", () => {
  it("aucun changement → patch vide", () => {
    expect(buildEditPatch({ ...base }, base)).toEqual({});
  });

  it("un champ hors adresse modifié → seul ce champ", () => {
    const patch = buildEditPatch({ ...base, equip_eclair: true }, base);
    expect(patch).toEqual({ equip_eclair: true });
    // aucun champ d'adresse ne fuite (sinon écrasement parasite côté lib)
    for (const k of ADDRESS_PATCH_KEYS) expect(k in patch).toBe(false);
  });

  it("un champ d'adresse modifié → bloc adresse complet + geo/geoPosition", () => {
    const patch = buildEditPatch({ ...base, streetAddress: "2 rue Y" }, base) as Record<string, unknown>;
    // tous les sous-champs géo sont (re)transmis ensemble — pas de perte de level2..4
    for (const k of ADDRESS_PATCH_KEYS) expect(k in patch).toBe(true);
    expect(patch.streetAddress).toBe("2 rue Y");
    expect(patch.level4Name).toBe("N4");
    expect("geo" in patch).toBe(true);
    expect("geoPosition" in patch).toBe(true);
  });

  it("champ hors adresse modifié → aucun bloc adresse (adresse inchangée préservée)", () => {
    const patch = buildEditPatch({ ...base, name: "Gymnase" }, base) as Record<string, unknown>;
    expect(patch).toEqual({ name: "Gymnase" });
    expect("geo" in patch).toBe(false);
  });
});
