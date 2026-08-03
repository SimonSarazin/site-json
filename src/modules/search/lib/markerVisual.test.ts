import { describe, it, expect } from "vitest";
import { resolveMarkerVisual } from "./markerVisual";

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
    expect(v).toEqual({ kind: "pin", cssColor: "var(--chart-2)", borderCssColor: "var(--background)" });
    // …et sur le pin par défaut sinon
    expect(resolveMarkerVisual({}, { useItemImage: true }, BASE)).toEqual({ kind: "default" });
  });

  it("style pin : couleur en JETON de thème (déf. primary), bordure background par défaut", () => {
    expect(resolveMarkerVisual({}, { style: "pin" }, BASE)).toEqual({
      kind: "pin",
      cssColor: "var(--primary)",
      borderCssColor: "var(--background)",
    });
  });

  it("borderColor configurable en JETON de thème, pour le pin ET le circle", () => {
    expect(resolveMarkerVisual({}, { style: "pin", color: "primary", borderColor: "accent" }, BASE)).toEqual({
      kind: "pin",
      cssColor: "var(--primary)",
      borderCssColor: "var(--accent)",
    });
    expect(resolveMarkerVisual({}, { style: "circle", color: "primary", borderColor: "accent" }, BASE)).toEqual({
      kind: "circle",
      cssColor: "var(--primary)",
      borderCssColor: "var(--accent)",
    });
  });

  it("style circle : pastille ronde, même résolution couleur+bordure que le pin (déf. background)", () => {
    expect(resolveMarkerVisual({}, { style: "circle", color: "secondary" }, BASE)).toEqual({
      kind: "circle",
      cssColor: "var(--secondary)",
      borderCssColor: "var(--background)",
    });
  });

  it("iconUrl → icône custom (URL relative préfixée, taille + ancrage par défaut)", () => {
    expect(resolveMarkerVisual({}, { iconUrl: "/upload/pin.svg" }, BASE)).toEqual({
      kind: "icon",
      src: "https://backend.example/upload/pin.svg",
      size: 34,
      anchor: "bottom",
    });
    // URL absolue conservée ; taille + ancrage custom
    expect(
      resolveMarkerVisual({}, { iconUrl: "https://cdn/p.png", iconSize: 48, iconAnchor: "center" }, BASE),
    ).toEqual({ kind: "icon", src: "https://cdn/p.png", size: 48, anchor: "center" });
  });

  it("priorité : vignette d'item > icône custom > pin", () => {
    // useItemImage + image l'emporte sur iconUrl
    expect(
      resolveMarkerVisual({ profilThumbImageUrl: "/i.jpg" }, { useItemImage: true, iconUrl: "/p.svg" }, BASE),
    ).toEqual({ kind: "image", src: "https://backend.example/i.jpg" });
    // iconUrl l'emporte sur style:pin
    expect(resolveMarkerVisual({}, { iconUrl: "/p.svg", style: "pin" }, BASE).kind).toBe("icon");
  });

  it("sans config → pin par défaut", () => {
    expect(resolveMarkerVisual({ profilThumbImageUrl: "/x.jpg" }, undefined, BASE)).toEqual({
      kind: "default",
    });
  });

  it("colorBy : pin coloré PAR VALEUR, prioritaire sur le token `color`", () => {
    const colorBy = { mapping: { "territoire62:arrageois": "var(--territoire-arrageois)" } };
    expect(
      resolveMarkerVisual(
        { tags: ["territoire62:arrageois"] },
        { style: "pin", color: "chart-2", colorBy },
        BASE,
      ),
    ).toEqual({
      kind: "pin",
      cssColor: "var(--territoire-arrageois)",
      borderCssColor: "var(--background)",
    });
    // colorBy seul (sans style pin déclaré) : implique le pin
    expect(
      resolveMarkerVisual({ tags: ["territoire62:arrageois"] }, { colorBy }, BASE),
    ).toEqual({
      kind: "pin",
      cssColor: "var(--territoire-arrageois)",
      borderCssColor: "var(--background)",
    });
  });

  it("colorBy respecte `style: circle` et le `borderColor` configuré", () => {
    const colorBy = { mapping: { "territoire62:arrageois": "var(--territoire-arrageois)" } };
    expect(
      resolveMarkerVisual(
        { tags: ["territoire62:arrageois"] },
        { style: "circle", borderColor: "accent", colorBy },
        BASE,
      ),
    ).toEqual({
      kind: "circle",
      cssColor: "var(--territoire-arrageois)",
      borderCssColor: "var(--accent)",
    });
  });

  it("colorBy sans valeur mappée → repli sur le token puis le pin Leaflet", () => {
    const colorBy = { mapping: { "territoire62:arrageois": "var(--territoire-arrageois)" } };
    expect(
      resolveMarkerVisual({ tags: ["santé"] }, { style: "pin", color: "chart-2", colorBy }, BASE),
    ).toEqual({
      kind: "pin",
      cssColor: "var(--chart-2)",
      borderCssColor: "var(--background)",
    });
    expect(resolveMarkerVisual({ tags: ["santé"] }, { colorBy }, BASE)).toEqual({
      kind: "default",
    });
  });

  it("priorité : vignette d'item > colorBy > icône custom", () => {
    const colorBy = { mapping: { "territoire62:arrageois": "var(--territoire-arrageois)" } };
    // l'image de l'item reste prioritaire sur le code couleur
    expect(
      resolveMarkerVisual(
        { profilThumbImageUrl: "/i.jpg", tags: ["territoire62:arrageois"] },
        { useItemImage: true, colorBy },
        BASE,
      ),
    ).toEqual({ kind: "image", src: "https://backend.example/i.jpg" });
    // colorBy l'emporte sur une icône brandée (le code couleur porte l'info)
    expect(
      resolveMarkerVisual(
        { tags: ["territoire62:arrageois"] },
        { iconUrl: "/p.svg", colorBy },
        BASE,
      ).kind,
    ).toBe("pin");
  });
});
