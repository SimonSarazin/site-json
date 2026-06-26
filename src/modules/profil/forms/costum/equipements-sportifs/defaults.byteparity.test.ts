/**
 * GARDE byte-parité : l'objet produit par `createEmptyDefaults` ne doit PAS changer. Le snapshot fige l'objet
 * de référence ; toute divergence (champ en plus/en moins, valeur différente) casse le test. Le descripteur est
 * compilé depuis le document JSON de config (`config.prod`, voie unique registerCostumForm).
 */
import { describe, it, expect } from "vitest";
import { createEmptyDefaults, type PoiEquipementScope } from "./fns";
import { loadCostumForm } from "../__fixtures__/configCostum";

const SCOPE: PoiEquipementScope = { parentId: "p", sourceKey: "s", poiType: "recoveryCenter", addressCountry: "RE" };
const { descriptor } = loadCostumForm("equipements-sportifs");

describe("createEmptyDefaults — byte-parité (dérivation)", () => {
  it("objet de defaults figé (snapshot)", () => {
    expect(createEmptyDefaults(SCOPE, descriptor)).toMatchSnapshot();
  });
});
