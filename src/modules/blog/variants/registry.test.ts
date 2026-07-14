import { describe, it, expect, vi } from "vitest";
import { makeVariantRegistry, type BlogVariant } from "./registry";

// Faux variant : composant + méthode .preload() (comme un `lazy` de vite-preload).
const mkVariant = () => Object.assign(() => null, { preload: vi.fn(() => Promise.resolve()) }) as unknown as BlogVariant<unknown>;

describe("makeVariantRegistry", () => {
  const def = mkVariant();
  const compact = mkVariant();
  const reg = makeVariantRegistry<unknown>({ default: def, compact });

  it("get(undefined) et get(inconnu) retombent sur default", () => {
    expect(reg.get()).toBe(def);
    expect(reg.get("nexistepas")).toBe(def);
  });
  it("get(connu) retourne le bon variant", () => {
    expect(reg.get("compact")).toBe(compact);
  });
  it("has / keys", () => {
    expect(reg.has("compact")).toBe(true);
    expect(reg.has("nexistepas")).toBe(false);
    expect(reg.keys().sort()).toEqual(["compact", "default"]);
  });
  it("preload délègue à `.preload()` du variant (connu / inconnu→default / vide)", () => {
    reg.preload("compact");
    expect(compact.preload).toHaveBeenCalled();
    reg.preload("nope");
    reg.preload();
    expect(def.preload).toHaveBeenCalled();
  });
  it("exige une entrée `default`", () => {
    expect(() => makeVariantRegistry<unknown>({ x: mkVariant() })).toThrow();
  });
});
