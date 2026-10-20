import { describe, it, expect } from "vitest";
import { isCostumHostAdmin } from "./isCostumHostAdmin";

describe("isCostumHostAdmin", () => {
  it("sans porteur chargé : jamais admin (une dispense ne s'accorde pas par défaut)", () => {
    expect(isCostumHostAdmin(null)).toBe(false);
    expect(isCostumHostAdmin(undefined)).toBe(false);
    expect(isCostumHostAdmin({})).toBe(false);
  });

  it("suit le `isAdmin()` du porteur", () => {
    expect(isCostumHostAdmin({ isAdmin: () => true })).toBe(true);
    expect(isCostumHostAdmin({ isAdmin: () => false })).toBe(false);
  });
});
