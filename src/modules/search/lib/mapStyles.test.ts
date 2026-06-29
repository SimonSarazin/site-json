import { describe, it, expect } from "vitest";
import {
  resolveMapStyles,
  MAPTILER_DEFAULT_STYLE_LIGHT,
  MAPTILER_DEFAULT_STYLE_DARK,
} from "./mapStyles";

describe("resolveMapStyles", () => {
  it("sans clé : style raster de repli (OSM light, Carto dark), pas de SDK", () => {
    const r = resolveMapStyles("");
    expect(r.provider).toBe("fallback");
    // Objet style MapLibre (pas un ID) → affiché par MapLibre standard.
    expect(typeof r.light).toBe("object");
    const light = r.light as { sources: Record<string, { tiles?: string[] }> };
    expect(light.sources["raster-tiles"].tiles?.[0]).toContain("tile.openstreetmap.org");
    const dark = r.dark as { sources: Record<string, { tiles?: string[] }> };
    expect(dark.sources["raster-tiles"].tiles?.[0]).toContain("basemaps.cartocdn.com");
    // Le repli ignore les styles configurés (ce sont des IDs MapTiler).
    expect(resolveMapStyles("", { styleLight: "outdoor-v2" }).provider).toBe("fallback");
  });

  it("avec clé : IDs de style par défaut (le SDK les expansera), provider maptiler", () => {
    const r = resolveMapStyles("ma-cle");
    expect(r.provider).toBe("maptiler");
    // On renvoie l'ID brut — AUCUNE URL construite à la main (c'est le rôle du SDK).
    expect(r.light).toBe(MAPTILER_DEFAULT_STYLE_LIGHT);
    expect(r.dark).toBe(MAPTILER_DEFAULT_STYLE_DARK);
  });

  it("avec clé : styles configurés par site (integrations.map)", () => {
    const r = resolveMapStyles("k", { styleLight: "outdoor-v2", styleDark: "dataviz-dark" });
    expect(r.light).toBe("outdoor-v2");
    expect(r.dark).toBe("dataviz-dark");
  });
});
