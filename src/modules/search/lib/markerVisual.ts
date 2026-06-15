// ------------------------------------------------------------
// markerVisual.ts — apparence des marqueurs de la carte search
// ------------------------------------------------------------
// Chaîne de repli déclarée par `map.marker` (config) :
//   1. `useItemImage` ET l'item a une image  → vignette RONDE de l'item ;
//   2. `style: "pin"`                        → pin SVG aux couleurs du THÈME
//      (token `color`, déf. primary — jamais d'hex, suit light/dark) ;
//   3. sinon                                 → pin Leaflet par défaut.
// Fonctions PURES (testées sans rendu) — SearchMap les mappe en divIcon.

import type { MapConf } from "../schema";

export type MarkerVisual =
  | { kind: "image"; src: string }
  | { kind: "pin"; cssColor: string }
  | { kind: "default" };

/** Jeton de thème → variable CSS (le pin suit le thème au paint). */
const PIN_COLOR_VARS: Record<string, string> = {
  primary: "var(--primary)",
  accent: "var(--accent)",
  "chart-1": "var(--chart-1)",
  "chart-2": "var(--chart-2)",
  "chart-3": "var(--chart-3)",
  "chart-4": "var(--chart-4)",
  "chart-5": "var(--chart-5)",
};

export function resolveMarkerVisual(
  serverData: Record<string, unknown> | undefined,
  conf: MapConf["marker"],
  baseUrl: string,
): MarkerVisual {
  if (conf?.useItemImage) {
    const thumb = serverData?.profilThumbImageUrl;
    const medium = serverData?.profilMediumImageUrl;
    const img =
      (typeof thumb === "string" && thumb) || (typeof medium === "string" && medium) || "";
    if (img) {
      return { kind: "image", src: img.startsWith("http") ? img : `${baseUrl}${img}` };
    }
    // pas d'image : on retombe sur le pin stylisé si déclaré (ci-dessous)
  }
  if (conf?.style === "pin") {
    return { kind: "pin", cssColor: PIN_COLOR_VARS[conf.color ?? "primary"] ?? "var(--primary)" };
  }
  return { kind: "default" };
}

/** SVG du pin (goutte) — contour et pastille en `--background` : lisible sur
 *  tout fond de carte, en light comme en dark. */
export function pinSvg(cssColor: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="34" height="34">` +
    `<path d="M12 1C7.6 1 4 4.6 4 9c0 5.8 8 14 8 14s8-8.2 8-14c0-4.4-3.6-8-8-8Z" fill="${cssColor}" stroke="var(--background)" stroke-width="1.2"/>` +
    `<circle cx="12" cy="9" r="3" fill="var(--background)"/>` +
    `</svg>`
  );
}
