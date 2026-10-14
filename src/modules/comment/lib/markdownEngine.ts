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
 * - `image` est coupée À LA SOURCE : une image distante ne peut pas exister dans la sortie,
 *   plutôt que d'en être retirée après coup ;
 * - un titre s'écrit à croisillons, six niveaux (`# titre` … `###### titre`) — ce qu'écrit
 *   l'éditeur du legacy. Le titre SOULIGNÉ (`lheading`) reste coupé : une ligne suivie de `---`
 *   est un texte suivi d'un filet, comme le fil l'a toujours rendu, et non un titre surprise.
 *
 * Chaque appel rend une instance neuve : le fil y pose sa règle de lien, l'éditeur sa règle de
 * mention, sans que l'un ne modifie l'autre.
 */
export function createCommentMarkdown(): MarkdownIt {
  return new MarkdownIt({ html: false, linkify: true, breaks: true }).disable(["lheading", "image"]);
}
