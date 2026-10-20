/**
 * Résolution d'un JETON de thème en couleur peignable par MapLibre.
 *
 * POURQUOI CE DÉTOUR. Les couches de contours se déclarent en jetons (`primary`, `muted`…) comme
 * tout le reste du design system — mais MapLibre peint en WebGL : il ne connaît ni les variables
 * CSS ni les classes Tailwind, et son parseur de couleurs n'accepte pas les espaces colorimétriques
 * modernes. Or `config.theme.colors` est écrit en **oklch**. On demande donc au NAVIGATEUR de
 * faire la conversion : un contexte canvas normalise n'importe quelle couleur CSS qu'il comprend
 * en `#rrggbb` / `rgba(…)`, forme que MapLibre accepte partout.
 *
 * Client-only : hors navigateur (SSR, test node), la fonction rend le repli sans rien tenter.
 */

/**
 * Jeton de thème → couleur utilisable **en CSS** (`primary` → `var(--primary)`) ; une couleur
 * littérale (`#0f766e`, `rgb(…)`, `oklch(…)`) passe telle quelle.
 *
 * À ne pas confondre avec {@link resolveThemeColor} : ici il n'y a rien à convertir, le navigateur
 * résout la variable lui-même et suit donc le mode clair/sombre sans qu'on relise quoi que ce soit.
 * La sonde canvas n'existe que pour MapLibre, qui peint en WebGL et refuse l'`oklch` du thème.
 * Tout ce qui rend en DOM (légende, SVG) doit passer par ICI.
 */
export function cssColorToken(token: string | undefined, fallback: string): string {
  if (!token || token === "none") return fallback;
  return token.startsWith("#") || token.includes("(") ? token : `var(--${token})`;
}

let cachedContext: CanvasRenderingContext2D | null | undefined;

function getContext(): CanvasRenderingContext2D | null {
  if (cachedContext !== undefined) return cachedContext;
  if (typeof document === "undefined") {
    cachedContext = null;
    return cachedContext;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  cachedContext = canvas.getContext("2d", { willReadFrequently: true });
  return cachedContext;
}

function toHex(value: number): string {
  return value.toString(16).padStart(2, "0");
}

/**
 * Normalise une couleur CSS quelconque en sRGB.
 *
 * On PEINT un pixel et on le relit, au lieu de relire `fillStyle` : Chrome accepte `oklch(…)` et
 * le ressert TEL QUEL, ce que MapLibre refuse (« color expected, "oklch(0.52 0.118 166)" found »).
 * Le pixel, lui, est déjà converti et écrêté dans le gamut sRGB — la seule forme que le canvas
 * WebGL de la carte sait peindre.
 *
 * Double sonde : une couleur illisible laisse `fillStyle` sur sa valeur précédente, donc deux
 * sentinelles différentes donnent deux pixels différents — c'est ce qui distingue « couleur
 * refusée » de « couleur qui vaut vraiment la sentinelle ».
 */
function normalizeCssColor(color: string): string | null {
  const context = getContext();
  if (!context) return null;

  const probe = (sentinel: string): [number, number, number, number] => {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = sentinel;
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a];
  };

  const first = probe("#ff0000");
  const second = probe("#00ff00");
  if (first.some((channel, index) => channel !== second[index])) return null;

  const [r, g, b, a] = first;
  return a >= 255 ? `#${toHex(r)}${toHex(g)}${toHex(b)}` : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
}

/**
 * `token` peut être :
 *  - un jeton du thème (`primary`, `muted`, `chart-1`…) → lu dans les variables CSS de `:root`,
 *    donc SUIT le mode clair/sombre courant ;
 *  - une couleur CSS littérale (`#0f766e`, `rgb(…)`) → utilisée telle quelle ;
 *  - `undefined` / illisible → `fallback`.
 *
 * À rappeler quand le thème change : la valeur d'un jeton dépend de la classe `dark` du document.
 */
export function resolveThemeColor(token: string | undefined, fallback: string): string {
  if (!token) return fallback;
  if (typeof document === "undefined") return fallback;

  const variableName = token.startsWith("--") ? token : `--${token}`;
  const fromTheme = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();

  return normalizeCssColor(fromTheme) ?? normalizeCssColor(token) ?? fallback;
}
