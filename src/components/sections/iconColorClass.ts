/**
 * Teinte d'une icône de carte, depuis le jeton déclaré en config.
 *
 * Extrait de `FeaturesGlass` pour être partagé avec `CtaCardGrid` : les deux rendent une grille de
 * cartes à icône et doivent teinter de la même façon, sinon deux sections voisines du même site
 * divergent. Classes LITTÉRALES — une classe construite ne serait pas générée par le JIT.
 *
 * ⚠️ Le schéma autorise davantage de valeurs que cette table n'en traite (`turquoise`,
 * `cyan-bright`, `turquoise-light`) : elles retombent sur `primary`, comme avant l'extraction.
 * Le comportement est conservé À L'IDENTIQUE — 2 cartes du parc déclarent `turquoise` et rendent
 * déjà en primary ; les teinter maintenant déplacerait un site qui n'a rien demandé.
 */
export function iconColorClass(color?: string): string {
  switch (color) {
    case "accent":
      return "text-accent";
    case "chart-2":
      return "text-chart-2";
    case "chart-3":
      return "text-chart-3";
    case "primary":
    default:
      return "text-primary";
  }
}

/**
 * Teinte de la PASTILLE qui porte l'icône, depuis le même jeton.
 *
 * Pourquoi la pastille plutôt que le glyphe dans `CtaCardGrid` : sur la palette claire de parent62,
 * `accent`, `chart-2` et `chart-3` tombent à **1,6 / 2,3 / 2,2 : 1** sur le fond `secondary` de la
 * section — mesuré. Un glyphe teinté y devient illisible ; la même teinte posée en fond de pastille,
 * avec un glyphe resté sur `primary` (9,6 : 1), donne la couleur SANS perdre le contraste.
 * L'état de survol fait partie de la classe — il existait en dur avant l'extraction
 * (`group-hover:bg-primary/20`) et devait suivre la teinte. Classes littérales, sinon le JIT ne
 * les génère pas.
 */
export function iconHaloClass(color?: string): string {
  switch (color) {
    case "accent":
      return "bg-accent/30 group-hover:bg-accent/40";
    case "chart-2":
      return "bg-chart-2/30 group-hover:bg-chart-2/40";
    case "chart-3":
      return "bg-chart-3/30 group-hover:bg-chart-3/40";
    case "primary":
    default:
      return "bg-primary/10 group-hover:bg-primary/20";
  }
}
