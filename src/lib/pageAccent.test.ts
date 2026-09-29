import { describe, it, expect } from "vitest";
import { pageAccentVars } from "./pageAccent";

describe("pageAccentVars", () => {
  it("sans accent : aucun style en ligne", () => {
    expect(pageAccentVars()).toBeUndefined();
    expect(pageAccentVars("   ")).toBeUndefined();
  });

  it("accent : la couleur et son aplat mélangé au fond du thème", () => {
    expect(pageAccentVars("var(--territoire-arrageois)")).toEqual({
      "--page-accent": "var(--territoire-arrageois)",
      "--page-accent-soft": "color-mix(in oklab, var(--territoire-arrageois) 16%, var(--background))",
    });
  });
});
