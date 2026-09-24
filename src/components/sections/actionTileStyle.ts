import type { CSSProperties } from "react";
import type { ActionTilesProps } from "@/types/site-schema";

/**
 * Style d'une tuile `action-tiles` à fond PLEIN (`background`, `textColor` : couleurs CSS, `var(--jeton)`
 * recommandé) — `undefined` sans `background`, la tuile garde alors sa teinte à 20 % de `color`.
 *
 * La bordure prend la couleur du fond, pour que la tuile reste un aplat. Les couleurs sont FIXES en clair
 * comme en sombre : sans `textColor`, le texte suivrait le thème et pourrait devenir illisible en sombre.
 */
export function solidTileStyle(background?: string, textColor?: string): CSSProperties | undefined {
  if (!background?.trim()) return undefined;
  return {
    backgroundColor: background,
    borderColor: background,
    ...(textColor?.trim() ? { color: textColor } : {}),
  };
}

export interface TileSizeClasses {
  title: string;
  subtitle: string;
  icon: string;
  /** Classes de la tuile elle-même (marges, alignement du contenu). */
  box: string;
}

/**
 * Classes écrites en toutes lettres : Tailwind ne détecte pas un nom construit à l'exécution.
 *
 * `md` reproduit le rendu historique, à la classe près (les autres sites du parc en dépendent) : le titre
 * hérite du `text-sm` du Button, et `w-8 h-8` ne l'emporte pas sur le `size-4` que le Button pose sur ses
 * svg — l'icône sort en 16 px.
 *
 * `lg` : `size-8` pour obtenir réellement 32 px, et contenu calé en HAUT — à hauteur égale, un contenu
 * centré décalait icônes et titres d'une tuile à l'autre dès qu'un titre passait sur une ligne de plus.
 * Pas de `px-*` : le `has-[>svg]:px-4` du Button (taille `lg`) l'emporte, la marge horizontale reste 16 px.
 */
const TILE_SIZES: Record<NonNullable<ActionTilesProps["size"]>, TileSizeClasses> = {
  md: { title: "font-semibold", subtitle: "text-xs", icon: "w-8 h-8", box: "py-6" },
  lg: { title: "text-lg font-semibold", subtitle: "text-base", icon: "size-8", box: "py-8 justify-start" },
};

export function tileSizeClasses(size?: ActionTilesProps["size"]): TileSizeClasses {
  return TILE_SIZES[size ?? "md"];
}

/** Largeur max de la grille : `wide` pour 4 tuiles et plus en taille `lg`, sinon la largeur historique. */
export function tilesContainerWidth(width?: ActionTilesProps["width"]): string {
  return width === "wide" ? "max-w-7xl" : "max-w-5xl";
}
