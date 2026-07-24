/**
 * Bits GÉNÉRIQUES du contenu « testimonial » (témoignage), partagés par les designs (card + preview).
 * Aucune valeur de site en dur : les couleurs viennent de maps de config (`badge.colors`/`accent.colors`)
 * via `valueColor`, avec repli sur une palette déterministe (tokens du thème) ; le patron de teinte
 * `bubbleTint` tient en clair ET en sombre (color-mix contre var(--card/foreground)).
 */
import { normalizeFilterValue } from "./dropdownFilters";

/** Palette-bulles par défaut (tokens du thème) — couleur déterministe d'une valeur sans map explicite. */
const DEFAULT_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/** Hash stable (djb2/imul) d'une chaîne → entier non signé. Déterministe (pas de Math.random). */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Couleur d'une valeur de taxonomie. Priorité :
 *  1. map explicite (config `badge.colors`/`accent.colors`) — clés matchées via `normalizeFilterValue`
 *     (tolère accents/casse/apostrophes) → subtilité de marque (« Boulonnais » garde SA couleur) ;
 *  2. sinon palette déterministe (hash → chart-*) — toute valeur reçoit une couleur stable ;
 *  3. sinon `var(--primary)` (valeur vide).
 * `map`/`value` peuvent être `undefined`. Les couleurs acceptent `var(--x)` ou un hex.
 */
export function valueColor(
  value: string | undefined,
  opts?: { map?: Record<string, string>; palette?: string[] },
): string {
  if (!value) return "var(--primary)";
  const map = opts?.map;
  if (map) {
    const target = normalizeFilterValue(value);
    for (const [k, v] of Object.entries(map)) {
      if (normalizeFilterValue(k) === target) return v;
    }
  }
  const palette = opts?.palette ?? DEFAULT_PALETTE;
  if (palette.length === 0) return "var(--primary)";
  return palette[hashString(normalizeFilterValue(value)) % palette.length];
}

/**
 * Jeu de teintes douces dérivées d'une couleur-bulle : `surface` (corps de bulle),
 * `surfaceStrong`/`border`/`text` (pilule). `color` peut être une var CSS ou un hex.
 */
export function bubbleTint(color: string) {
  return {
    surface: `color-mix(in oklab, ${color} 12%, var(--card))`,
    surfaceStrong: `color-mix(in oklab, ${color} 16%, var(--card))`,
    border: `color-mix(in oklab, ${color} 34%, transparent)`,
    text: `color-mix(in oklab, ${color} 58%, var(--foreground))`,
  };
}

/**
 * URL du 1er média d'un type donné dans un tableau `medias` (`[{type, url}]`), ou `null`.
 * L'`url` (docPath) est DÉJÀ absolue (posée par le backend `saveDocument`) → aucune re-normalisation.
 */
export function firstMediaUrl(medias: unknown, kind = "audio"): string | null {
  if (!Array.isArray(medias)) return null;
  const media = medias.find(
    (m) => m && typeof m === "object" && (m as { type?: string }).type === kind,
  ) as { url?: string } | undefined;
  return typeof media?.url === "string" && media.url ? media.url : null;
}

/** Hostname d'une URL sans le `www.` (`https://www.youtube.com/x` → `youtube.com`), ou l'entrée brute si non parsable. */
export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
