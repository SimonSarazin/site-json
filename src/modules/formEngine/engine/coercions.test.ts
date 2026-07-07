import { describe, expect, it } from "vitest";
import { coerceBool, coerceBoolString, coerceString } from "./coercions";
import { applyTransform } from "./transforms";

describe("coerce:boolString", () => {
  it("écrit la CHAÎNE 'true'/'false' (parité legacy form-urlencoded)", () => {
    expect(coerceBoolString(true)).toBe("true");
    expect(coerceBoolString(false)).toBe("false");
  });

  it("accepte les entrées lâches comme coerce:bool", () => {
    expect(coerceBoolString("true")).toBe("true");
    expect(coerceBoolString("oui")).toBe("true");
    expect(coerceBoolString(1)).toBe("true");
    expect(coerceBoolString("non")).toBe("false");
    expect(coerceBoolString(undefined)).toBe("false");
  });

  it("fait l'aller-retour avec coerce:bool (read)", () => {
    expect(coerceBool(coerceBoolString(true))).toBe(true);
    expect(coerceBool(coerceBoolString(false))).toBe(false);
  });

  it("comble le trou de coerce:string, qui perd les booléens", () => {
    expect(coerceString(true)).toBe(""); // ← pourquoi ce transform existe
    expect(coerceBoolString(true)).toBe("true");
  });

  it("est enregistré sous la clé 'coerce:boolString'", () => {
    expect(applyTransform("coerce:boolString", true, {})).toBe("true");
  });
});
