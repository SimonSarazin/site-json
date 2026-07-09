import { describe, it, expect } from "vitest";
import { makeVariantRegistry } from "./registry";

const loader = () => Promise.resolve({ default: () => null });

describe("makeVariantRegistry", () => {
  const reg = makeVariantRegistry({ default: loader, compact: loader });

  it("get(undefined) et get(inconnu) retombent sur default", () => {
    expect(reg.get()).toBe(reg.get("default"));
    expect(reg.get("nexistepas")).toBe(reg.get("default"));
  });
  it("get(connu) diffère de default", () => {
    expect(reg.get("compact")).not.toBe(reg.get("default"));
  });
  it("has / keys", () => {
    expect(reg.has("compact")).toBe(true);
    expect(reg.has("nexistepas")).toBe(false);
    expect(reg.keys().sort()).toEqual(["compact", "default"]);
  });
  it("preload ne jette pas (clé connue, inconnue → default, ou vide)", () => {
    expect(() => { reg.preload("compact"); reg.preload("nope"); reg.preload(); }).not.toThrow();
  });
  it("exige une entrée `default`", () => {
    expect(() => makeVariantRegistry({ x: loader })).toThrow();
  });
});
