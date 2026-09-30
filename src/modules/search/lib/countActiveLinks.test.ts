import { describe, it, expect } from "vitest";
import { countActiveLinks } from "./countActiveLinks";

describe("countActiveLinks", () => {
  it("compte les liens indexés par id (forme réelle backend)", () => {
    expect(countActiveLinks({ a: { type: "citoyens", isAdmin: true }, b: { type: "citoyens" } })).toBe(2);
  });

  it("🔒 invitation en attente ou demande non validée : pas encore un lien", () => {
    expect(
      countActiveLinks({
        a: { type: "citoyens" },
        b: { type: "citoyens", isInviting: true },
        c: { type: "citoyens", toBeValidated: true },
      })
    ).toBe(1);
  });

  it("section absente ou malformée : 0", () => {
    expect(countActiveLinks(undefined)).toBe(0);
    expect(countActiveLinks(null)).toBe(0);
    expect(countActiveLinks("x")).toBe(0);
  });
});
