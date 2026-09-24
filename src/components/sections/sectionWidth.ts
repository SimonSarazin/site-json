/**
 * Largeur MAXIMALE du contenu d'une section (`maxWidth`), sur l'échelle Tailwind. Sert à aligner des
 * bandes voisines : deux sections qui ne partagent pas leur largeur se lisent comme un décrochage.
 *
 * Classes écrites en toutes lettres : Tailwind ne détecte pas un nom construit à l'exécution.
 */
const WIDTHS: Record<string, string> = {
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
  full: "max-w-full",
};

/** Classe de largeur, ou `repli` (la largeur historique de la section) si rien n'est demandé. */
export function sectionMaxWidthClass(maxWidth: string | undefined, repli = ""): string {
  return (maxWidth && WIDTHS[maxWidth]) || repli;
}
