import { describe, it, expect } from "vitest";
import { sectionBgClass } from "./sectionBg";

describe("sectionBgClass", () => {
  it("sans jeton, jeton `default` ou jeton inconnu : aucun fond imposé", () => {
    expect(sectionBgClass()).toBe("");
    expect(sectionBgClass("default")).toBe("");
    expect(sectionBgClass("jeton-inexistant")).toBe("");
  });

  it("jetons du thème : la classe correspondante", () => {
    expect(sectionBgClass("muted")).toBe("bg-muted");
    expect(sectionBgClass("primary")).toBe("bg-primary/10");
    expect(sectionBgClass("transparent")).toBe("bg-transparent");
  });

  it("accent de page : aplat léger, transparent tant que la page n'a pas d'accent", () => {
    expect(sectionBgClass("page-accent")).toBe(
      "bg-[var(--page-accent-soft,transparent)] border-t-2 border-[var(--page-accent,transparent)]",
    );
  });
});
