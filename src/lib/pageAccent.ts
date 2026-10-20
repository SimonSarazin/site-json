import type { CSSProperties } from "react";

/**
 * Variables d'accent d'une PAGE (`page.accent` — couleur CSS, `var(--jeton)` recommandé), posées sur son
 * `<main>` : la couleur elle-même et son aplat léger, dont se servent les sections en `bg: "page-accent"`.
 *
 * L'aplat est mélangé au FOND du thème (`--background`) et non à `transparent` : il reste alors le même
 * quel que soit ce qui se trouve derrière, et suit le mode clair/sombre. 16 % : assez pour séparer deux
 * sections voisines (12 % se voyait à peine sur les teintes claires), assez peu pour ne pas altérer
 * le contraste du texte posé dessus, mesuré au-dessus de 12:1 pour un titre sur les 9 teintes de parent62.
 *
 * `undefined` sans accent : le `<main>` ne porte alors aucun style en ligne.
 */
export function pageAccentVars(accent?: string): CSSProperties | undefined {
  const couleur = accent?.trim();
  if (!couleur) return undefined;
  return {
    "--page-accent": couleur,
    "--page-accent-soft": `color-mix(in oklab, ${couleur} 16%, var(--background))`,
  } as CSSProperties;
}
