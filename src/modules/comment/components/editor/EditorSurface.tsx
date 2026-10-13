import { useEffect, useId, useImperativeHandle, useLayoutEffect, useState, type RefObject } from "react";
import { Extension, getSchema, markInputRule, type Editor } from "@tiptap/core";
import { Placeholder } from "@tiptap/extensions";
import { Slice } from "@tiptap/pm/model";
import { PluginKey } from "@tiptap/pm/state";
import { EditorContent, useEditor, type UseEditorOptions } from "@tiptap/react";
import { exitSuggestion } from "@tiptap/suggestion";
import type { EntityTypes, User } from "@communecter/cocolight-api-client";
import { useSearchUsers } from "@/hooks/useSearchUsers";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import { imageFilesFrom } from "../../lib/commentImages";
import { COMMENT_PROSE } from "../../lib/commentProse";
import { CommentMentionNode, commentExtensions } from "../../lib/richText/extensions";
import { mentionsOf, parseMarkdown, serializeMarkdown, type MentionAttrs } from "../../lib/richText/markdownBridge";
import { FORMAT_KINDS, type EditorSurfaceHandle, type EditorSurfaceState, type FormatKind } from "./editorTypes";
import type { CommentMention } from "../../types";

export interface EditorSurfaceProps {
  /** Le texte de départ (un brouillon rendu, ou le message qu'on édite) et ses mentions. Lus au montage. */
  readonly initialValue: string;
  readonly initialMentions: readonly CommentMention[];
  /** Le texte d'attente, montré tant que le champ est vide. */
  readonly placeholder: string;
  /** Le nom du champ pour un lecteur d'écran. */
  readonly label: string;
  /** L'élément qui décrit la mise en forme au clavier. */
  readonly describedBy?: string;
  readonly disabled: boolean;
  readonly autoFocus: boolean;
  /** Où chercher d'abord les personnes à mentionner. */
  readonly entity: EntityTypes | null;
  /** Entrée : à la coquille de décider si le message part. */
  readonly onSubmit: () => void;
  /** Échap, quand aucune liste de mentions n'est ouverte. Absent : la touche n'est pas à nous. */
  readonly onCancel?: () => void;
  /** Une image collée ou déposée est une pièce jointe, jamais du texte. Absent : on ne confisque rien. */
  readonly onAddImages?: (files: readonly File[]) => void;
  /** Ce que la coquille doit savoir de l'éditeur : vide ou non, marques actives. */
  readonly onStateChange: (state: EditorSurfaceState) => void;
  /** Par où la coquille commande l'éditeur : sa barre d'outils, l'émoji, l'envoi. */
  readonly handleRef: RefObject<EditorSurfaceHandle | null>;
}

/** Le nom de chaque mise en forme dans le schéma de l'éditeur. */
const NOM_DANS_LE_SCHEMA: Record<FormatKind, string> = {
  bold: "bold", italic: "italic", strike: "strike", code: "code", link: "link",
  quote: "blockquote", list: "bulletList", ordered: "orderedList", codeBlock: "codeBlock",
};

/** Ce que les gestionnaires de l'éditeur lisent « au présent » (cf. `Present`). */
interface Vivant {
  placeholder: string;
  label: string;
  describedBy: string | undefined;
  disabled: boolean;
  listboxId: string;
  suggesting: boolean;
  actif: number;
  candidates: readonly User[];
  pick: (user: User) => void;
  onSubmit: () => void;
  onCancel: (() => void) | undefined;
  onAddImages: ((files: readonly File[]) => void) | undefined;
  onStateChange: (state: EditorSurfaceState) => void;
}

/**
 * Le « présent » du composant, pour les gestionnaires de l'éditeur.
 *
 * Les options de l'éditeur sont créées une fois, au premier rendu ; ses gestionnaires vivent donc
 * plus longtemps que les valeurs de ce rendu-là. Ils lisent ici celles du dernier — un objet tenu
 * pour la vie du composant et rafraîchi après chaque rendu : le rôle d'une ref, sous une forme que
 * des options créées pendant le rendu peuvent capturer.
 */
class Present {
  private valeur: Vivant | null = null;
  private empreinte = "";

  suivre(valeur: Vivant): void {
    this.valeur = valeur;
  }

