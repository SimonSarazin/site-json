import { describe, it, expect } from "vitest";
import { telephonePrincipal } from "./telephonePrincipal";

describe("telephonePrincipal", () => {
  it("fiche ancienne : `telephone.mobile` seul → son premier numéro", () => {
    expect(telephonePrincipal({ telephone: { mobile: ["0692 11 22 33", "0693 44 55 66"] } })).toBe("0692 11 22 33");
  });

  it("repli sur `telephone.fixe` quand `mobile` est vide", () => {
    expect(telephonePrincipal({ telephone: { mobile: [], fixe: ["0262 57 87 07"] } })).toBe("0262 57 87 07");
  });

  it("fiche créée par le nouveau formulaire : `mobile` plat seul", () => {
    expect(telephonePrincipal({ mobile: "0692573118" })).toBe("0692573118");
  });

  it("fiche ancienne ré-éditée : le `mobile` plat (plus récent) l'emporte sur `telephone.mobile`", () => {
    expect(telephonePrincipal({ mobile: "0693668540", telephone: { mobile: ["693668540"] } })).toBe("0693668540");
  });

  it("`mobile` plat vide → ignoré au profit de `telephone`", () => {
    expect(telephonePrincipal({ mobile: "  ", telephone: { mobile: ["0692 00 00 00"] } })).toBe("0692 00 00 00");
  });

  it("`telephone` en chaîne ou `phone` (autres entités)", () => {
    expect(telephonePrincipal({ telephone: " 0262 00 00 00 " })).toBe("0262 00 00 00");
    expect(telephonePrincipal({ phone: "0262 11 11 11" })).toBe("0262 11 11 11");
  });

  it("numéro stocké en nombre → chaîne", () => {
    expect(telephonePrincipal({ telephone: { mobile: [692433858] } })).toBe("692433858");
  });

  it("aucun téléphone → undefined", () => {
    expect(telephonePrincipal({})).toBeUndefined();
    expect(telephonePrincipal(undefined)).toBeUndefined();
    expect(telephonePrincipal({ telephone: {} })).toBeUndefined();
  });
});
