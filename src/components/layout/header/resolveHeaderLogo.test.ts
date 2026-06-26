import { describe, it, expect } from "vitest";
import { resolveHeaderLogo } from "./resolveHeaderLogo";

describe("resolveHeaderLogo", () => {
  it("renvoie null quand aucune image n'est fournie (→ repli logoIcon)", () => {
    expect(resolveHeaderLogo({})).toBeNull();
    expect(resolveHeaderLogo({}, { isOverlay: true })).toBeNull();
  });

  it("logo seul → src = logo, pas de srcDark", () => {
    expect(resolveHeaderLogo({ logo: "a.png" })).toEqual({ src: "a.png", srcDark: undefined });
  });

  it("logo + logoDark distinct → expose srcDark (swap CSS)", () => {
    expect(resolveHeaderLogo({ logo: "a.png", logoDark: "a-dark.png" })).toEqual({
      src: "a.png",
      srcDark: "a-dark.png",
    });
  });

  it("logoDark identique à logo → srcDark omis", () => {
    expect(resolveHeaderLogo({ logo: "a.png", logoDark: "a.png" })).toEqual({
      src: "a.png",
      srcDark: undefined,
    });
  });

  it("isOverlay + logoOverlay → utilise logoOverlay", () => {
    expect(
      resolveHeaderLogo({ logo: "a.png", logoOverlay: "a-white.png" }, { isOverlay: true }),
    ).toEqual({ src: "a-white.png" });
  });

  it("logoOverlay défini mais header opaque → ignore l'overlay, garde la base", () => {
    expect(
      resolveHeaderLogo({ logo: "a.png", logoDark: "a-dark.png", logoOverlay: "a-white.png" }),
    ).toEqual({ src: "a.png", srcDark: "a-dark.png" });
  });

  it("isOverlay sans logoOverlay → repli sur la base (logo/logoDark)", () => {
    expect(
      resolveHeaderLogo({ logo: "a.png", logoDark: "a-dark.png" }, { isOverlay: true }),
    ).toEqual({ src: "a.png", srcDark: "a-dark.png" });
  });

  it("pas de logo mais logoOverlay seul → repli sur logoOverlay", () => {
    expect(resolveHeaderLogo({ logoOverlay: "a-white.png" })).toEqual({ src: "a-white.png" });
  });
});
