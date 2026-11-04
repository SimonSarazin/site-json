/**
 * Couleurs venues de la DONNEE (tableau, etiquette) — pure, testee par
 * `tests/unit/colors.test.ts`.
 *
 * Un seul endroit decide ce qu'est un hexadecimal : trois regex divergentes
 * (3/6/8 chiffres, 3/6 avec espaces, 6 seulement) acceptaient « #abc » ici et
 * le refusaient la, si bien qu'une meme couleur s'affichait sur une etiquette
 * et retombait sur la teinte par defaut sur une tuile.
 */

/** Formes hexadecimales que CSS comprend et que l'on accepte : `#rgb`, `#rrggbb`, `#rrggbbaa`. */
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * Forme STRICTE `#rrggbb` : la seule que le module PHP enregistre
 * (`KanbanInput`, `KanbanBoard`), et la seule que savent decouper les calculs
 * de teinte (melange, luminance relative) qui lisent trois paires de chiffres.
 */
const STRICT_HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value);
}

export function isStrictHexColor(value: unknown): value is string {
  return typeof value === 'string' && STRICT_HEX_COLOR.test(value);
}

/**
 * Teinte de l'aurore d'un tableau (DESIGN §5) : sa couleur si c'est une
 * hexadecimale STRICTE — la valeur finit dans une propriete CSS, et le melange
 * de `--ck-aurora-tint` decoupe trois paires de chiffres —, sinon `null` (le
 * jeton par defaut). Vit ici, et non avec la page « Mes projets » : la coque
 * (`AppShell`) n'a pas a dependre d'un module de page.
 */
export function auroraTint(color: string | null | undefined): string | null {
  return isStrictHexColor(color) ? color.toLowerCase() : null;
}

/**
 * La couleur d'un tableau ou d'une etiquette est saisie par un humain, pas
 * derivee des jetons : on ne la laisse entrer dans un attribut `style` que si
 * c'est bien un hexadecimal, et on retombe sinon sur un jeton.
 */
export function safeHexColor(color: unknown, fallback: string): string {
  return isHexColor(color) ? color : fallback;
}
