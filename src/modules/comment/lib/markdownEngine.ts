import MarkdownIt from "markdown-it";

/**
 * Le dialecte markdown d'un message — UN réglage, pour le fil qui rend et pour l'éditeur qui relit.
 *
 * Les deux doivent lire le même texte de la même façon : ce que l'éditeur montre pendant qu'on
 * écrit est ce que le fil affichera. Deux réglages qui divergeraient d'une option feraient mentir
 * l'un des deux — d'où cette fabrique, plutôt qu'un `new MarkdownIt(…)` de chaque côté.
 *
 * - `html: false` échappe tout HTML écrit par l'auteur ;
 * - `linkify: true` fait un lien d'une adresse nue ;
 * - `breaks: true` : dans une discussion, un retour à la ligne simple est voulu par qui écrit ;
 * - `heading`, `lheading`, `image` sont coupées À LA SOURCE : un `# titre` ou une image distante
 *   ne peuvent pas exister dans la sortie, plutôt que d'en être retirés après coup.
 *
 * Chaque appel rend une instance neuve : le fil y pose sa règle de lien, l'éditeur sa règle de
 * mention, sans que l'un ne modifie l'autre.
 */
export function createCommentMarkdown(): MarkdownIt {
  return new MarkdownIt({ html: false, linkify: true, breaks: true }).disable(["heading", "lheading", "image"]);
}
