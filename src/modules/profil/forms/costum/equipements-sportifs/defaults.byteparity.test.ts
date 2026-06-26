/**
 * GARDE byte-parité : l'objet produit par `createEmptyDefaults` ne doit PAS changer quand on le DÉRIVE
 * (via seedEntity(descriptor, null) + socle adresse) au lieu de le lister à la main. Le snapshot fige
 * l'objet de référence ; toute divergence (champ en plus/en moins, valeur différente) casse le test.
 */
import { describe, it, expect } from "vitest";
import { createEmptyDefaults, type PoiEquipementScope } from "./fns";
import { equipementsSportifsDescriptor } from "./descriptor";

const SCOPE: PoiEquipementScope = { parentId: "p", sourceKey: "s", poiType: "recoveryCenter", addressCountry: "RE" };

describe("createEmptyDefaults — byte-parité (dérivation)", () => {
  it("objet de defaults figé (snapshot)", () => {
    expect(createEmptyDefaults(SCOPE, equipementsSportifsDescriptor)).toMatchSnapshot();
  });
});
