import { describe, it, expect } from "vitest";
import { accentStyle } from "./accentStyle";

describe("accentStyle", () => {
  it("sans accent : aucun style, l'élément garde son variant de thème", () => {
    expect(accentStyle()).toBeUndefined();
    expect(accentStyle("   ", "#000")).toBeUndefined();
  });

  it("encre blanche par défaut (comportement historique)", () => {
    expect(accentStyle("var(--p62-turquoise)")).toEqual({
      backgroundColor: "var(--p62-turquoise)",
      color: "#fff",
    });
    expect(accentStyle("#4ecdc4", "  ")).toEqual({ backgroundColor: "#4ecdc4", color: "#fff" });
  });

  it("encre fournie : elle remplace le blanc", () => {
    expect(accentStyle("var(--p62-turquoise)", "var(--p62-marine)")).toEqual({
      backgroundColor: "var(--p62-turquoise)",
      color: "var(--p62-marine)",
    });
  });
});
