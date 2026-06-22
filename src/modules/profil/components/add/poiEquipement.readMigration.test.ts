/**
 * Équivalence READ (P2) : `buildEditDefaults` délègue désormais à `seedFromEntity(POI_READ_DESCRIPTOR)`.
 * Prouve que la sortie reste byte-pour-byte celle de l'ancien mapping coercer-par-coercer :
 * création → createEmptyDefaults ; édition → coercition par type + lecture de l'adresse imbriquée.
 */
import { describe, it, expect } from "vitest";
import type { Poi } from "@communecter/cocolight-api-client";
import { buildEditDefaults, createEmptyDefaults } from "./poiEquipement";

const poiLike = (serverData: Record<string, unknown>) => ({ serverData }) as unknown as Poi;

describe("buildEditDefaults via pipeline (READ) — équivalence", () => {
  it("création (poi null/undefined) → createEmptyDefaults (type=recoveryCenter, addressCountry=RE)", () => {
    expect(buildEditDefaults(null)).toEqual(createEmptyDefaults());
    expect(buildEditDefaults(undefined)).toEqual(createEmptyDefaults());
  });

  it("édition : coerce chaque type + lit l'adresse imbriquée serverData.address", () => {
    const v = buildEditDefaults(poiLike({
      name: "Stade X", type: "place", description: "desc",
      equip_surf: "250", equip_larg: 10, equip_long: "25",            // string/number → number
      equip_eclair: "oui", inst_part_bool: true, equip_pmr_acc: 1, equip_acc_libre: false, // → boolean
      tags: "a,b", aps_name: ["foot"], inst_part_type: "x,y",         // csv/array → string[]
      inst_date_creation: "2020-05-01T12:00:00.000Z",                 // ISO → YYYY-MM-DD
      equip_type_name: "Terrain",
      address: { addressCountry: "FR", addressLocality: "Lyon", localityId: "abc", postalCode: "69001", streetAddress: "1 rue X", codeInsee: "69123" },
    }));
    expect(v).toMatchObject({
      name: "Stade X", type: "place", description: "desc",
      equip_surf: 250, equip_larg: 10, equip_long: 25,
      equip_eclair: true, inst_part_bool: true, equip_pmr_acc: true, equip_acc_libre: false,
      tags: ["a", "b"], aps_name: ["foot"], inst_part_type: ["x", "y"],
      equip_type_name: "Terrain",
      addressCountry: "FR", addressLocality: "Lyon", localityId: "abc", postalCode: "69001", streetAddress: "1 rue X",
    });
    expect(v.inst_date_creation).toMatch(/^\d{4}-\d{2}-\d{2}$/); // coercé en date (TZ-dépendant → on vérifie le format)
    // champs non fournis → défauts typés
    expect(v.equip_douche).toBe(false);
    expect(v.equip_nature).toBe("");
    expect(v.urls).toEqual([]);
    expect(v.inst_enqu_date).toBe("");
    expect(v.equip_loc_type).toEqual([]);
  });

  it("adresse vide → addressCountry retombe sur le défaut de scope (RE), les autres sur ''", () => {
    const v = buildEditDefaults(poiLike({ name: "X" }));
    expect(v.addressCountry).toBe("RE");
    expect(v.addressLocality).toBe("");
    expect(v.localityId).toBe("");
    expect(v.postalCode).toBe("");
    expect(v.streetAddress).toBe("");
    expect(v.type).toBe("recoveryCenter"); // type absent → défaut de scope
  });
});