  lire(): Vivant | null {
    return this.valeur;
  }

  /** Dit à la coquille ce que l'éditeur est devenu — une fois par changement, pas par frappe. */
  rapporter(editor: Editor): void {
    const etat = etatDe(editor);
    const empreinte = JSON.stringify(etat);
    if (empreinte === this.empreinte) return;
    this.empreinte = empreinte;
    this.valeur?.onStateChange(etat);
  }
}

interface Suggestion {
  readonly query: string;
  readonly command: (attrs: MentionAttrs) => void;
}

/** Le greffon de suggestion des mentions, nommé pour pouvoir le refermer d'ici (Échap). */
const SUGGESTION_DE_MENTION = new PluginKey("commentMention");

/**
 * Les extensions dont les raccourcis TAPÉS restent ceux du kit : les blocs (`- `, `1. `, `> `,
 * les trois accents graves, `---`) et le code en ligne. Ceux du gras, de l'italique et du barré
 * sont remplacés par les nôtres (`Clavier`), plus stricts.
 */
const RACCOURCIS_TAPES = ["blockquote", "bulletList", "orderedList", "codeBlock", "code", "horizontalRule", "commentKeymap"];

/**
 * Les marques tapées « à la markdown » : `**gras**`, `*italique*`, `~~barré~~`.
 *
 * Comme le markdown du fil, et pas comme le kit : le texte marqué ne commence ni ne finit par une
 * espace. Le kit, lui, mettait en italique le « 3 » de « 2 * 3 * 4 » — ce que le fil n'aurait
 * jamais fait d'un texte tapé. Écrites sans assertion arrière : un navigateur qui ne la connaît
 * pas refuserait le fichier entier.
 */
const MARQUES_TAPEES: ReadonlyArray<readonly [RegExp, "bold" | "italic" | "strike"]> = [
  [/(?:^|\s)(\*\*([^*\s](?:[^*]*[^*\s])?)\*\*)$/, "bold"],
  [/(?:^|\s)(__([^_\s](?:[^_]*[^_\s])?)__)$/, "bold"],
  [/(?:^|\s)(\*([^*\s](?:[^*]*[^*\s])?)\*)$/, "italic"],
  [/(?:^|\s)(_([^_\s](?:[^_]*[^_\s])?)_)$/, "italic"],
  [/(?:^|\s)(~~([^~\s](?:[^~]*[^~\s])?)~~)$/, "strike"],
];

/** Les champs utiles d'une personne proposée. Sans slug, elle n'est pas choisissable. */
function personne(user: User): { id: string; name: string; slug: string } {
  const data = (user as unknown as { serverData?: Record<string, unknown> }).serverData ?? {};
  const slug = typeof data.slug === "string" ? data.slug : "";
  return {
    id: (user as unknown as { id?: string }).id ?? "",
    name: typeof data.name === "string" ? data.name : slug,
    slug,
  };
}

/**
 * Sur un écran tactile, Entrée passe à la ligne — il n'y a pas de Maj+Entrée sous le pouce — et le
 * message part par son bouton. Lu à la frappe : un appareil peut changer de pointeur principal.
 */
function pointeurGrossier(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
}

function etatDe(editor: Editor): EditorSurfaceState {
  const active = {} as Record<FormatKind, boolean>;
  for (const kind of FORMAT_KINDS) active[kind] = editor.isActive(NOM_DANS_LE_SCHEMA[kind]);
  // « Vide » se juge sur ce qui partirait, pas sur la forme du document : un paragraphe d'espaces,
  // ou un saut de ligne seul, n'est pas un message.
  return { empty: serializeMarkdown(editor.state.doc).trim() === "", active };
}

/**
 * La zone éditable d'un message — Tiptap, et rien d'autre : la coquille (`CommentComposer`) garde
 * la barre d'outils, les images et l'envoi, et ne sait de l'éditeur que sa poignée.
 *
 * **Chargée côté client seulement** (`editorStore`) : ni le rendu serveur ni le démarrage d'une
 * page ne paient l'éditeur.
 *
 * **Ce qui s'enregistre est du markdown**, jamais le HTML de l'éditeur (`markdownBridge`) : le
 * texte de départ est relu par le moteur du fil, et l'envoi réécrit le document en texte.
 *
 * Les options de l'éditeur sont créées UNE fois : les recréer à chaque rendu le reconfigurerait à
 * chaque frappe. Ce qui change — libellés, rappels, liste des personnes — est lu dans `present`.
 */
