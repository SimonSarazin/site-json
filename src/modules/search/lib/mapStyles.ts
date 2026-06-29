// ------------------------------------------------------------
// mapStyles.ts — résolution du STYLE MapLibre GL (light + dark)
// ------------------------------------------------------------
// react-map-gl/maplibre consomme un STYLE complet (`style.json`), PAS des
// calques de tuiles raster un par un (cf. mapTiles.ts, qui reste la source de
// la carte Leaflet du module profil — ProfileMapLeaflet).
//
// Avec une clé MapTiler (VITE_MAPTILER_API_KEY) : on délègue à `@maptiler/sdk`
// (utilisé comme `mapLib` du <Map>) — il suffit de lui passer l'ID de style
// (`streets-v2`, `outdoor-v2`…) ; le SDK expanse l'ID en `style.json` VECTORIEL
// avec la clé de `maptilersdk.config.apiKey`. On ne construit donc AUCUNE URL à
// la main ici. L'ID de style est configurable par site via `integrations.map`
// (styleLight/styleDark). SANS clé : repli sur un style RASTER minimal construit
// localement (OSM light / Carto dark), affiché par MapLibre standard — aucun
// site ne casse, la clé reste opt-in.

import type { StyleSpecification } from "maplibre-gl";

export interface ResolvedMapStyles {
  /**
   * Passé tel quel à `<Map mapStyle={…}>` :
   * - provider "maptiler" → ID de style (string), résolu par `@maptiler/sdk` ;
   * - provider "fallback" → objet style raster MapLibre (pas de SDK requis).
   */
  light: string | StyleSpecification;
  dark: string | StyleSpecification;
  /** Pilote le `mapLib` du <Map> : "maptiler" ⇒ on branche `@maptiler/sdk`. */
  provider: "maptiler" | "fallback";
}

export const MAPTILER_DEFAULT_STYLE_LIGHT = "streets-v2";
export const MAPTILER_DEFAULT_STYLE_DARK = "streets-v2-dark";

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';
const CARTO_ATTRIBUTION =
  '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap contributors';

/**
 * Style MapLibre RASTER minimal (une seule source de tuiles `{z}/{x}/{y}`).
 * Repli sans clé MapTiler — les `{s}` de Leaflet n'existent pas en MapLibre :
 * on liste explicitement les sous-domaines a/b/c.
 */
function rasterStyle(tiles: string[], attribution: string): StyleSpecification {
  return {
    version: 8,
    sources: {
      "raster-tiles": { type: "raster", tiles, tileSize: 256, attribution },
    },
    layers: [{ id: "raster", type: "raster", source: "raster-tiles" }],
  };
}

const FALLBACK_LIGHT: StyleSpecification = rasterStyle(
  [
    "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
    "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
    "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
  ],
  OSM_ATTRIBUTION,
);

const FALLBACK_DARK: StyleSpecification = rasterStyle(
  [
    "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
  ],
  CARTO_ATTRIBUTION,
);

/**
 * Résout les deux styles (light/dark) selon la clé d'environnement et le bloc
 * optionnel `integrations.map` du config site. Pure (sans `@maptiler/sdk`) :
 * avec clé, renvoie juste les IDs de style que le SDK expansera.
 */
export function resolveMapStyles(
  apiKey: string,
  styles?: { styleLight?: string; styleDark?: string },
): ResolvedMapStyles {
  if (!apiKey) {
    // Les styles configurés sont des IDs MapTiler → inutilisables sans clé.
    return { light: FALLBACK_LIGHT, dark: FALLBACK_DARK, provider: "fallback" };
  }
  return {
    light: styles?.styleLight ?? MAPTILER_DEFAULT_STYLE_LIGHT,
    dark: styles?.styleDark ?? MAPTILER_DEFAULT_STYLE_DARK,
    provider: "maptiler",
  };
}
