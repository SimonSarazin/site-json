// ------------------------------------------------------------
// markerVisual.ts — apparence des marqueurs de la carte search
// ------------------------------------------------------------
// Chaîne de repli déclarée par `map.marker` (config), par PRIORITÉ :
//   1. `useItemImage` ET l'item a une image  → vignette RONDE de l'item ;
//   2. `iconUrl`                             → icône custom (image/SVG, ex. pin
//      brandé par site) — relative préfixée par baseUrl, ou absolue http ;
//   3. `style: "pin"` / `style: "circle"`    → pin SVG (goutte) ou pastille
//      ronde, aux couleurs du THÈME (token `color`, déf. primary — jamais
//      d'hex, suit light/dark ; contour via `borderColor`, déf. background) ;
//   4. sinon                                 → pin par défaut (couleur primary).
// La config est mergée AVANT (site `integrations.map.marker` < section
// `map.marker`) — cf. SearchMap. Fonction PURE (testée sans rendu) ;
// `SearchMapMarkers` la rend en React (<Marker> react-map-gl/maplibre).

import type { MapConf } from "../schema";

export type MarkerVisual =
  | { kind: "image"; src: string }
  | { kind: "icon"; src: string; size: number; anchor: "bottom" | "center" }
  | { kind: "pin"; cssColor: string; borderCssColor: string }
  | { kind: "circle"; cssColor: string; borderCssColor: string }
  | { kind: "default" };

/** Jeton de thème → variable CSS (le pin suit le thème au paint). */
const PIN_COLOR_VARS: Record<string, string> = {
  primary: "var(--primary)",
  secondary: "var(--secondary)",
  accent: "var(--accent)",
  "chart-1": "var(--chart-1)",
  "chart-2": "var(--chart-2)",
  "chart-3": "var(--chart-3)",
  "chart-4": "var(--chart-4)",
  "chart-5": "var(--chart-5)",
};

/** Palette de la BORDURE (contour + pastille) du pin : `color` + `background`
 *  (défaut, contraste sur tout fond). */
const PIN_BORDER_VARS: Record<string, string> = {
  background: "var(--background)",
  ...PIN_COLOR_VARS,
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
    // pas d'image : on retombe sur l'icône custom / le pin (ci-dessous)
  }
  if (conf?.iconUrl) {
    const src = conf.iconUrl.startsWith("http") ? conf.iconUrl : `${baseUrl}${conf.iconUrl}`;
    return { kind: "icon", src, size: conf.iconSize ?? 34, anchor: conf.iconAnchor ?? "bottom" };
  }
  if (conf?.style === "pin" || conf?.style === "circle") {
    const cssColor = PIN_COLOR_VARS[conf.color ?? "primary"] ?? "var(--primary)";
    // Contour (pin : tracé + pastille ; circle : anneau) — jeton de bordure,
    // déf. background (contraste lisible sur tout fond, en light comme en dark).
    const borderCssColor = PIN_BORDER_VARS[conf.borderColor ?? "background"] ?? "var(--background)";
    return conf.style === "circle"
      ? { kind: "circle", cssColor, borderCssColor }
      : { kind: "pin", cssColor, borderCssColor };
  }
  return { kind: "default" };
}
