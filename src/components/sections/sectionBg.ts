/**
 * Fond d'une section piloté par la config (`bg`) — jetons SÉMANTIQUES du thème, jamais une couleur en dur :
 * une section garde ainsi le fond de son site en clair comme en sombre.
 *
 * Classes écrites en toutes lettres : Tailwind ne détecte pas un nom construit à l'exécution.
 *
 * `ActionTiles` et `CardCountCTSection` gardent leur propre table : la première a un dégradé par défaut,
 * la seconde accepte en plus une classe Tailwind brute et des dégradés — ce ne sont pas les mêmes contrats.
 */
const SECTION_BG_CLASSES: Record<string, string> = {
  default: "",
  card: "bg-card",
  muted: "bg-muted",
  primary: "bg-primary/10",
  secondary: "bg-secondary",
  accent: "bg-accent/10",
  transparent: "bg-transparent",
  /**
   * Bandeau d'accent de la PAGE (`page.accent`, posé sur le `<main>`) : aplat léger + filet supérieur à la
   * couleur pleine, qui marque la frontière même entre deux bandeaux teintés voisins. Sans accent de page
   * les variables n'existent pas : le repli `transparent` évite un fond et un filet au hasard.
   */
  "page-accent": "bg-[var(--page-accent-soft,transparent)] border-t-2 border-[var(--page-accent,transparent)]",
};

/** Classe de fond d'une section, ou chaîne vide (fond hérité) pour `default` et pour un jeton inconnu. */
export function sectionBgClass(bg?: string): string {
  return (bg && SECTION_BG_CLASSES[bg]) || "";
}
