// ------------------------------------------------------------
// mapTiles.ts — résolution du fond de carte Leaflet (light + dark)
// ------------------------------------------------------------
// Avec une clé MapTiler (VITE_MAPTILER_API_KEY) : tuiles raster MapTiler,
// style par thème configurable via `integrations.map` (styleLight/styleDark).
// SANS clé : repli sur les tuiles libres historiques (OSM light, Carto dark)
// — aucun site ne casse, la clé est purement opt-in.
//
// NB : les `style.json` MapTiler sont des styles VECTORIELS (MapLibre GL) —
// inutilisables avec Leaflet. Ici on consomme l'endpoint RASTER
// (`/maps/<style>/{z}/{x}/{y}.png`), tuiles 512 px → `tileSize: 512` +
// `zoomOffset: -1` (recette officielle MapTiler pour Leaflet).

/** Spec d'un calque de tuiles — passée telle quelle à `L.tileLayer(url, options)`. */
export interface TileLayerSpec {
  url: string;
  options: {
    attribution: string;
    maxZoom: number;
    tileSize?: number;
    zoomOffset?: number;
    subdomains?: string;
    crossOrigin?: boolean;
  };
}

export interface ResolvedTileLayers {
  light: TileLayerSpec;
  dark: TileLayerSpec;
  provider: "maptiler" | "fallback";
}

const MAPTILER_ATTRIBUTION =
  '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> ' +
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';

export const MAPTILER_DEFAULT_STYLE_LIGHT = "streets-v2";
export const MAPTILER_DEFAULT_STYLE_DARK = "streets-v2-dark";

function maptilerLayer(style: string, apiKey: string): TileLayerSpec {
  return {
    url: `https://api.maptiler.com/maps/${style}/{z}/{x}/{y}.png?key=${apiKey}`,
    options: {
      attribution: MAPTILER_ATTRIBUTION,
      maxZoom: 19,
      tileSize: 512,
      zoomOffset: -1,
      crossOrigin: true,
    },
  };
}

/** Tuiles libres historiques — repli sans clé MapTiler. */
const FALLBACK_LIGHT: TileLayerSpec = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  options: {
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
  },
};

const FALLBACK_DARK: TileLayerSpec = {
  url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  options: {
    attribution:
      '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap contributors',
    subdomains: "abcd",
    maxZoom: 19,
  },
};

/**
 * Résout les deux calques (light/dark) selon la clé d'environnement et le
 * bloc optionnel `integrations.map` du config site.
 */
export function resolveTileLayers(
  apiKey: string,
  styles?: { styleLight?: string; styleDark?: string },
): ResolvedTileLayers {
  if (!apiKey) {
    return { light: FALLBACK_LIGHT, dark: FALLBACK_DARK, provider: "fallback" };
  }
  return {
    light: maptilerLayer(styles?.styleLight ?? MAPTILER_DEFAULT_STYLE_LIGHT, apiKey),
    dark: maptilerLayer(styles?.styleDark ?? MAPTILER_DEFAULT_STYLE_DARK, apiKey),
    provider: "maptiler",
  };
}
