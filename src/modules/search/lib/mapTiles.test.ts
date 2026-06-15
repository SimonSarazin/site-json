import { describe, it, expect } from "vitest";
import {
  resolveTileLayers,
  MAPTILER_DEFAULT_STYLE_LIGHT,
  MAPTILER_DEFAULT_STYLE_DARK,
} from "./mapTiles";

describe("resolveTileLayers", () => {
  it("sans clé : repli sur les tuiles libres (OSM light, Carto dark)", () => {
    const r = resolveTileLayers("");
    expect(r.provider).toBe("fallback");
    expect(r.light.url).toContain("tile.openstreetmap.org");
    expect(r.dark.url).toContain("basemaps.cartocdn.com");
    // Le repli ignore les styles configurés (ils sont MapTiler-only).
    const r2 = resolveTileLayers("", { styleLight: "outdoor-v2" });
    expect(r2.light.url).toContain("tile.openstreetmap.org");
  });

  it("avec clé : tuiles raster MapTiler, styles par défaut light/dark", () => {
    const r = resolveTileLayers("ma-cle");
    expect(r.provider).toBe("maptiler");
    expect(r.light.url).toBe(
      `https://api.maptiler.com/maps/${MAPTILER_DEFAULT_STYLE_LIGHT}/{z}/{x}/{y}.png?key=ma-cle`
    );
    expect(r.dark.url).toBe(
      `https://api.maptiler.com/maps/${MAPTILER_DEFAULT_STYLE_DARK}/{z}/{x}/{y}.png?key=ma-cle`
    );
  });

  it("avec clé : recette Leaflet raster MapTiler (512px → tileSize 512 + zoomOffset -1)", () => {
    const r = resolveTileLayers("ma-cle");
    for (const layer of [r.light, r.dark]) {
      expect(layer.options.tileSize).toBe(512);
      expect(layer.options.zoomOffset).toBe(-1);
      expect(layer.options.attribution).toContain("MapTiler");
      expect(layer.options.attribution).toContain("OpenStreetMap");
    }
  });

  it("styles configurables par site (integrations.map)", () => {
    const r = resolveTileLayers("ma-cle", { styleLight: "outdoor-v2", styleDark: "dataviz-dark" });
    expect(r.light.url).toContain("/maps/outdoor-v2/");
    expect(r.dark.url).toContain("/maps/dataviz-dark/");
    // Surcharge partielle : l'autre thème garde son défaut.
    const r2 = resolveTileLayers("ma-cle", { styleLight: "winter-v2" });
    expect(r2.light.url).toContain("/maps/winter-v2/");
    expect(r2.dark.url).toContain(`/maps/${MAPTILER_DEFAULT_STYLE_DARK}/`);
  });
});
