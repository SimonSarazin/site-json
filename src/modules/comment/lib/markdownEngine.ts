import MarkdownIt from "markdown-it";

type Jeton = ReturnType<MarkdownIt["parseInline"]>[number];

/**
 * Un signe échappé DANS la description d'une image (`![a \] b](…)`) reste un jeton `text_special`,
 * que `renderInlineAsText` — d'où sort l'attribut `alt` — ignore : la description perdait ses
 * crochets, ses étoiles, ses barres obliques. `markdown-it` ne les rend au texte (`text_join`) que
 * pour les jetons directs d'un bloc, jamais pour ceux d'une image. On finit son travail.
 */
function signesDesDescriptions(jetons: readonly Jeton[] | null): void {
  for (const jeton of jetons ?? []) {
    if (jeton.type === "text_special") jeton.type = "text";
    if (jeton.type === "image") signesDesDescriptions(jeton.children);
  }
}

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
 * - `![description](adresse)` est une image DANS le texte (décision de l'user, 14/10/2026). Ce que le
 *   fil en fait dépend de son adresse (`lib/inlineImages`) : importée sur la plateforme, elle
 *   s'affiche ; tierce, elle attend un clic du lecteur ; `data:` ou autre, jamais. Le moteur se
 *   contente de la lire — c'est le fil qui décide, image par image (`CommentMarkdown`) ;
 * - un titre s'écrit à croisillons, six niveaux (`# titre` … `###### titre`) — ce qu'écrit
 *   l'éditeur du legacy. Le titre SOULIGNÉ (`lheading`) reste coupé : une ligne suivie de `---`
 *   est un texte suivi d'un filet, comme le fil l'a toujours rendu, et non un titre surprise.
 *
 * Chaque appel rend une instance neuve : le fil y pose sa règle de lien, l'éditeur sa règle de
 * mention, sans que l'un ne modifie l'autre.
 */
export function createCommentMarkdown(): MarkdownIt {
  const md = new MarkdownIt({ html: false, linkify: true, breaks: true }).disable(["lheading"]);
  md.core.ruler.after("text_join", "comment_image_alt", state => {
    for (const bloc of state.tokens) {
      for (const jeton of bloc.children ?? []) {
        if (jeton.type === "image") signesDesDescriptions(jeton.children);
      }
    }
  });
  return md;
}
