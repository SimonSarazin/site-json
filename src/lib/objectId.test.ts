import { describe, it, expect } from "vitest";
import { isObjectId } from "./objectId";

/**
 * Le contrôle protège une requête entière : un seul identifiant malformé dans un `_id: {$in}` la fait
 * échouer pour toutes les lignes (review de la MR 120 : une clé d'usager saisie à la main privait tout le
 * parc des types des fiches).
 */
describe("isObjectId", () => {
  it("24 caractères hexadécimaux, majuscules admises", () => {
    expect(isObjectId("6a0b3078f16441794857e2f0")).toBe(true);
    expect(isObjectId("6A0B3078F16441794857E2F0")).toBe(true);
  });

  it("refuse un identifiant de démo, tronqué, entouré d'espaces ou qui n'est pas une chaîne", () => {
    expect(isObjectId("club-saisi-a-la-main")).toBe(false);
    expect(isObjectId("6a0b3078f16441794857e2f")).toBe(false);
    expect(isObjectId(" 6a0b3078f16441794857e2f0")).toBe(false);
    expect(isObjectId(undefined)).toBe(false);
    expect(isObjectId(42)).toBe(false);
  });
});
