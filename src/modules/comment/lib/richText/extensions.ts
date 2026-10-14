import { Extension, Mark, markInputRule, type Extensions, type InputRuleMatch } from "@tiptap/core";
import Mention from "@tiptap/extension-mention";
import { Plugin, PluginKey } from "@tiptap/pm/state";
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

/** `` `code` `` tapé : jusqu'à l'accent grave qui ferme — sauf s'il en précède ou en suit un autre. */
function codeTape(text: string): InputRuleMatch | null {
  const lu = /`([^`]+)`(?!`)$/.exec(text);
  if (!lu || (lu.index > 0 && text[lu.index - 1] === "`")) return null;
  return { index: lu.index, text: lu[0], replaceWith: lu[1] };
}

/**
 * Le code en ligne.
 *
 * Celui du kit CHASSE toute autre marque. Le markdown, lui, sait écrire un code dans un gras ou
 * dans un lien (`` [`npm i`](https://…) ``) : avec la marque du kit, relire un tel message faisait
 * tomber le lien, et le réenregistrer le perdait. Celle-ci cohabite avec les autres.
 *
 * Elle passe APRÈS elles (`priority`) : un nœud range ses marques dans l'ordre du schéma, et la
 * bibliothèque qui écrit le markdown veut le code en dernier, au plus près du texte.
 */
const CommentCode = Mark.create({
  name: "code",
  priority: 50,
  excludes: "",
  code: true,
  exitable: true,
  parseHTML() {
    return [{ tag: "code" }];
  },
  renderHTML() {
    return ["code", 0];
  },
  addCommands() {
    return { toggleCode: () => ({ commands }) => commands.toggleMark(this.name) };
  },
  addKeyboardShortcuts() {
    return { "Mod-e": () => this.editor.commands.toggleMark(this.name) };
  },
  addInputRules() {
    return [markInputRule({ find: codeTape, type: this.type })];
  },
});

/**
 * Deux drapeaux sur la marque de lien, lus par le pont (`markdownBridge`, `lireLeLien`).
 *
 * `explicit` : ce lien a été ÉCRIT — par le bouton Lien, ou relu d'un `[texte](adresse)` — par
 * opposition à une adresse que l'éditeur a liée de lui-même en la voyant passer. La différence
 * compte quand le texte d'un lien est lui-même une adresse : sans ce drapeau, c'est le texte qui
 * dit où le lien mène.
 *
 * `bounded` : une adresse relue ENTRE CHEVRONS (`<https://…>`). Son auteur a dit où elle s'arrête :
 * ce qui la suit sans espace ne la prolonge pas.
 *
 * Des attributs globaux, pour ne pas dépendre du paquet de l'extension de lien, que le kit
 * embarque. Ils ne s'écrivent pas dans le DOM : un lien collé n'est ni « écrit », ni borné.
 */
const WrittenLink = Extension.create({
  name: "commentWrittenLink",
  addGlobalAttributes() {
    const drapeau = { default: false, rendered: false, parseHTML: () => false };
    return [{ types: ["link"], attributes: { explicit: drapeau, bounded: drapeau } }];
  },
});

/**
 * Un titre tient sur UNE ligne : le markdown n'a pas de saut de ligne dans un titre — `# un` puis
 * `deux` à la ligne font un titre ET un paragraphe. Un saut posé dans un titre (Maj+Entrée, un
 * paragraphe de plusieurs lignes changé en titre, un collage) le coupe donc à son PREMIER saut : la
 * suite devient UN paragraphe, ses autres sauts compris — exactement ce que le fil en montrera.
 *
 * Un saut en TÊTE de titre ne le vide pas : la ligne vide passe au-dessus, en paragraphe, et le
 * titre garde son texte — ce que fait Entrée au même endroit.
 */
const TitreSurUneLigne = Extension.create({
  name: "commentHeadingLine",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("commentHeadingLine"),
        appendTransaction: (transactions, _avant, state) => {
          if (!transactions.some(tr => tr.docChanged)) return null;
          const { hardBreak, paragraph } = state.schema.nodes;
          const coupes: { titre: number; saut: number }[] = [];
          state.doc.descendants((node, titre) => {
            if (node.type.name !== "heading") return !node.isTextblock;
            let saut = -1;
            node.forEach((enfant, decalage) => {
              if (saut < 0 && enfant.type === hardBreak) saut = titre + 1 + decalage;
            });
            if (saut >= 0) coupes.push({ titre, saut });
            return false;
          });
          if (coupes.length === 0) return null;
          const tr = state.tr;
          // De la fin vers le début : chaque coupe laisse en place les positions qui la précèdent.
          for (const { titre, saut } of coupes.reverse()) {
            tr.delete(saut, saut + 1);
            if (saut === titre + 1) tr.insert(titre, paragraph.create());
            else tr.split(saut, 1, [{ type: paragraph }]);
          }
          return tr;
        },
      }),
    ];
  },
});

/**
 * Le schéma d'un message : ce que le markdown du fil sait écrire, rien de plus.
 *
 * - les titres à croisillons, six niveaux, comme l'éditeur du legacy — et sur une ligne
 *   (`TitreSurUneLigne`) ; pas de souligné (aucun markdown pour lui) ;
 * - le filet horizontal RESTE : sans son nœud, éditer un message qui en porte le déformerait ;
 * - pas d'image dans le texte : le fil les refuse à dessein, une image est une pièce jointe ;
 * - le lien ne s'ouvre pas au clic pendant qu'on écrit ;
 * - le code en ligne est le nôtre (`CommentCode`), pas celui du kit.
 *
 * Une fonction, pas une constante : l'éditeur y ajoute les siennes (suggestion de mention, texte
 * d'attente, clavier), et chaque éditeur doit recevoir ses propres instances.
 */
export function commentExtensions(mention: typeof CommentMentionNode = CommentMentionNode): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      underline: false,
      code: false,
      link: { openOnClick: false, autolink: true, linkOnPaste: true, HTMLAttributes: { rel: "noopener noreferrer nofollow ugc", target: null } },
    }),
    CommentCode,
    WrittenLink,
    TitreSurUneLigne,
    mention,
  ];
}
