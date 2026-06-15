import { describe, it, expect } from "vitest";
import { resolveMarkerVisual, pinSvg } from "./markerVisual";

const BASE = "https://backend.example";

describe("resolveMarkerVisual (chaîne de repli des marqueurs)", () => {
  it("useItemImage + image présente → vignette (URL relative préfixée)", () => {
    const v = resolveMarkerVisual(
      { profilThumbImageUrl: "/upload/x.jpg" },
      { useItemImage: true },
      BASE,
    );
    expect(v).toEqual({ kind: "image", src: "https://backend.example/upload/x.jpg" });
    // URL absolue conservée telle quelle ; medium en repli de thumb
    expect(
      resolveMarkerVisual({ profilMediumImageUrl: "https://cdn/x.jpg" }, { useItemImage: true }, BASE),
    ).toEqual({ kind: "image", src: "https://cdn/x.jpg" });
  });

  it("useItemImage SANS image → retombe sur le pin stylisé si déclaré", () => {
    const v = resolveMarkerVisual({}, { useItemImage: true, style: "pin", color: "chart-2" }, BASE);
    expect(v).toEqual({ kind: "pin", cssColor: "var(--chart-2)" });
    // …et sur le pin Leaflet sinon
    expect(resolveMarkerVisual({}, { useItemImage: true }, BASE)).toEqual({ kind: "default" });
  });

  it("style pin : couleur en JETON de thème (déf. primary)", () => {
    expect(resolveMarkerVisual({}, { style: "pin" }, BASE)).toEqual({
      kind: "pin",
      cssColor: "var(--primary)",
    });
  });

  it("sans config → pin Leaflet par défaut", () => {
    expect(resolveMarkerVisual({ profilThumbImageUrl: "/x.jpg" }, undefined, BASE)).toEqual({
      kind: "default",
    });
  });
});

describe("pinSvg", () => {
  it("goutte SVG remplie par la variable de thème, contour/pastille en --background", () => {
    const svg = pinSvg("var(--primary)");
    expect(svg).toContain('fill="var(--primary)"');
    expect(svg).toContain('fill="var(--background)"');
    expect(svg).toContain("<svg");
  });
});
