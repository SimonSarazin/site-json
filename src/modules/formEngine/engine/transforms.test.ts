import { describe, it, expect, vi } from "vitest";
import { applyTransform, getCompute, registerTransform, getTransform } from "./transforms";

describe("transforms (read/write registre)", () => {
  it("transformers de base", () => {
    expect(applyTransform("toNumber", "", {})).toBeUndefined();
    expect(applyTransform("toNumber", "3", {})).toBe(3);
    expect(applyTransform("toString", null, {})).toBe("");
    expect(applyTransform("toBoolean", "true", {})).toBe(true);
    expect(applyTransform("toBoolean", "1", {})).toBe(true);
    expect(applyTransform("toBoolean", "0", {})).toBe(false);
    expect(applyTransform("toStringArray", "x", {})).toEqual(["x"]);
    expect(applyTransform("toStringArray", null, {})).toEqual([]);
    expect(applyTransform("toStringArray", ["a", 1], {})).toEqual(["a", "1"]);
    expect(applyTransform("splitCsv", "a, b ,", {})).toEqual(["a", "b"]);
    expect(applyTransform("joinCsv", ["a", "b"], {})).toBe("a, b");
  });

  it("identité si pas de nom ; clé inconnue = valeur inchangée + warn", () => {
    expect(applyTransform(undefined, "v", {})).toBe("v");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(applyTransform("inexistant", "v", {})).toBe("v");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("register/get custom", () => {
    registerTransform("test:upper", (v) => String(v).toUpperCase());
    expect(getTransform("test:upper")).toBeTypeOf("function");
    expect(applyTransform("test:upper", "ab", {})).toBe("AB");
  });
});

describe("compute (multiply)", () => {
  it("produit si tous nombres finis, sinon undefined", () => {
    expect(getCompute("multiply")!([2, 3])).toBe(6);
    expect(getCompute("multiply")!([2, "x"])).toBeUndefined();
    expect(getCompute("multiply")!([5])).toBe(5);
  });
});
