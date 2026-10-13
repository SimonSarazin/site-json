import type { Extensions } from "@tiptap/core";
import Mention from "@tiptap/extension-mention";
import StarterKit from "@tiptap/starter-kit";

/**
 * Le nœud `mention`, étendu de ce qu'il faut pour renvoyer la personne au serveur.
 *
 * Le nœud d'origine porte `id` et `label` ; un message, lui, écrit `@slug` et envoie
 * `mentions[]` avec le slug et le type. Le nœud est donc AUTOSUFFISANT : le texte et la liste se
 * tirent du document, sans table tenue à côté (`markdownBridge`).
 *
 * `slug` et `kind` voyagent en `data-*` : copier une mention puis la coller dans le même champ doit
 * rendre la même personne, pas un nom sans cible.
 */
export const CommentMentionNode = Mention.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      slug: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-slug"),
        renderHTML: (attributes: { slug?: string | null }) => (attributes.slug ? { "data-slug": attributes.slug } : {}),
      },
      kind: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-kind"),
        renderHTML: (attributes: { kind?: string | null }) => (attributes.kind ? { "data-kind": attributes.kind } : {}),
      },
    };
  },
});

/**
 * Le schéma d'un message : ce que le markdown du fil sait écrire, rien de plus.
 *
 * - pas de titre (le fil coupe `heading` à la source) ni de souligné (aucun markdown pour lui) ;
 * - le filet horizontal RESTE : sans son nœud, éditer un message qui en porte le déformerait ;
 * - pas d'image dans le texte : le fil les refuse à dessein, une image est une pièce jointe ;
 * - le lien ne s'ouvre pas au clic pendant qu'on écrit.
 *
 * Une fonction, pas une constante : l'éditeur y ajoute les siennes (suggestion de mention, texte
 * d'attente, clavier), et chaque éditeur doit recevoir ses propres instances.
 */
export function commentExtensions(mention: typeof CommentMentionNode = CommentMentionNode): Extensions {
  return [
    StarterKit.configure({
      heading: false,
      underline: false,
      link: { openOnClick: false, autolink: true, linkOnPaste: true, HTMLAttributes: { rel: "noopener noreferrer nofollow ugc", target: null } },
    }),
    mention,
  ];
}
