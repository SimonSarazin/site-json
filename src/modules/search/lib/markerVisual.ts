// ------------------------------------------------------------
// markerVisual.ts — apparence des marqueurs de la carte search
// ------------------------------------------------------------
// Deux étages, dans cet ordre :
//   A. `by` CHOISIT le marqueur d'après une valeur de l'item (dot-path
//      `by.path` → cas de `by.mapping`, sinon `by.default`, sinon le marqueur
//      de base) — cf. `resolveMarkerBy` ;
//   B. la chaîne de repli ci-dessous le REND.
// Chaîne de repli déclarée par `map.marker` (config), par PRIORITÉ :
//   1. `useItemImage` ET l'item a une image  → vignette RONDE de l'item ;
//   2. `colorBy` ET une valeur de l'item mappée → pin (ou pastille si
//      `style: "circle"`) coloré PAR VALEUR — code couleur par territoire du
//      CDC parents62 ; prioritaire sur le token `color`, seul le remplissage
//      vient du mapping (le contour reste `borderColor`) ;
//   3. `iconUrl`                             → icône custom (image/SVG, ex. pin
//      brandé par site) — relative préfixée par baseUrl, ou absolue http ;
//   4. `style: "pin"` / `style: "circle"` / `icon` → pin SVG (goutte) ou pastille
//      ronde, aux couleurs du THÈME (token `color`, déf. primary — jamais
//      d'hex, suit light/dark ; contour via `borderColor`, déf. background),
//      avec le pictogramme LUCIDE d'`icon` en son centre quand il est déclaré
//      (`icon` seul implique la goutte) ;
//   5. sinon                                 → pin par défaut (couleur primary).
// La config est mergée AVANT (site `integrations.map.marker` < section
// `map.marker`) — cf. SearchMap. Fonction PURE (testée sans rendu) ;
// `SearchMapMarkers` la rend en React (<Marker> react-map-gl/maplibre).

import getValueByPath from "@/helpers/getValueByPath";

import { resolveColorBy } from "./colorBy";

import type { MarkerByConf, MarkerConf, MarkerVisualConf } from "../schema";

export type MarkerVisual =
  | { kind: "image"; src: string }
  | { kind: "icon"; src: string; size: number; anchor: "bottom" | "center" }
  | { kind: "pin"; cssColor: string; borderCssColor: string }
  | { kind: "pin-icon"; icon: string; cssColor: string; borderCssColor: string }
  | { kind: "circle"; cssColor: string; borderCssColor: string }
  | { kind: "circle-icon"; icon: string; cssColor: string; borderCssColor: string }
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

/** Sélecteurs de RENDU : les champs sur lesquels la chaîne de repli branche.
 *  Un cas de `by` qui en déclare un remplace TOUS ceux du marqueur de base
 *  (sinon un `iconUrl` de base masquerait son `style: "pin"` en silence). */
const KIND_SELECTORS = ["useItemImage", "colorBy", "icon", "iconUrl", "style"] as const;

/** Fusion cas de `by` ⊕ marqueur de base : champ par champ, sauf les sélecteurs
 *  de rendu du base, écartés en bloc dès que le cas en déclare un. */
function mergeMarkerConf(base: MarkerVisualConf, override: MarkerVisualConf): MarkerVisualConf {
  const overridesKind = KIND_SELECTORS.some((k) => override[k] !== undefined);
  if (!overridesKind) return { ...base, ...override };
  const inherited: MarkerVisualConf = { ...base };
  for (const k of KIND_SELECTORS) delete inherited[k];
  return { ...inherited, ...override };
}

/**
 * Étage A : choisit le marqueur d'après la donnée. Lit `by.path` dans
 * serverData (string/nombre/booléen, ou tableau → la 1re valeur présente dans
 * `mapping` gagne, l'ordre de l'item faisant foi), puis fusionne le cas trouvé
 * — à défaut `by.default` — sur le marqueur de base. Valeur non listée et pas
 * de `default` → le marqueur de base tel quel.
 */
function resolveMarkerBy(
  serverData: Record<string, unknown> | undefined,
  conf: MarkerConf,
  by: MarkerByConf,
): MarkerVisualConf {
  const raw = serverData ? getValueByPath(serverData, by.path) : undefined;
  const values = Array.isArray(raw) ? raw : [raw];
  for (const v of values) {
    if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") continue;
    const hit = by.mapping[String(v)];
    if (hit) return mergeMarkerConf(conf, hit);
  }
  return by.default ? mergeMarkerConf(conf, by.default) : conf;
}

/** Forme de thème (goutte par défaut, pastille si `style: "circle"`), avec le
 *  glyphe lucide d'`icon` en son centre s'il est déclaré. Factorisé : `colorBy`
 *  et `style` produisent la MÊME forme, seule la couleur diffère. */
function shapeVisual(
  conf: MarkerVisualConf,
  cssColor: string,
  borderCssColor: string,
): MarkerVisual {
  const circle = conf.style === "circle";
  if (conf.icon) {
    return { kind: circle ? "circle-icon" : "pin-icon", icon: conf.icon, cssColor, borderCssColor };
  }
  return { kind: circle ? "circle" : "pin", cssColor, borderCssColor };
}

export function resolveMarkerVisual(
  serverData: Record<string, unknown> | undefined,
  markerConf: MarkerConf | undefined,
  baseUrl: string,
): MarkerVisual {
  // Étage A puis B : `by` choisit, la chaîne rend (le marqueur choisi n'a plus
  // de `by` — pas de récursion possible depuis la config).
  const conf: MarkerVisualConf | undefined = markerConf?.by
    ? resolveMarkerBy(serverData, markerConf, markerConf.by)
    : markerConf;
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
  if (conf?.colorBy) {
    const match = resolveColorBy(serverData, conf.colorBy);
    if (match) {
      // Seul le REMPLISSAGE vient du mapping : le contour suit la même règle
      // que le pin/pastille classique (déf. background, lisible sur tout fond).
      return shapeVisual(
        conf,
        match.cssColor,
        PIN_BORDER_VARS[conf.borderColor ?? "background"] ?? "var(--background)",
      );
    }
  }
  if (conf?.iconUrl) {
    const src = conf.iconUrl.startsWith("http") ? conf.iconUrl : `${baseUrl}${conf.iconUrl}`;
    return { kind: "icon", src, size: conf.iconSize ?? 34, anchor: conf.iconAnchor ?? "bottom" };
  }
  // `icon` seul suffit : sans lui, un marqueur déclarant un pictogramme mais
  // aucun `style` tomberait sur le pin nu et perdrait son glyphe en silence.
  if (conf?.style === "pin" || conf?.style === "circle" || conf?.icon) {
    const cssColor = PIN_COLOR_VARS[conf.color ?? "primary"] ?? "var(--primary)";
    // Contour (pin : tracé + pastille ; circle : anneau) — jeton de bordure,
    // déf. background (contraste lisible sur tout fond, en light comme en dark).
    const borderCssColor = PIN_BORDER_VARS[conf.borderColor ?? "background"] ?? "var(--background)";
    return shapeVisual(conf, cssColor, borderCssColor);
  }
  return { kind: "default" };
}
