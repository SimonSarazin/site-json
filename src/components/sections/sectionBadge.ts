/**
 * Pastille de titre de section — le repère visuel inclinable partagé par `articleTeaser`,
 * `action-tiles`, `featured-carousel` et `map-bubbles` en mode carte (`headlineStyle: "badge"`) : une
 * page qui alterne des bandes porte ainsi le MÊME repère partout. Recopiée, la classe divergeait au
 * premier ajustement.
 *
 * Seule exception : la disposition « sticker » de `map-bubbles` garde sa propre classe, dont les
 * tailles suivent la largeur de la carte (`@container`), pas celle de la page.
 */
const SECTION_BADGE_CLASS =
  "rounded-none border-none -rotate-4 px-4 py-1.5 shadow-md text-2xl md:text-3xl font-serif";

/**
 * Variante PILULE : arrondie, droite, posée en haut d'une carte (et débordant de son bord quand la
 * section la place ainsi). Même repère, lecture plus calme sur une page qui empile des cartes.
 */
const SECTION_BADGE_PILL_CLASS =
  "rounded-full border-none px-5 py-2 shadow-md text-lg md:text-xl font-serif";

/**
 * Variante TEXTE : sans fond ni rotation ni ombre — juste le texte, en plus grand. PAS de police
 * forcée ici : porté par un `<h2>`, il hérite de `--font-serif`/Patrick Hand (règle globale
 * `h1,h2,h3,h4`), le rendu historique des titres de section — un consommateur qui veut la police du
 * menu (`--font-sans`) l'ajoute lui-même (ex. `action-tiles` en `tileLayout:"pillRow"`, à côté
 * d'actions qui, elles, sont déjà en police du thème). Couleur posée par l'appelant via `color` (pas
 * de fond à teinter, donc `accentStyle` — qui pose un FOND — ne s'applique pas ici, cf.
 * `sectionHeadlineStyle`).
 */
const SECTION_BADGE_TEXT_CLASS =
  "rounded-none border-none shadow-none bg-transparent px-0 py-0 text-3xl md:text-4xl font-bold";

/** Classe de la pastille de titre d'une section, selon sa forme (`headlineStyle`) — `badge` par défaut. */
export function sectionBadgeClass(headlineStyle?: string): string {
  if (headlineStyle === "pill") return SECTION_BADGE_PILL_CLASS;
  if (headlineStyle === "text") return SECTION_BADGE_TEXT_CLASS;
  return SECTION_BADGE_CLASS;
}

/**
 * Style inline du titre : `accentStyle` (fond + encre) pour `badge`/`pill`, ou simple `color` pour
 * `text` — cette variante n'a pas de fond, le poser quand même via `backgroundColor` (un style EN
 * LIGNE, toujours prioritaire sur les classes Tailwind) empêcherait `bg-transparent` de jouer son rôle.
 */
export function sectionHeadlineStyle(
  headlineStyle: string | undefined,
  color: string | undefined,
  textColor: string | undefined,
): { backgroundColor?: string; color?: string } | undefined {
  if (headlineStyle === "text") {
    const encre = color?.trim();
    return encre ? { color: encre } : undefined;
  }
  return color?.trim() ? { backgroundColor: color, color: textColor?.trim() || "#fff" } : undefined;
}
