import { describe, it, expect } from "vitest";
import { resolveCreatable } from "./valueSelectAccess";

describe("resolveCreatable", () => {
  it("saveNewValue: false → creatable inchangé, admin ou pas", () => {
    expect(resolveCreatable(true, false, false)).toBe(true);
    expect(resolveCreatable(true, false, true)).toBe(true);
  });

  it("saveNewValue: true + visiteur non-admin → creatable fermé", () => {
    expect(resolveCreatable(true, true, false)).toBe(false);
  });

  it("saveNewValue: true + admin → creatable ouvert", () => {
    expect(resolveCreatable(true, true, true)).toBe(true);
  });

  it("creatable: false explicite → toujours fermé, même admin + saveNewValue", () => {
    expect(resolveCreatable(false, true, true)).toBe(false);
    expect(resolveCreatable(false, false, true)).toBe(false);
  });
});
