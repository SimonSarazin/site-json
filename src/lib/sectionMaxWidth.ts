/**
 * Largeurs de conteneur exposées aux sections par une prop `maxWidth` de config.
 *
 * Les classes sont écrites EN TOUTES LETTRES : Tailwind scanne les sources et ne
 * détecte pas un nom construit à l'exécution — `max-w-${width}` serait purgé du
 * build et la section n'aurait plus AUCUNE largeur maximale.
 *
 * `8xl` (90 rem) repose sur le jeton `--container-8xl` défini dans
 * `styles/shared.css` : l'échelle Tailwind s'arrête à `7xl`.
 */
export const SECTION_MAX_WIDTH = {
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
  "8xl": "max-w-8xl",
  full: "max-w-none",
} as const;

export type SectionMaxWidth = keyof typeof SECTION_MAX_WIDTH;

/**
 * Classe de largeur pour une valeur de config, avec repli.
 *
 * Le second `??` n'est pas défensif par principe : la config JSON n'est JAMAIS
 * parsée par Zod à l'exécution, donc une valeur hors énumération (faute de
 * frappe, échelon inventé) arrive telle quelle jusqu'ici. Sans ce repli, la
 * section perdrait toute largeur maximale — l'échec le plus visible possible
 * pour la faute la plus discrète.
 */
export function sectionMaxWidthClass(
  width: string | undefined,
  fallback: SectionMaxWidth,
): string {
  return (
    SECTION_MAX_WIDTH[width as SectionMaxWidth] ?? SECTION_MAX_WIDTH[fallback]
  );
}