export function EditorSurface({
  initialValue, initialMentions, placeholder, label, describedBy, disabled, autoFocus, entity,
  onSubmit, onCancel, onAddImages, onStateChange, handleRef,
}: EditorSurfaceProps) {
  const t = useT("modules/comment");
  const listboxId = useId();
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  const { data: candidates = [] } = useSearchUsers(suggestion?.query ?? "", suggestion !== null, entity);

  // La liste est-elle ouverte ? Une seule expression, lue par les attributs ARIA du champ ET par
  // le rendu de la liste : les deux ne peuvent pas diverger.
  const suggesting = suggestion !== null && candidates.length > 0;
  // L'indice surligné, BORNÉ au rendu : la liste peut rétrécir sans qu'on ait rien tapé (la
  // recherche se refait au retour sur l'onglet), et un indice resté trop haut désignerait une
  // option qui n'existe plus.
  const actif = Math.min(highlighted, Math.max(candidates.length - 1, 0));

  const pick = (user: User) => {
    const choisie = personne(user);
    if (!choisie.slug || !suggestion) return;
    // `kind` reste vide : on ne mentionne ici que des personnes. Celui d'une mention venue d'ailleurs
    // est relu avec le message, et survit à l'édition.
    suggestion.command({ id: choisie.id || null, label: choisie.name, slug: choisie.slug, kind: null });
  };

  const [present] = useState(() => new Present());
  // Avant la peinture, pas après : une touche peut suivre le rendu de près.
  useLayoutEffect(() => {
    present.suivre({
      placeholder, label, describedBy, disabled, listboxId, suggesting, actif, candidates, pick,
      onSubmit, onCancel, onAddImages, onStateChange,
    });
  });

  const [options] = useState<UseEditorOptions>(() => {
    /**
     * Le clavier d'une messagerie : Entrée envoie, et les marques se tapent comme en markdown
     * (`MARQUES_TAPEES`). Il passe APRÈS la suggestion de mention (priorité 101), qui capte
     * Entrée, Tab et les flèches tant que sa liste est ouverte, et AVANT les raccourcis du kit
     * (100) : sans cela Entrée couperait le paragraphe. Échap se traite hors de l'éditeur (plus bas).
     */
    const Clavier = Extension.create({
      name: "commentKeymap",
      priority: 100.5,
      addKeyboardShortcuts() {
        return {
          Enter: ({ editor }) => {
            // Dans une liste, Entrée ouvre l'élément suivant ; dans un bloc de code, une ligne.
            if (editor.isActive("listItem") || editor.isActive("codeBlock")) return false;
            if (pointeurGrossier()) return false;
            present.lire()?.onSubmit();
            return true;
          },
        };
      },
      addInputRules() {
        const { marks } = this.editor.schema;
        return MARQUES_TAPEES.map(([find, nom]) => markInputRule({ find, type: marks[nom] }));
      },
    });

    const mention = CommentMentionNode.configure({
      HTMLAttributes: { class: "comment-mention" },
      suggestion: {
        pluginKey: SUGGESTION_DE_MENTION,
        // La recherche des personnes est un crochet React (`useSearchUsers`) : le greffon ne
        // fournit que la requête, la liste se rend ici.
        items: () => [],
        render: () => ({
          onStart: props => { setSuggestion({ query: props.query, command: props.command }); setHighlighted(0); },
          onUpdate: props => { setSuggestion({ query: props.query, command: props.command }); setHighlighted(0); },
          onExit: () => setSuggestion(null),
          onKeyDown: ({ event }) => {
            const vivant = present.lire();
            if (!vivant || vivant.candidates.length === 0) return false;
            const nombre = vivant.candidates.length;
            if (event.key === "ArrowDown") { setHighlighted((vivant.actif + 1) % nombre); return true; }
            if (event.key === "ArrowUp") { setHighlighted((vivant.actif - 1 + nombre) % nombre); return true; }
            if (event.key === "Enter" || event.key === "Tab") {
              const choisie = vivant.candidates[vivant.actif];
              // On ne confisque la touche que si l'on va RÉELLEMENT choisir : sans slug, rien ne
              // serait inséré — Entrée paraîtrait morte, et Tab n'échapperait plus au champ.
              if (choisie && personne(choisie).slug) { vivant.pick(choisie); return true; }
            }
            return false;
          },
        }),
      },
    });

    const extensions = [
      ...commentExtensions(mention),
      Placeholder.configure({ placeholder: () => present.lire()?.placeholder ?? "", showOnlyWhenEditable: false }),
      Clavier,
    ];

    return {
      extensions,
      // La feuille de l'éditeur vit dans `styles.css` : aucune balise `<style>` n'est ajoutée à la page.
      injectCSS: false,
      enableInputRules: RACCOURCIS_TAPES,
      // Ce qu'on colle est déjà relu comme du markdown (`clipboardTextParser`) : les règles de
      // collage du kit repasseraient derrière, avec leur lecture à elles des étoiles.
      enablePasteRules: false,
      content: parseMarkdown(getSchema(extensions), initialValue, initialMentions).toJSON(),
      editorProps: {
        // Une fonction : relue à chaque mise à jour de la vue, elle suit la liste des mentions
        // (cf. l'effet qui rafraîchit la vue plus bas). Le rôle `textbox` est posé par Tiptap.
        attributes: () => {
          const vivant = present.lire();
          const attributs: Record<string, string> = {
            class: cn(COMMENT_PROSE, "comment-editor-field"),
            "data-comment-field": "",
            "aria-multiline": "true",
            // Sans annonce, taper « @ » ouvrait une liste qu'aucun lecteur d'écran ne mentionnait,
            // et les flèches déplaçaient une surbrillance signalée nulle part.
            "aria-autocomplete": "list",
            "aria-haspopup": "listbox",
          };
          if (!vivant) return attributs;
          attributs["aria-label"] = vivant.label;
          if (vivant.describedBy) attributs["aria-describedby"] = vivant.describedBy;
          if (vivant.disabled) attributs["aria-disabled"] = "true";
          if (vivant.suggesting) {
            attributs["aria-controls"] = vivant.listboxId;
            attributs["aria-activedescendant"] = `${vivant.listboxId}-${vivant.actif}`;
          }
          return attributs;
        },
        // Coller du texte, c'est le relire comme le fil le lira : une liste collée reste une liste.
        clipboardTextParser: (text, _contexte, _brut, view) => Slice.maxOpen(parseMarkdown(view.state.schema, text).content),
        // Le collage est le geste le plus courant pour joindre une capture d'écran. On ne confisque
        // l'événement que s'il porte vraiment une image, sinon un collage de texte perdrait son contenu.
        handlePaste: (_view, event) => {
          const recevoir = present.lire()?.onAddImages;
          if (!recevoir) return false;
          const fichiers = imageFilesFrom(event.clipboardData);
          if (fichiers.length === 0) return false;
          event.preventDefault();
          recevoir(fichiers);
          return true;
        },
        handleDrop: (_view, event, _tranche, deplace) => {
          const recevoir = present.lire()?.onAddImages;
          if (deplace || !recevoir) return false;
          const fichiers = imageFilesFrom(event.dataTransfer);
          if (fichiers.length === 0) return false;
          event.preventDefault();
          recevoir(fichiers);
          return true;
        },
      },
      onTransaction: ({ editor }) => present.rapporter(editor),
    };
  });

  const editor = useEditor(options);

  // L'état de départ, dit dès le montage : l'éditeur n'annonce sa création qu'un instant plus tard,
  // et d'ici là la coquille tiendrait sa barre et son bouton pour inertes.
  useEffect(() => { present.rapporter(editor); }, [present, editor]);

  useEffect(() => { editor.setEditable(!disabled, false); }, [editor, disabled]);

  useEffect(() => {
    if (autoFocus) editor.commands.focus("end");
  }, [editor, autoFocus]);

  // Les attributs du champ et le texte d'attente sont des fonctions du « présent » : la vue ne les
  // relit qu'à une mise à jour. On lui en demande une quand ce qu'ils disent a changé.
  useEffect(() => {
    if (!editor.isDestroyed) editor.view.setProps({});
  }, [editor, placeholder, label, describedBy, disabled, listboxId, suggesting, actif]);

  useImperativeHandle(handleRef, () => ({
    focus: () => { editor.commands.focus(); },
    toggle: kind => {
      const chaine = editor.chain().focus();
      switch (kind) {
        case "bold": chaine.toggleBold().run(); break;
        case "italic": chaine.toggleItalic().run(); break;
        case "strike": chaine.toggleStrike().run(); break;
        case "code": chaine.toggleCode().run(); break;
        case "quote": chaine.toggleBlockquote().run(); break;
        case "list": chaine.toggleBulletList().run(); break;
        case "ordered": chaine.toggleOrderedList().run(); break;
        case "codeBlock": chaine.toggleCodeBlock().run(); break;
        // Un lien demande une adresse : il passe par `setLink`.
        case "link": break;
      }
    },
    currentLink: () => (editor.isActive("link") ? String(editor.getAttributes("link").href ?? "") : null),
    setLink: href => {
      if (href === null) {
        editor.chain().focus().extendMarkRange("link").unsetLink().run();
        return;
      }
      // Rien de sélectionné, et pas dans un lien : l'adresse est son propre texte.
      if (editor.state.selection.empty && !editor.isActive("link")) {
        editor.chain().focus().insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] }).run();
        return;
      }
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    },
    insertText: text => { editor.chain().focus().insertContent(text).run(); },
    read: () => ({ text: serializeMarkdown(editor.state.doc).trim(), mentions: mentionsOf(editor.state.doc) }),
    clear: () => { editor.commands.clearContent(); },
  }), [editor]);

  return (
    /**
     * « Échap m'appartient » — mais seulement quand il a quelque chose à faire : fermer la liste de
     * mentions, ou annuler l'édition en cours. La modale des discussions lit cet attribut sur un
     * ANCÊTRE de la cible (`closest`) pour laisser la main : Radix écoute la touche en phase de
     * capture, avant tout gestionnaire d'ici.
     *
     * Et c'est ICI qu'Échap se traite, en capture, pas dans le clavier de l'éditeur : pour ne pas
     * se fermer, la modale NEUTRALISE la touche — or l'éditeur ignore une touche déjà neutralisée
     * (vu au navigateur le 13/10 : ni la liste ni l'édition ne se refermaient dans la modale).
     * Traitée, la touche ne descend pas plus bas : l'éditeur ne la verrait qu'en double.
     */
    <div
      data-comment-escape={suggestion !== null || onCancel ? "" : undefined}
      data-comment-editor
      onKeyDownCapture={event => {
        if (event.key !== "Escape") return;
        if (suggestion !== null) exitSuggestion(editor.view, SUGGESTION_DE_MENTION);
        else if (onCancel) onCancel();
        else return;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <EditorContent editor={editor} />

      {suggesting ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={String(t("composer.mentionHint"))}
          className="absolute bottom-full z-20 mb-1 max-h-56 w-full overflow-auto rounded-md border
                     border-border bg-popover p-1 shadow-md"
        >
          {candidates.map((user, i) => {
            const { name, slug } = personne(user);
            return (
              // L'option est le `<li>` lui-même : une option ne se tabule pas, elle se désigne par
              // `aria-activedescendant` pendant que le focus reste dans le champ.
              <li
                key={slug || String(i)}
                id={`${listboxId}-${i}`}
                role="option"
                aria-selected={i === actif}
                // `onMouseDown` et non `onClick` : le clic ferait perdre le focus au champ avant
                // que la mention ne soit posée.
                onMouseDown={event => { event.preventDefault(); pick(user); }}
                onMouseEnter={() => setHighlighted(i)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                  i === actif ? "bg-accent text-accent-foreground" : "",
                )}
              >
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs text-muted-foreground">@{slug}</span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* Ce que `aria-expanded` aurait dit si le rôle l'admettait : une région polie, lue à
          l'ouverture de la liste puis silencieuse. */}
      <p className="sr-only" role="status">
        {suggesting ? String(t("composer.mentionCount", undefined, { count: candidates.length })) : ""}
      </p>
    </div>
  );
}
