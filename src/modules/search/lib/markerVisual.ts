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

/** Taille du marqueur en px — `size` est porté par TOUTES les formes (pas
 *  seulement l'icône custom), cf. `iconSize` dans la config. */
export type MarkerVisual =
  | { kind: "image"; src: string; size: number }
  | { kind: "icon"; src: string; size: number; anchor: "bottom" | "center" }
  | { kind: "pin"; cssColor: string; borderCssColor: string; size: number }
  | { kind: "pin-icon"; icon: string; cssColor: string; borderCssColor: string; size: number }
  | { kind: "circle"; cssColor: string; borderCssColor: string; size: number }
  | { kind: "circle-icon"; icon: string; cssColor: string; borderCssColor: string; size: number }
  | { kind: "default"; size: number };

/**
 * Tailles par défaut PAR FORME — reprises des dimensions historiques (CSS pour
 * la vignette et la pastille, SVG pour la goutte). Sans `iconSize` déclaré, un
 * marqueur rend donc exactement comme avant ; le déclarer pilote désormais
 * TOUTES les formes, plus seulement `iconUrl`.
 */
const DEFAULT_SIZE = { image: 36, circle: 30, pin: 34, icon: 34 } as const;

/**
 * Taille déclarée, sinon le défaut de la forme.
 *
 * Coerce les chaînes numériques : le schéma valide `iconSize` via
 * `z.coerce.number()`, mais la config N'EST PAS parsée par Zod au runtime (le
 * JSON brut est servi tel quel — Zod ne sert qu'à l'outillage et au preflight).
 * Sans cette coercition, un `"45"` passerait la validation puis serait ignoré
 * ici : la carte rendrait la taille par défaut sans le moindre avertissement,
 * exactement le mode d'échec silencieux qu'on cherche à supprimer.
 * Une valeur non numérique ou nulle retombe sur le défaut de la forme —
 * jamais sur 0, qui rendrait le marqueur invisible.
 */
function sizeOf(conf: MarkerVisualConf | undefined, fallback: number): number {
  // `unknown` volontaire : le type annonce `number`, mais la valeur vient d'un
  // JSON jamais validé au runtime — elle peut être une chaîne, voire n'importe quoi.
  const declared: unknown = conf?.iconSize;
  if (declared === undefined || declared === null || declared === "") return fallback;
  const size = Number(declared);
  return Number.isFinite(size) && size > 0 ? size : fallback;
}

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
  // `by` a fini son travail ici : la conf résolue ne le porte plus.
  const { by: _consumed, ...base } = conf;
  const raw = serverData ? getValueByPath(serverData, by.path) : undefined;
  const values = Array.isArray(raw) ? raw : [raw];
  for (const v of values) {
    if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") continue;
    const hit = by.mapping[String(v)];
    if (hit) return mergeMarkerConf(base, hit);
  }
  return by.default ? mergeMarkerConf(base, by.default) : base;
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
  const size = sizeOf(conf, circle ? DEFAULT_SIZE.circle : DEFAULT_SIZE.pin);
  if (conf.icon) {
    return { kind: circle ? "circle-icon" : "pin-icon", icon: conf.icon, cssColor, borderCssColor, size };
  }
  return { kind: circle ? "circle" : "pin", cssColor, borderCssColor, size };
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
      return {
        kind: "image",
        src: img.startsWith("http") ? img : `${baseUrl}${img}`,
        size: sizeOf(conf, DEFAULT_SIZE.image),
      };
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
    return {
      kind: "icon",
      src,
      size: sizeOf(conf, DEFAULT_SIZE.icon),
      anchor: conf.iconAnchor ?? "bottom",
    };
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
  // Le défaut rend une goutte : `iconSize` doit donc le dimensionner aussi,
  // sinon un site qui ne déclare QUE la taille n'obtiendrait aucun effet.
  return { kind: "default", size: sizeOf(conf, DEFAULT_SIZE.pin) };
}
